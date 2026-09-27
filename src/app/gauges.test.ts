import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_BARS, DEFAULT_WHEELS, pickGauges } from "./gauges.ts";

const none = { power: [], energyImport: [], energyExport: [], solar: [], gas: [], water: [], temperature: [], battery: [], batteryIn: [], batteryOut: [] };

const defaults = [...DEFAULT_WHEELS, ...DEFAULT_BARS];
const unset = Array(defaults.length).fill(undefined);

test("unset positions skip options without entities", () => {
  const entities = { ...none, energyImport: ["i"], energyExport: ["e"], solar: ["s"], gas: ["g"] };
  assert.deepEqual(pickGauges(unset, defaults, entities), ["grid", "self_consumption", "gas", "gas_cost", "solar", "self_sufficiency", "battery"]);
  assert.deepEqual(pickGauges(["power", undefined, "bogus", undefined, "temperature"], defaults, entities).slice(0, 5), ["power", "grid", "gas", "gas_cost", "temperature"]);
  assert.deepEqual(pickGauges(unset, defaults, none), defaults);
});
