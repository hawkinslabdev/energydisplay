import assert from "node:assert/strict";
import { test } from "node:test";

import { fromPrefs, summarize } from "./summarize.ts";

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
    energy_export_today: 0,
    solar_today: 1.5,
    gas_today: 2.25,
    water_today_l: 125,
    temperature: 0,
    battery_soc: 65,
    gas_cost_today: 4.5,
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
