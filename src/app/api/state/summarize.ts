export interface HaState {
  entity_id: string;
  state: string;
  attributes?: { unit_of_measurement?: string };
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

export interface Reading {
  power_w: number;
  energy_import_today: number;
  energy_export_today: number;
  solar_today: number;
  gas_today: number;
  water_today_l: number;
  temperature: number;
  battery_soc: number;
  gas_cost_today: number;
}

interface EnergySource {
  type: string;
  stat_energy_from?: string | null;
  stat_energy_to?: string | null;
  stat_rate?: string;
  stat_soc?: string;
  number_energy_price?: number | null;
}

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

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

const num = (state?: HaState) => {
  const value = parseFloat(state?.state ?? "");
  return Number.isFinite(value) ? value : 0;
};

const FACTOR: Record<string, number> = { kW: 1000, Wh: 0.001, "m³": 1000 };

export function summarize(
  entities: Entities,
  current: Record<string, HaState>,
  midnight: Record<string, HaState>,
  gasPrice: number,
): Reading {
  const scaled = (id: string, value: number) =>
    value * (FACTOR[current[id]?.attributes?.unit_of_measurement ?? ""] ?? 1);
  const sum = (ids: string[]) =>
    ids.reduce((total, id) => total + scaled(id, num(current[id])), 0);
  // A total below its midnight value was reset (e.g. a "today" sensor), so count from zero.
  const delta = (id: string) =>
    num(current[id]) >= num(midnight[id]) ? num(current[id]) - num(midnight[id]) : num(current[id]);
  const today = (ids: string[]) =>
    ids.reduce((total, id) => (current[id] && midnight[id] ? total + delta(id) : total), 0);
  const scaledToday = (ids: string[]) =>
    ids.reduce((total, id) => total + scaled(id, today([id])), 0);
  const first = (ids: string[]) => num(current[ids[0]]);

  const gasToday = today(entities.gas);

  return {
    power_w: sum(entities.power),
    energy_import_today: scaledToday(entities.energyImport),
    energy_export_today: scaledToday(entities.energyExport),
    solar_today: scaledToday(entities.solar),
    gas_today: gasToday,
    water_today_l: scaledToday(entities.water),
    temperature: first(entities.temperature),
    battery_soc: first(entities.battery),
    gas_cost_today: gasToday * gasPrice,
  };
}
