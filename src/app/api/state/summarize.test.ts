import assert from "node:assert/strict";
import { test } from "node:test";

import { fromPrefs, pickDevicePower, pickWeather, summarize } from "./summarize.ts";

const s = (entity_id: string, state: string, unit?: string) => ({
  entity_id,
  state,
  attributes: { unit_of_measurement: unit },
});

const none = { power: [], energyImport: [], energyExport: [], solar: [], gas: [], water: [], temperature: [], battery: [], batteryIn: [], batteryOut: [], gasCost: [], electricityCost: [], electricityCompensation: [] };
const hours = (...changes: number[]) => changes.map((change, start) => ({ start, change }));

test("daily usage is the sum of hourly statistics", () => {
  const reading = summarize(
    { ...none, power: ["p"], energyImport: ["t1", "t2"], solar: ["s"], gas: ["g"], water: ["w"], temperature: ["t"], battery: ["b"] },
    {
      p: s("p", "0.812", "kW"),
      s: s("s", "1500", "Wh"),
      w: s("w", "301.125", "m³"),
      t: s("t", "unavailable"),
      b: s("b", "65"),
    },
    { t1: hours(4, 0.5), t2: hours(1), s: hours(0, 1500), g: hours(2, 0.25), w: hours(0.125) },
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
    gas_price: 2,
    electricity_cost_today: null,
    grid_net_today: 5.5,
    solar_self_consumed_pct: null,
    self_sufficiency_pct: (1 - 5.5 / 7) * 100,
    ranges: {},
  });
});

test("gauges match the home assistant energy dashboard", () => {
  const reading = summarize(
    { ...none, energyImport: ["i"], energyExport: ["e"], solar: ["s"], batteryOut: ["bo"], batteryIn: ["bi"] },
    { s: s("s", "10230", "Wh") },
    {
      i: hours(0.016, 0.023, 0.015, 0.019, 0.024, 0.015, 0.017, 0.018, 0.021, 0.032, 0.044, 0.065, 0.08, 0.119, 0.073),
      e: hours(0.006, 0.004, 0.003, 0.007, 0.005, 0.004, 0.004, 0.006, 0.005, 0.029, 0.059, 0.031, 0.085, 0.107, 1.201),
      s: hours(0, 0, 0, 0, 0, 0, 0, 0, 146, 696, 1655, 2003, 1913, 1306, 1860),
      bo: hours(0.172, 0.187, 0.193, 0.187, 0.162, 0.161, 0.16, 0.172, 0.035, 0.047, 0.211, 0.142, 0.008, 0.098, 0.139),
      bi: hours(0, 0, 0, 0, 0, 0, 0, 0, 0.048, 0.637, 0.787, 1.158, 1.207, 0.598, 0.037),
    },
    null,
  );
  assert.equal(reading.solar_today, 9.579);
  assert.equal(Math.round(reading.self_sufficiency_pct!), 91);
  assert.equal(Math.round(reading.solar_self_consumed_pct!), 74);
});

test("half scale is a typical day across reference periods", () => {
  const reading = summarize(
    { ...none, power: ["p"], energyImport: ["i"], energyExport: ["e"], solar: ["s"], gas: ["g"] },
    { p: s("p", "0.5", "kW"), s: s("s", "0", "Wh") },
    {},
    1.5,
    {
      p: [{ start: 0, max: 6.9, min: -2.6 }],
      i: [{ start: 0, change: 11 }, { start: 1, change: 2 }],
      e: [{ start: 0, change: 1 }, { start: 1, change: 14 }],
      s: [{ start: 0, change: 16500 }],
      // one outlier day barely moves the median
      g: [{ start: 0, change: 1 }, { start: 1, change: 2 }, { start: -365, change: 30 }],
    },
  );
  assert.deepEqual(reading.ranges, { power_w: 6900, solar_today: 33, gas_today: 4, grid_net_today: 22, gas_cost_today: 6 });
});

test("costs come from home assistant cost statistics", () => {
  const reading = summarize(
    { ...none, gas: ["g"], gasCost: ["gc"], electricityCost: ["c"], electricityCompensation: ["r"] },
    {},
    { g: hours(1), gc: hours(0.5, 1), c: hours(2, 1), r: hours(0.5) },
    9,
  );
  assert.equal(reading.gas_cost_today, 1.5);
  assert.equal(reading.electricity_cost_today, 2.5);
});

test("energy dashboard preferences map to entities", () => {
  const { entities, gasPrice } = fromPrefs({
    energy_sources: [
      { type: "grid", stat_energy_from: "sensor.t1", stat_energy_to: "sensor.r1", stat_rate: "sensor.power", stat_cost: "sensor.c1" },
      { type: "grid", stat_energy_from: "sensor.t2", stat_energy_to: null },
      { type: "solar", stat_energy_from: "sensor.solar" },
      { type: "battery", stat_energy_from: "sensor.bo", stat_energy_to: "sensor.bi", stat_soc: "sensor.soc" },
      { type: "gas", stat_energy_from: "sensor.gas", number_energy_price: 1.35 },
      { type: "water", stat_energy_from: "external:water" },
    ],
  }, { "sensor.r1": "sensor.r1_compensation", "sensor.t2": "sensor.t2_cost", "sensor.gas": "sensor.gas_cost" });

  assert.deepEqual(entities, {
    power: ["sensor.power"],
    energyImport: ["sensor.t1", "sensor.t2"],
    energyExport: ["sensor.r1"],
    solar: ["sensor.solar"],
    gas: ["sensor.gas"],
    water: [],
    battery: ["sensor.soc"],
    batteryIn: ["sensor.bi"],
    batteryOut: ["sensor.bo"],
    gasCost: ["sensor.gas_cost"],
    electricityCost: ["sensor.c1", "sensor.t2_cost"],
    electricityCompensation: ["sensor.r1_compensation"],
  });
  assert.equal(gasPrice, 1.35);
});

test("unconfigured or unavailable entities are null, not 0", () => {
  const reading = summarize({ ...none, power: ["p"], gas: ["g"] }, { p: s("p", "unavailable") }, { g: hours(2) }, null);
  assert.equal(reading.power_w, null);
  assert.equal(reading.water_today_l, null);
  assert.equal(reading.gas_today, 2);
  assert.equal(reading.gas_cost_today, null);
});

test("net grid and self-consumed solar without a battery", () => {
  const reading = summarize(
    { ...none, energyImport: ["i"], energyExport: ["e"], solar: ["s"] },
    {},
    { i: hours(1), e: hours(2), s: hours(8) },
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
