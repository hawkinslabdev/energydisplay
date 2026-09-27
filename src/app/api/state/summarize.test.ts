import assert from "node:assert/strict";
import { test } from "node:test";

import { fromPrefs, pickDevicePower, pickWeather, summarize } from "./summarize.ts";

const s = (entity_id: string, state: string, unit?: string) => ({
  entity_id,
  state,
  attributes: { unit_of_measurement: unit },
});

test("daily usage is the difference with the value at midnight", () => {
  const reading = summarize(
    {
      power: ["p"],
      energyImport: ["t1", "t2"],
      energyExport: [],
      solar: ["s"],
      gas: ["g"],
      water: ["w"],
      temperature: ["t"],
      battery: ["b"],
    },
    {
      p: s("p", "0.812", "kW"),
      t1: s("t1", "1004.5"),
      t2: s("t2", "501"),
      s: s("s", "1500", "Wh"),
      g: s("g", "2502.25"),
      w: s("w", "301.125", "m³"),
      t: s("t", "unavailable"),
      b: s("b", "65"),
    },
    { s: s("s", "6100", "Wh"), t1: s("t1", "1000"), t2: s("t2", "500"), g: s("g", "2500"), w: s("w", "301") },
    2,
  );

  assert.deepEqual(reading, {
    power_w: 812,
    energy_import_today: 5.5,
    energy_export_today: null,
    solar_today: 1.5,
    gas_today: 2.25,
    water_today_l: 125,
    temperature: null,
    battery_soc: 65,
    gas_cost_today: 4.5,
    grid_net_today: 5.5,
    solar_self_consumed_pct: null,
  });
});

test("energy dashboard preferences map to entities", () => {
  const { entities, gasPrice } = fromPrefs({
    energy_sources: [
      { type: "grid", stat_energy_from: "sensor.t1", stat_energy_to: "sensor.r1", stat_rate: "sensor.power" },
      { type: "grid", stat_energy_from: "sensor.t2", stat_energy_to: null },
      { type: "solar", stat_energy_from: "sensor.solar" },
      { type: "battery", stat_energy_from: "sensor.bo", stat_energy_to: "sensor.bi", stat_soc: "sensor.soc" },
      { type: "gas", stat_energy_from: "sensor.gas", number_energy_price: 1.35 },
      { type: "water", stat_energy_from: "external:water" },
    ],
  });

  assert.deepEqual(entities, {
    power: ["sensor.power"],
    energyImport: ["sensor.t1", "sensor.t2"],
    energyExport: ["sensor.r1"],
    solar: ["sensor.solar"],
    gas: ["sensor.gas"],
    water: [],
    battery: ["sensor.soc"],
  });
  assert.equal(gasPrice, 1.35);
});

test("unconfigured or unavailable entities are null, not 0", () => {
  const none = { power: [], energyImport: [], energyExport: [], solar: [], gas: [], water: [], temperature: [], battery: [] };
  const reading = summarize({ ...none, power: ["p"], gas: ["g"] }, { p: s("p", "unavailable"), g: s("g", "3") }, { g: s("g", "1") }, null);
  assert.equal(reading.power_w, null);
  assert.equal(reading.water_today_l, null);
  assert.equal(reading.gas_today, 2);
  assert.equal(reading.gas_cost_today, null);
});

test("net grid and self-consumed solar", () => {
  const none = { power: [], energyImport: [], energyExport: [], solar: [], gas: [], water: [], temperature: [], battery: [] };
  const reading = summarize(
    { ...none, energyImport: ["i"], energyExport: ["e"], solar: ["s"] },
    { i: s("i", "11"), e: s("e", "13"), s: s("s", "8") },
    { i: s("i", "10"), e: s("e", "11"), s: s("s", "0") },
    null,
  );
  assert.equal(reading.grid_net_today, -1);
  assert.equal(reading.solar_self_consumed_pct, 75);
});

test("weather entities provide temperature", () => {
  const states = [
    { entity_id: "weather.buienradar", state: "cloudy", attributes: { temperature: 18.3 } },
    { entity_id: "weather.forecast_home", state: "sunny", attributes: { temperature: 17.1 } },
  ];
  assert.equal(pickWeather(states), "weather.forecast_home");
  assert.equal(pickWeather([states[0]]), "weather.buienradar");
  const none = { power: [], energyImport: [], energyExport: [], solar: [], gas: [], water: [], temperature: [], battery: [] };
  const reading = summarize({ ...none, temperature: ["weather.forecast_home"] }, { "weather.forecast_home": states[1] }, {}, null);
  assert.equal(reading.temperature, 17.1);
});

test("grid power falls back to the meter device's total power sensor", () => {
  const registry = [
    { entity_id: "sensor.p1_import", device_id: "p1" },
    { entity_id: "sensor.p1_active_power", device_id: "p1" },
    { entity_id: "sensor.p1_active_power_l1", device_id: "p1" },
    { entity_id: "sensor.p1_voltage", device_id: "p1" },
    { entity_id: "sensor.other_power", device_id: "other" },
  ];
  const power = (entity_id: string, unit = "W") => ({ entity_id, state: "1", attributes: { device_class: "power", unit_of_measurement: unit } });
  const states = [
    power("sensor.p1_active_power_l1"),
    power("sensor.p1_active_power"),
    { entity_id: "sensor.p1_voltage", state: "230", attributes: { device_class: "voltage", unit_of_measurement: "V" } },
    power("sensor.other_power"),
  ];
  assert.equal(pickDevicePower("sensor.p1_import", registry, states), "sensor.p1_active_power");
  assert.equal(pickDevicePower("sensor.unknown", registry, states), undefined);
});
