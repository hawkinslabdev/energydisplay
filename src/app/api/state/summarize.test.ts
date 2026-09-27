import assert from "node:assert/strict";
import { test } from "node:test";

import { summarize } from "./summarize.ts";

const s = (entity_id: string, state: string, unit?: string) => ({
  entity_id,
  state,
  attributes: { unit_of_measurement: unit },
});

test("daily usage is the difference with the value at midnight", () => {
  const reading = summarize(
    { power: "p", energyImport: "i", gas: "g", water: "w", temperature: "t", battery: "b" },
    {
      p: s("p", "812"),
      i: s("i", "1004.5"),
      g: s("g", "2502.25"),
      w: s("w", "301.125", "m³"),
      t: s("t", "unavailable"),
      b: s("b", "65"),
    },
    { i: s("i", "1000"), g: s("g", "2500"), w: s("w", "301") },
    2,
  );

  assert.deepEqual(reading, {
    power_w: 812,
    energy_import_today: 4.5,
    energy_export_today: 0,
    gas_today: 2.25,
    water_today_l: 125,
    temperature: 0,
    battery_soc: 65,
    gas_cost_today: 4.5,
  });
});
