import type { Entities, Reading } from "./api/state/summarize.ts";
import { DEFAULT_BARS, type GaugeName } from "./gauges.ts";

// 0..1 progress of x through [from, to], eased like a daily curve
const ramp = (x: number, from: number, to: number) =>
  (1 - Math.cos(Math.PI * Math.min(Math.max((x - from) / (to - from), 0), 1))) / 2;

const entities: Entities = {
  power: ["sensor.demo_power"], energyImport: ["sensor.demo_import"], energyExport: ["sensor.demo_export"],
  solar: ["sensor.demo_solar"], solarPower: ["sensor.demo_solar_power"], gas: ["sensor.demo_gas"], water: ["sensor.demo_water"],
  temperature: ["weather.forecast_demo"], battery: ["sensor.demo_battery"], batteryPower: ["sensor.demo_battery_power"], batteryIn: [], batteryOut: [],
  gasCost: [], electricityCost: [], electricityCompensation: [],
};

// synthetic reading for the static demo, driven by the time of day
export function demoReading(now: Date) {
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const sun = Math.max(0, Math.sin((Math.PI * (hour - 7)) / 12));
  const load = 0.45 + 0.35 * ramp(hour, 17, 19) * (1 - ramp(hour, 21, 23)) + 0.2 * Math.random();

  const solar = 16 * ramp(hour, 7, 19);
  const exported = 0.55 * solar;
  const imported = 0.28 * Math.min(hour, 7) + 0.08 * Math.max(0, Math.min(hour, 19) - 7) + 0.6 * Math.max(0, hour - 19);
  const gas = 0.04 * hour + 0.25 * ramp(hour, 6, 8);
  const used = imported + solar - exported;

  const reading: Reading = {
    power_w: Math.round((load - 4.2 * sun) * 1000),
    energy_import_today: imported,
    energy_export_today: exported,
    solar_today: solar,
    solar_power_w: Math.round(4200 * sun),
    gas_today: gas,
    water_today_l: 9 * hour + 60 * ramp(hour, 7, 8),
    temperature: 14 + 6 * Math.sin((Math.PI * (hour - 9)) / 12),
    battery_soc: 20 + 75 * ramp(hour, 9, 15) * (1 - 0.7 * ramp(hour, 18, 24)),
    battery_power_w: hour >= 9 && hour < 15 ? -1600 * sun : hour >= 18 ? 900 : 0,
    gas_cost_today: gas * 1.35,
    gas_price: 1.35,
    electricity_cost_today: imported * 0.3 - exported * 0.08,
    grid_net_today: imported - exported,
    solar_self_consumed_pct: solar ? ((solar - exported) / solar) * 100 : null,
    self_sufficiency_pct: used > 0 ? (1 - Math.min(1, imported / used)) * 100 : null,
    ranges: { power_w: 6000, solar_today: 18, gas_today: 1.2, water_today_l: 250, grid_net_today: 8, gas_cost_today: 1.6, electricity_cost_today: 3 },
  };
  const wheels: GaugeName[] = ["power", "self_sufficiency", "gas"];
  return { ...reading, wheels, bars: DEFAULT_BARS, entities, unavailable: [] };
}
