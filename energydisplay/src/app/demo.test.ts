import assert from "node:assert/strict";
import { test } from "node:test";

import { demoReading } from "./demo.ts";

test("demo daily totals never decrease during the day", () => {
  const fields = ["energy_import_today", "energy_export_today", "solar_today", "gas_today", "water_today_l"] as const;
  let previous = demoReading(new Date(2026, 0, 1, 0, 0));
  for (let minute = 10; minute < 24 * 60; minute += 10) {
    const reading = demoReading(new Date(2026, 0, 1, 0, minute));
    for (const field of fields) assert.ok(reading[field]! >= previous[field]!, `${field} at minute ${minute}`);
    previous = reading;
  }
});
