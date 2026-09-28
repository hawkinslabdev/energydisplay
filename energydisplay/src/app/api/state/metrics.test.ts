import assert from "node:assert/strict";
import { test } from "node:test";

import { powerFlows } from "./metrics.ts";

test("live power splits into paths between grid, solar, battery and home", () => {
  assert.deepEqual(powerFlows(500, 0, 0), {
    home: 500, solar_home: 0, solar_grid: 0, solar_battery: 0, grid_home: 500, grid_battery: 0, battery_home: 0, battery_grid: 0,
  });
  const exporting = powerFlows(-1000, 1500, 0);
  assert.equal(exporting.solar_grid, 1000);
  assert.equal(exporting.solar_home, 500);
  const charging = powerFlows(0, 2000, -1500);
  assert.equal(charging.solar_battery, 1500);
  assert.equal(charging.home, 500);
  const discharging = powerFlows(-200, 0, 700);
  assert.equal(discharging.battery_grid, 200);
  assert.equal(discharging.battery_home, 500);
  assert.equal(discharging.grid_home, 0);
});
