import { NextResponse } from "next/server";

import { type Entities, type HaState, fromPrefs, summarize } from "./summarize";

export const dynamic = "force-dynamic";

const env = process.env;

const list = (value?: string) =>
  value?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];

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

async function ha<T>(path: string): Promise<T> {
  const response = await fetch(`${env.HA_URL}/api/${path}`, {
    headers: { Authorization: `Bearer ${env.HA_TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Home Assistant ${path}: HTTP ${response.status}`);
  }
  return response.json();
}

function energyPrefs(): Promise<Parameters<typeof fromPrefs>[0]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${env.HA_URL?.replace(/^http/, "ws")}/api/websocket`);
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
        ws.send(JSON.stringify({ id: 1, type: "energy/get_prefs" }));
      } else if (message.type === "auth_invalid") {
        done(() => reject(new Error("Home Assistant rejected HA_TOKEN")));
      } else if (message.type === "result") {
        done(() =>
          message.success
            ? resolve(message.result)
            : reject(new Error(`energy/get_prefs: ${message.error?.message}`)),
        );
      }
    };
  });
}

// ponytail: discovered once per process, restart the container after changing the Energy dashboard.
let discovery: ReturnType<typeof energyPrefs> | undefined;

async function resolveEntities(): Promise<{ entities: Entities; gasPrice: number }> {
  const envPrice = parseFloat(env.GAS_PRICE ?? "");
  if (env.AUTODISCOVER !== "true") {
    return { entities: configured, gasPrice: envPrice || 0 };
  }
  discovery ??= energyPrefs().catch((error) => {
    discovery = undefined;
    throw error;
  });
  const found = fromPrefs(await discovery);
  const discovered: Partial<Entities> = found.entities;
  const entities = Object.fromEntries(
    Object.entries(configured).map(([key, ids]) => [
      key,
      ids.length ? ids : (discovered[key as keyof Entities] ?? []),
    ]),
  ) as unknown as Entities;
  return {
    entities,
    gasPrice: Number.isFinite(envPrice) ? envPrice : (found.gasPrice ?? 0),
  };
}

const byId = (states: HaState[]) =>
  Object.fromEntries(states.map((state) => [state.entity_id, state]));

export async function GET() {
  try {
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

    const [current, history] = await Promise.all([
      Promise.all(ids.map((id) => ha<HaState>(`states/${id}`))),
      totals.length
        ? ha<HaState[][]>(
            `history/period/${midnight.toISOString()}` +
              `?filter_entity_id=${totals.join(",")}&minimal_response&no_attributes`,
          )
        : [],
    ]);
    return NextResponse.json(
      summarize(entities, byId(current), byId(history.map((states) => states[0])), gasPrice),
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
