export interface HaState {
  entity_id: string;
  state: string;
  attributes?: { unit_of_measurement?: string; device_class?: string; temperature?: number };
}

export interface Entities {
  power: string[];
  energyImport: string[];
  energyExport: string[];
  solar: string[];
  gas: string[];
  water: string[];
  temperature: string[];
  battery: string[];
}

// null means not configured, or no usable state in Home Assistant.
export interface Reading {
  power_w: number | null;
  energy_import_today: number | null;
  energy_export_today: number | null;
  solar_today: number | null;
  gas_today: number | null;
  water_today_l: number | null;
  temperature: number | null;
  battery_soc: number | null;
  gas_cost_today: number | null;
  grid_net_today: number | null;
  solar_self_consumed_pct: number | null;
}

interface EnergySource {
  type: string;
  stat_energy_from?: string | null;
  stat_energy_to?: string | null;
  stat_rate?: string;
  stat_soc?: string;
  number_energy_price?: number | null;
}

export const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

export function fromPrefs(prefs: { energy_sources: EnergySource[] }) {
  const pick = (type: string, key: keyof EnergySource) =>
    prefs.energy_sources
      .filter((source) => source.type === type)
      .map((source) => source[key])
      .filter((id): id is string => typeof id === "string" && ENTITY_ID.test(id));
  const gas = prefs.energy_sources.find((source) => source.type === "gas");

  return {
    entities: {
      power: pick("grid", "stat_rate"),
      energyImport: pick("grid", "stat_energy_from"),
      energyExport: pick("grid", "stat_energy_to"),
      solar: pick("solar", "stat_energy_from"),
      gas: pick("gas", "stat_energy_from"),
      water: pick("water", "stat_energy_from"),
      battery: pick("battery", "stat_soc"),
    },
    gasPrice: gas?.number_energy_price ?? undefined,
  };
}

// Weather entities carry the temperature as an attribute; their state is the condition.
export const num = (state?: HaState) => {
  const raw = state?.entity_id.startsWith("weather.") ? state.attributes?.temperature : state?.state;
  const value = parseFloat(String(raw ?? ""));
  return Number.isFinite(value) ? value : undefined;
};

const FACTOR: Record<string, number> = { kW: 1000, Wh: 0.001, "m³": 1000 };

// Sums the values that exist; null when none do, so "unavailable" never shows as 0.
const total = (values: (number | undefined)[]) =>
  values.some((value) => value !== undefined)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

export function summarize(
  entities: Entities,
  current: Record<string, HaState>,
  midnight: Record<string, HaState>,
  gasPrice: number | null,
): Reading {
  const factor = (id: string) =>
    FACTOR[current[id]?.attributes?.unit_of_measurement ?? ""] ?? 1;
  // A total below its midnight value was reset (e.g. a "today" sensor), so count from zero.
  const today = (id: string) => {
    const now = num(current[id]);
    const then = num(midnight[id]);
    if (now === undefined || then === undefined) return undefined;
    return now >= then ? now - then : now;
  };
  const scale = (id: string, value?: number) =>
    value === undefined ? undefined : value * factor(id);
  const sum = (ids: string[]) => total(ids.map((id) => scale(id, num(current[id]))));
  const scaledToday = (ids: string[]) => total(ids.map((id) => scale(id, today(id))));
  const first = (ids: string[]) => num(current[ids[0]]) ?? null;

  const gasToday = total(entities.gas.map(today));
  const imported = scaledToday(entities.energyImport);
  const exported = scaledToday(entities.energyExport);
  const solar = scaledToday(entities.solar);

  return {
    power_w: sum(entities.power),
    energy_import_today: imported,
    energy_export_today: exported,
    solar_today: solar,
    gas_today: gasToday,
    water_today_l: scaledToday(entities.water),
    temperature: first(entities.temperature),
    battery_soc: first(entities.battery),
    gas_cost_today: gasToday === null || gasPrice === null ? null : gasToday * gasPrice,
    grid_net_today: total([imported ?? undefined, exported === null ? undefined : -exported]),
    // Share of today's solar production used at home (including charging the battery) instead of exported.
    solar_self_consumed_pct:
      solar && exported !== null ? Math.min(Math.max((solar - exported) / solar, 0), 1) * 100 : null,
  };
}

// Prefers Met.no's default weather.forecast_* entity over other weather integrations.
export const pickWeather = (states: HaState[]) =>
  (states.find((state) => state.entity_id.startsWith("weather.forecast_")) ??
    states.find((state) => state.entity_id.startsWith("weather.")))?.entity_id;

export interface RegistryEntry {
  entity_id: string;
  device_id: string | null;
}

// Grid power from the meter device itself, for an Energy dashboard without a grid power sensor.
export const pickDevicePower = (meter: string | undefined, registry: RegistryEntry[], states: HaState[]) => {
  const device = registry.find((entry) => entry.entity_id === meter)?.device_id;
  if (!device) return undefined;
  const onDevice = new Set(registry.filter((entry) => entry.device_id === device).map((entry) => entry.entity_id));
  return states
    .filter((state) => onDevice.has(state.entity_id) && state.attributes?.device_class === "power")
    .filter((state) => /^k?W$/.test(state.attributes?.unit_of_measurement ?? ""))
    .map((state) => state.entity_id)
    .sort((a, b) => a.length - b.length)[0];
};
