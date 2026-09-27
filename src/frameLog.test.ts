import assert from "node:assert/strict";
import { test } from "node:test";

import { logBlockedFrame } from "./frameLog.ts";

test("blocked iframe parents are logged once each", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const frame = (referer: string, dest = "iframe") =>
    logBlockedFrame(new Headers({ "sec-fetch-dest": dest, referer }), "http://display:9123", [
      "'self'",
      "http://homeassistant.local:8123",
    ]);

  frame("http://homeassistant.local:8123/lovelace/0");
  frame("http://display:9123/");
  frame("http://192.168.1.50:8123/lovelace/0", "document");
  assert.equal(warn.mock.callCount(), 0);

  frame("http://192.168.1.50:8123/lovelace/0");
  frame("http://192.168.1.50:8123/other");
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /http:\/\/192\.168\.1\.50:8123/);
});
