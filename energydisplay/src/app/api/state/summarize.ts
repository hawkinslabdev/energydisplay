import { type Flows, peak, selfSufficiencyPct, solarConsumedPct, typical } from "./metrics.ts";

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
  solarPower: string[];
  gas: string[];
  water: string[];
  temperature: string[];
  battery: string[];
  batteryPower: string[];
  batteryIn: string[];
  batteryOut: string[];
  gasCost: string[];
  electricityCost: string[];
  electricityCompensation: string[];
}

// null means not configured, or no usable state in Home Assistant.
export interface Reading {
  power_w: number | null;
  energy_import_today: number | null;
  energy_export_today: number | null;
  solar_today: number | null;
  solar_power_w: number | null;
  gas_today: number | null;
  water_today_l: number | null;
  temperature: number | null;
  battery_soc: number | null;
  battery_power_w: number | null;
  gas_cost_today: number | null;
  gas_price: number | null;
  electricity_cost_today: number | null;
  grid_net_today: number | null;
  solar_self_consumed_pct: number | null;
  self_sufficiency_pct: number | null;
  // full scale per field from last 30 days and season last year
  ranges: Partial<Record<keyof Reading, number>>;
}

// hourly change rows from recorder/statistics_during_period by statistic id
type Row = { start: number; change?: number | null; max?: number | null; min?: number | null };
export type Statistics = Record<string, Row[]>;

interface EnergySource {
  type: string;
  stat_energy_from?: string | null;
  stat_energy_to?: string | null;
  stat_cost?: string | null;
  stat_compensation?: string | null;
  stat_rate?: string;
  stat_soc?: string;
  number_energy_price?: number | null;
}

export const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

// costSensors is energy/info cost_sensors: the cost entity home assistant made per meter
export function fromPrefs(prefs: { energy_sources: EnergySource[] }, costSensors: Record<string, string> = {}) {
  const valid = (id: unknown): id is string => typeof id === "string" && ENTITY_ID.test(id);
  const pick = (type: string, key: keyof EnergySource) =>
    prefs.energy_sources
      .filter((source) => source.type === type)
      .map((source) => source[key])
      .filter(valid);
  // stat_cost, else the generated cost sensor, as the home assistant frontend does
  const cost = (type: string, key: "stat_cost" | "stat_compensation", meter: "stat_energy_from" | "stat_energy_to") =>
    prefs.energy_sources
      .filter((source) => source.type === type)
      .map((source) => source[key] || costSensors[source[meter] ?? ""])
      .filter(valid);
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
      batteryIn: pick("battery", "stat_energy_to"),
      batteryOut: pick("battery", "stat_energy_from"),
      gasCost: cost("gas", "stat_cost", "stat_energy_from"),
      electricityCost: cost("grid", "stat_cost", "stat_energy_from"),
      electricityCompensation: cost("grid", "stat_compensation", "stat_energy_to"),
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
  statistics: Statistics,
  gasPrice: number | null,
  days: Statistics = {},
  electricity: { price: number; compensation: number } | null = null,
): Reading {
  const factor = (id: string) =>
    FACTOR[current[id]?.attributes?.unit_of_measurement ?? ""] ?? 1;
  const rows = (id: string) => statistics[id] ?? [];
  // completed hours since midnight, like home assistant
  const today = (id: string) =>
    rows(id).length ? rows(id).reduce((sum, row) => sum + (row.change ?? 0), 0) : undefined;
  const scale = (id: string, value?: number) =>
    value === undefined ? undefined : value * factor(id);
  const sum = (ids: string[]) => total(ids.map((id) => scale(id, num(current[id]))));
  const scaledToday = (ids: string[]) => total(ids.map((id) => scale(id, today(id))));
  const first = (ids: string[]) => num(current[ids[0]]) ?? null;
  // per period start, the sum over ids of a row value
  const byStart = (source: Statistics, ids: string[], value: (id: string, row: Row) => number) => {
    const sums = new Map<number, number>();
    for (const id of ids) for (const row of source[id] ?? []) sums.set(row.start, (sums.get(row.start) ?? 0) + value(id, row));
    return sums;
  };
  const change = (id: string, row: Row) => (row.change ?? 0) * factor(id);

  const gasToday = total(entities.gas.map(today));
  // cost statistics from home assistant, else gas times GAS_PRICE
  const gasCost = total(entities.gasCost.map(today))
    ?? (gasToday === null || gasPrice === null ? null : gasToday * gasPrice);
  const imported = scaledToday(entities.energyImport);
  const exported = scaledToday(entities.energyExport);
  // cost statistics from home assistant, else import and export at ELECTRICITY_PRICE
  const electricityCost = total([
    ...entities.electricityCost.map(today),
    ...entities.electricityCompensation.map((id) => today(id) === undefined ? undefined : -today(id)!),
  ]) ?? (electricity && imported !== null ? imported * electricity.price - (exported ?? 0) * electricity.compensation : null);
  const solar = scaledToday(entities.solar);

  const flows = {
    from_grid: byStart(statistics, entities.energyImport, change),
    to_grid: byStart(statistics, entities.energyExport, change),
    solar: byStart(statistics, entities.solar, change),
    from_battery: byStart(statistics, entities.batteryOut, change),
    to_battery: byStart(statistics, entities.batteryIn, change),
  };
  const starts = [...new Set(Object.values(flows).flatMap((sums) => [...sums.keys()]))].sort((a, b) => a - b);
  const hours: Flows[] = starts.map((start) => ({
    from_grid: flows.from_grid.get(start) ?? 0,
    to_grid: flows.to_grid.get(start) ?? 0,
    solar: flows.solar.get(start) ?? 0,
    from_battery: flows.from_battery.get(start) ?? 0,
    to_battery: flows.to_battery.get(start) ?? 0,
  }));

  const gasScale = typical(byStart(days, entities.gas, (_, row) => row.change ?? 0).values());
  const ranges: Reading["ranges"] = {
    power_w: peak(byStart(days, entities.power, (id, row) => Math.max(Math.abs(row.max ?? 0), Math.abs(row.min ?? 0)) * factor(id)).values()),
    solar_today: typical(byStart(days, entities.solar, change).values()),
    gas_today: gasScale,
    water_today_l: typical(byStart(days, entities.water, change).values()),
    grid_net_today: typical(byStart(days, [...entities.energyImport, ...entities.energyExport], (id, row) =>
      (entities.energyExport.includes(id) ? -1 : 1) * change(id, row)).values()),
    gas_cost_today: typical(byStart(days, entities.gasCost, (_, row) => row.change ?? 0).values())
      ?? (gasScale && gasPrice ? gasScale * gasPrice : undefined),
    electricity_cost_today: typical(byStart(days, [...entities.electricityCost, ...entities.electricityCompensation], (id, row) =>
      (entities.electricityCompensation.includes(id) ? -1 : 1) * (row.change ?? 0)).values())
      ?? (electricity ? typical(byStart(days, [...entities.energyImport, ...entities.energyExport], (id, row) =>
        (entities.energyExport.includes(id) ? -electricity.compensation : electricity.price) * change(id, row)).values()) : undefined),
  };

  return {
    power_w: sum(entities.power),
    energy_import_today: imported,
    energy_export_today: exported,
    solar_today: solar,
    solar_power_w: sum(entities.solarPower),
    gas_today: gasToday,
    water_today_l: scaledToday(entities.water),
    temperature: first(entities.temperature),
    battery_soc: first(entities.battery),
    battery_power_w: sum(entities.batteryPower),
    gas_cost_today: gasCost,
    gas_price: gasPrice,
    electricity_cost_today: electricityCost,
    grid_net_today: total([imported ?? undefined, exported === null ? undefined : -exported]),
    solar_self_consumed_pct: solar === null || exported === null ? null : solarConsumedPct(hours),
    self_sufficiency_pct: imported === null ? null : selfSufficiencyPct(hours),
    ranges: Object.fromEntries(Object.entries(ranges).filter(([, value]) => value)),
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
