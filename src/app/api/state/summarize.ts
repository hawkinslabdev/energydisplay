export interface HaState {
  entity_id: string;
  state: string;
  attributes?: { unit_of_measurement?: string };
}

export interface Entities {
  power?: string;
  energyImport?: string;
  energyExport?: string;
  gas?: string;
  water?: string;
  temperature?: string;
  battery?: string;
}

export interface Reading {
  power_w: number;
  energy_import_today: number;
  energy_export_today: number;
  gas_today: number;
  water_today_l: number;
  temperature: number;
  battery_soc: number;
  gas_cost_today: number;
}

const num = (state?: HaState) => {
  const value = parseFloat(state?.state ?? "");
  return Number.isFinite(value) ? value : 0;
};

export function summarize(
  entities: Entities,
  current: Record<string, HaState>,
  midnight: Record<string, HaState>,
  gasPrice: number,
): Reading {
  const get = (id?: string) => (id ? current[id] : undefined);
  const today = (id?: string) =>
    id && current[id] && midnight[id]
      ? Math.max(0, num(current[id]) - num(midnight[id]))
      : 0;

  const water = get(entities.water);
  const waterFactor = water?.attributes?.unit_of_measurement === "m³" ? 1000 : 1;
  const gasToday = today(entities.gas);

  return {
    power_w: num(get(entities.power)),
    energy_import_today: today(entities.energyImport),
    energy_export_today: today(entities.energyExport),
    gas_today: gasToday,
    water_today_l: today(entities.water) * waterFactor,
    temperature: num(get(entities.temperature)),
    battery_soc: num(get(entities.battery)),
    gas_cost_today: gasToday * gasPrice,
  };
}
