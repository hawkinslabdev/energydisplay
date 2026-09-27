import { NextResponse } from "next/server";

import { type Entities, type HaState, summarize } from "./summarize";

export const dynamic = "force-dynamic";

const env = process.env;

const entities: Entities = {
  power: env.POWER,
  energyImport: env.ENERGY_IMPORT,
  energyExport: env.ENERGY_EXPORT,
  gas: env.GAS,
  water: env.WATER,
  temperature: env.TEMPERATURE,
  battery: env.BATTERY,
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

const byId = (states: HaState[]) =>
  Object.fromEntries(states.map((state) => [state.entity_id, state]));

export async function GET() {
  const ids = Object.values(entities).filter(Boolean) as string[];
  const totals = [
    entities.energyImport,
    entities.energyExport,
    entities.gas,
    entities.water,
  ].filter(Boolean);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  try {
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
      summarize(
        entities,
        byId(current),
        byId(history.map((states) => states[0])),
        parseFloat(env.GAS_PRICE ?? "") || 0,
      ),
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 });
  }
}
