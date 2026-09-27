import { NextResponse } from "next/server";

import { pickWheels } from "../../wheels";
import {
  ENTITY_ID,
  type Entities,
  type HaState,
  type RegistryEntry,
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
function haCommands(types: string[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${env.HA_URL?.replace(/^http/, "ws")}/api/websocket`);
    const results: unknown[] = [];
    let pending = types.length;
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
        types.forEach((type, i) => ws.send(JSON.stringify({ id: i + 1, type })));
      } else if (message.type === "auth_invalid") {
        done(() => reject(new Error("Home Assistant rejected HA_TOKEN")));
      } else if (message.type === "result") {
        if (!message.success) {
          done(() => reject(new Error(`${types[message.id - 1]}: ${message.error?.message}`)));
          return;
        }
        results[message.id - 1] = message.result;
        if (--pending === 0) done(() => resolve(results));
      }
    };
  });
}

// ponytail: discovered once per process, restart the container after changing the Energy dashboard.
async function discover() {
  const [[prefs, registry], states] = await Promise.all([
    haCommands(["energy/get_prefs", "config/entity_registry/list"]),
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
  // Without an Energy dashboard (or while Home Assistant is down) the entity variables still work;
  // discovery is retried on the next request.
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

const byId = (states: (HaState | undefined)[]) =>
  Object.fromEntries(
    states.filter((state): state is HaState => !!state).map((state) => [state.entity_id, state]),
  );

async function read() {
  const { entities, gasPrice } = await resolveEntities();
  const ids = [...new Set(Object.values(entities).flat())];
  const totals = [
    ...entities.energyImport,
    ...entities.energyExport,
    ...entities.solar,
    ...entities.gas,
    ...entities.water,
  ];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  // Only the midnight baseline is used; a short window keeps the response from growing all day.
  const until = new Date(midnight.getTime() + 1000).toISOString();

  const [current, history] = await Promise.all([
    Promise.all(ids.map((id) => ha<HaState>(`states/${id}`, true))),
    totals.length
      ? ha<HaState[][]>(
          `history/period/${midnight.toISOString()}?end_time=${until}` +
            `&filter_entity_id=${totals.join(",")}&minimal_response&no_attributes`,
        )
      : [],
  ]);
  const states = byId(current);
  return {
    ...summarize(entities, states, byId(history.map((states) => states[0])), gasPrice),
    wheels: pickWheels([env.WHEEL1, env.WHEEL2, env.WHEEL3], entities),
    // Troubleshooting: the entity IDs in use (set or discovered), and those without a usable value.
    entities,
    unavailable: ids.filter((id) => num(states[id]) === undefined),
  };
}

// Concurrent and rapid requests share one Home Assistant round trip, so the endpoint cannot be
// used to flood Home Assistant.
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
