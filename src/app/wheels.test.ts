import assert from "node:assert/strict";
import { test } from "node:test";

import { pickWheels } from "./wheels.ts";

const none = { power: [], energyImport: [], energyExport: [], solar: [], gas: [], water: [], temperature: [], battery: [] };

test("unset wheels skip options without entities", () => {
  const entities = { ...none, energyImport: ["i"], energyExport: ["e"], solar: ["s"], gas: ["g"] };
  assert.deepEqual(pickWheels([undefined, undefined, undefined], entities), ["grid", "solar", "gas"]);
  assert.deepEqual(pickWheels(["power", undefined, "bogus"], entities), ["power", "grid", "gas"]);
  assert.deepEqual(pickWheels([undefined, undefined, undefined], none), ["power", "water", "gas"]);
});
