import assert from "node:assert/strict";
import { test } from "node:test";

import { type History, addSample, record, statistics, toStates } from "./homewizard.ts";

const day = (offset: number) => new Date(2026, 8, 27 + offset).getTime();
const at = (values: Record<string, number>) =>
  Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { entity_id: id, state: String(value) }]));

test("v2 measurement maps to meter entities", () => {
  const { entities, states } = toStates({
    power_w: -291,
    energy_import_kwh: 8285.891,
    energy_export_kwh: 7812.461,
    external: [{ type: "gas_meter", value: 2579.825, unit: "m3" }],
  });
  assert.deepEqual(entities, { power: ["p1.power"], energyImport: ["p1.energy_import"], energyExport: ["p1.energy_export"], gas: ["p1.gas"] });
  assert.equal(states["p1.power"].state, "-291");
  assert.equal(states["p1.gas"].attributes?.unit_of_measurement, "m³");
});

test("v1 measurement uses legacy fields and external water", () => {
  const { entities, states } = toStates({
    active_power_w: 432,
    total_power_import_kwh: 100,
    total_power_export_kwh: 50,
    total_gas_m3: 20,
    external: [{ type: "water_meter", value: null, unit: "m3" }],
  });
  assert.deepEqual(entities.water, ["p1.water"]);
  // unavailable, yet the unit still scales today to litres
  assert.equal(states["p1.water"].state, "unavailable");
  assert.equal(states["p1.water"].attributes?.unit_of_measurement, "m³");
  assert.equal(states["p1.gas"].state, "20");
  assert.equal(states["p1.energy_import"].state, "100");
});

test("today counts from yesterday's last reading", () => {
  const history: History = {};
  record(history, day(-1), at({ "p1.energy_import": 10, "p1.power": 300 }));
  record(history, day(-1), at({ "p1.energy_import": 12, "p1.power": -800 }));
  record(history, day(0), at({ "p1.energy_import": 15, "p1.power": 100 }));
  record(history, day(0), at({ "p1.energy_import": 16 }));

  const { today, days } = statistics(history, day(0));
  assert.deepEqual(today, { "p1.energy_import": [{ start: day(0), change: 4 }] });
  assert.deepEqual(days, {
    "p1.energy_import": [{ start: day(-1), change: 2 }],
    "p1.power": [{ start: day(-1), max: 300, min: -800 }],
  });
});

test("reference days cover the last 30 days and last season, old days are pruned", () => {
  const history: History = { [day(-500)]: {}, [day(-365)]: {}, [day(-100)]: {} };
  record(history, day(0), at({ "p1.gas": 1 }));
  history[day(-365)]["p1.gas"] = { first: 1, last: 3 };
  history[day(-100)]["p1.gas"] = { first: 1, last: 9 };
  assert.equal(history[day(-500)], undefined);

  const { today, days } = statistics(history, day(0));
  assert.deepEqual(today, { "p1.gas": [{ start: day(0), change: 0 }] });
  assert.deepEqual(days, { "p1.gas": [{ start: day(-365), change: 2 }] });
});

test("last season spans 31 calendar days across a daylight saving change", () => {
  // 2025-10-26 falls between day -380 and day -365
  const today = new Date(2026, 10, 5).getTime();
  const history: History = {};
  for (let offset = -381; offset <= -349; offset++) {
    history[new Date(2026, 10, 5 + offset).getTime()] = { "p1.gas": { first: 0, last: 1 } };
  }
  assert.equal(statistics(history, today).days["p1.gas"].length, 31);
});

test("unavailable readings are not recorded", () => {
  const history: History = {};
  record(history, day(0), toStates({ power_w: null, energy_import_kwh: 5 }).states);
  assert.deepEqual(history[day(0)], { "p1.energy_import": { first: 5, last: 5 } });
});

test("power samples average per five minutes and reset at midnight", () => {
  const samples = { day: 0, buckets: {} };
  addSample(samples, 0, 1_000, 100);
  addSample(samples, 0, 2_000, 300);
  assert.deepEqual(addSample(samples, 0, 301_000, 50), { "p1.power": [{ start: 0, mean: 200 }, { start: 300_000, mean: 50 }] });
  assert.deepEqual(addSample(samples, 86_400_000, 86_401_000, undefined), { "p1.power": [] });
});
