import { NextResponse } from "next/server";

import { DEFAULT_BARS, DEFAULT_WHEELS, pickGauges } from "../../gauges";
import {
  ENTITY_ID,
  type Entities,
  type HaState,
  type RegistryEntry,
  type Statistics,
  fromPrefs,
  num,
  pickDevicePower,
  pickWeather,
  summarize,
} from "./summarize";

export const dynamic = "force-dynamic";

const env = process.env;

// Entity IDs end up in Home Assistant URLs; anything that is not a plain entity ID is dropped.
const list = (value?: string) =>
  value?.split(",").map((id) => id.trim()).filter((id) => {
    if (id && !ENTITY_ID.test(id)) console.warn(`Ignoring invalid entity ID: ${id}`);
    return ENTITY_ID.test(id);
  }) ?? [];

const configured: Entities = {
  power: list(env.POWER),
  energyImport: list(env.ENERGY_IMPORT),
  energyExport: list(env.ENERGY_EXPORT),
  solar: list(env.SOLAR),
  gas: list(env.GAS),
  water: list(env.WATER),
  temperature: list(env.TEMPERATURE),
  battery: list(env.BATTERY),
  batteryIn: [],
  batteryOut: [],
};

// A missing entity (404) resolves to undefined, so one removed sensor shows as unavailable.
async function ha<T>(path: string): Promise<T>;
async function ha<T>(path: string, optional: true): Promise<T | undefined>;
async function ha<T>(path: string, optional = false): Promise<T | undefined> {
  const response = await fetch(`${env.HA_URL}/api/${path}`, {
    headers: { Authorization: `Bearer ${env.HA_TOKEN}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (optional && response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Home Assistant ${path}: HTTP ${response.status}`);
  }
  return response.json();
}

// Runs websocket commands in one authenticated session; results come back in command order.
function haCommands(commands: ({ type: string } & Record<string, unknown>)[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${env.HA_URL?.replace(/^http/, "ws")}/api/websocket`);
    const results: unknown[] = [];
    let pending = commands.length;
    const done = (settle: () => void) => {
      clearTimeout(timer);
      ws.close();
      settle();
    };
    const timer = setTimeout(
      () => done(() => reject(new Error("Home Assistant websocket timed out"))),
      10_000,
    );
    ws.onerror = () => done(() => reject(new Error("Home Assistant websocket failed")));
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: env.HA_TOKEN }));
      } else if (message.type === "auth_ok") {
        commands.forEach((command, i) => ws.send(JSON.stringify({ ...command, id: i + 1 })));
      } else if (message.type === "auth_invalid") {
        done(() => reject(new Error("Home Assistant rejected HA_TOKEN")));
      } else if (message.type === "result") {
        if (!message.success) {
          done(() => reject(new Error(`${commands[message.id - 1].type}: ${message.error?.message}`)));
          return;
        }
        results[message.id - 1] = message.result;
        if (--pending === 0) done(() => resolve(results));
      }
    };
  });
}

async function discover() {
  const [[prefs, registry], states] = await Promise.all([
    haCommands([{ type: "energy/get_prefs" }, { type: "config/entity_registry/list" }]),
    ha<HaState[]>("states"),
  ]);
  const found = fromPrefs(prefs as Parameters<typeof fromPrefs>[0]);
  const weather = pickWeather(states);
  const power = found.entities.power.length
    ? found.entities.power
    : [pickDevicePower(found.entities.energyImport[0], registry as RegistryEntry[], states)].filter((id) => id !== undefined);
  return { ...found, entities: { ...found.entities, power, temperature: weather ? [weather] : [] } };
}

let discovery: ReturnType<typeof discover> | undefined;

async function resolveEntities(): Promise<{ entities: Entities; gasPrice: number | null }> {
  const parsed = parseFloat(env.GAS_PRICE ?? "");
  const envPrice = Number.isFinite(parsed) ? parsed : null;
  if (env.AUTODISCOVER === "false") {
    return { entities: configured, gasPrice: envPrice };
  }
  discovery ??= discover().catch((error) => {
    discovery = undefined;
    throw error;
  });
  // Without an Energy dashboard or while Home Assistant is down, entity variables still work and discovery is retried on the next request.
  const found = await discovery.catch((error) => {
    console.warn(`Autodiscovery failed: ${error.message}`);
    return undefined;
  });
  if (!found) return { entities: configured, gasPrice: envPrice };
  const discovered: Partial<Entities> = found.entities;
  const entities = Object.fromEntries(
    Object.entries(configured).map(([key, ids]) => [
      key,
      ids.length ? ids : (discovered[key as keyof Entities] ?? []),
    ]),
  ) as unknown as Entities;
  return {
    entities,
    gasPrice: envPrice ?? found.gasPrice ?? null,
  };
}

// daily statistics of the last 30 days and the same season last year
let reference: { day: number; days: Promise<Statistics> } | undefined;
function referenceDays(midnight: Date, ids: string[]) {
  if (reference?.day !== midnight.getTime()) {
    const shift = (from: Date, days: number) => new Date(new Date(from).setDate(from.getDate() + days)).toISOString();
    const period = (start_time: string, end_time: string) => ({
      type: "recorder/statistics_during_period",
      start_time,
      end_time,
      statistic_ids: ids,
      period: "day",
      types: ["change", "max", "min"],
    });
    const days = haCommands([
      period(shift(midnight, -30), midnight.toISOString()),
      period(shift(midnight, -365 - 15), shift(midnight, -365 + 15)),
    ]).then((results) => {
      const merged: Statistics = {};
      for (const result of results as Statistics[])
        for (const [id, rows] of Object.entries(result)) merged[id] = [...(merged[id] ?? []), ...rows];
      return merged;
    });
    reference = { day: midnight.getTime(), days };
    days.catch(() => (reference = undefined));
  }
  return reference.days.catch(() => ({}));
}

const byId = (states: (HaState | undefined)[]) =>
  Object.fromEntries(
    states.filter((state): state is HaState => !!state).map((state) => [state.entity_id, state]),
  );

// wheels and bars share one pick, so no option shows twice
const layout = (entities: Entities) => {
  const gauges = pickGauges(
    [env.WHEEL1, env.WHEEL2, env.WHEEL3, env.BAR1, env.BAR2, env.BAR3, env.BAR4],
    [...DEFAULT_WHEELS, ...DEFAULT_BARS],
    entities,
  );
  return { wheels: gauges.slice(0, 3), bars: gauges.slice(3) };
};

async function read() {
  const { entities, gasPrice } = await resolveEntities();
  const ids = [...new Set(Object.values(entities).flat())];
  const totals = [
    ...entities.energyImport,
    ...entities.energyExport,
    ...entities.solar,
    ...entities.gas,
    ...entities.water,
    ...entities.batteryIn,
    ...entities.batteryOut,
  ];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const [current, [statistics], days] = await Promise.all([
    Promise.all(ids.map((id) => ha<HaState>(`states/${id}`, true))),
    totals.length
      ? haCommands([{
          type: "recorder/statistics_during_period",
          start_time: midnight.toISOString(),
          statistic_ids: totals,
          period: "hour",
          types: ["change"],
        }])
      : [{}],
    referenceDays(midnight, [...totals, ...entities.power]),
  ]);
  const states = byId(current);
  return {
    ...summarize(entities, states, statistics as Statistics, gasPrice, days),
    ...layout(entities),
    // Troubleshooting: the entity IDs in use (set or discovered), and those without a usable value.
    entities,
    unavailable: ids.filter((id) => num(states[id]) === undefined),
  };
}

// Concurrent and rapid requests share one Home Assistant round trip, so the endpoint cannot flood Home Assistant.
const CACHE_MS = 2000;
let cached: { at: number; result: ReturnType<typeof read> } | undefined;

export async function GET() {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { at: Date.now(), result: read() };
  }
  try {
    return NextResponse.json(await cached.result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Details stay in the server log; the response carries no URLs, tokens or upstream messages.
    console.error(error);
    return NextResponse.json(
      { error: "Home Assistant unavailable; details in the container log" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
