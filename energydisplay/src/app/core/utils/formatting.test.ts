import assert from "node:assert/strict";
import { test } from "node:test";

import { powerNote } from "./formatting.ts";

test("power notes stay short", () => {
    assert.equal(powerNote(338), "↓ 338 W");
    assert.equal(powerNote(999.6), "↓ 1.0 kW");
    assert.equal(powerNote(1234), "↓ 1.2 kW");
    assert.equal(powerNote(-1500), "↑ 1.5 kW");
    assert.equal(powerNote(12), undefined);
    assert.equal(powerNote(null), undefined);
});
