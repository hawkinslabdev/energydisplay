import { readFile, rename, writeFile } from "node:fs/promises";
import { get } from "node:https";

import type { Entities, HaState, Statistics } from "./summarize.ts";

const env = process.env;

// https://api-documentation.homewizard.com/docs/v2/authorization, valid until 2031-12-16
const CA = `-----BEGIN CERTIFICATE-----
MIIDITCCAgkCFDn7cwYLioTM3VxdAygLl/Px9ovFMA0GCSqGSIb3DQEBCwUAME0x
CzAJBgNVBAYTAk5MMQswCQYDVQQIDAJaSDETMBEGA1UECgwKSG9tZVdpemFyZDEc
MBoGA1UEAwwTQXBwbGlhbmNlIEFjY2VzcyBDQTAeFw0yMTEyMTgxOTEyMTJaFw0z
MTEyMTYxOTEyMTJaME0xCzAJBgNVBAYTAk5MMQswCQYDVQQIDAJaSDETMBEGA1UE
CgwKSG9tZVdpemFyZDEcMBoGA1UEAwwTQXBwbGlhbmNlIEFjY2VzcyBDQTCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAPBIvW8NRffqdvzHZY0M32fQHiGm
pJgNGhiaQmpJfRDhT9yihM0S/hYcN8IqnfrMqoCQb/56Ub0+dZizmtfcGsE+Lpm1
K1znkWqSDlpnuTNOb70TrsxBmbFuNOZQEi/xOjzT2j98wT0GSfxz1RVq6lZhDRRz
xoe08+Xo4+ttUGanfOggJi0BXygeFEVBpbctVVJ9EgqeEE9itjcMlcxMe1QN14f8
hCcOnId+9PSsdmyUCLrTB0FVYrbNfbJPk/vMU57fu6swBjWhYBxPx9ZhFy+7WnPR
9BFg4seHNVQIqZNrf1YwBXlmZQIL32SRPaiH/+AVNMrYGXBvncY0Km6ZHIMCAwEA
ATANBgkqhkiG9w0BAQsFAAOCAQEA6ybM8xm0PCXg8Rr/q0v1vPxQy44PmwXTDj0e
r2vW4ZMiEwXZCp0Kk2K16KJYz4iJyfiQk8ikAIMiRSbyXzmyQ7XmL1O4l4d8E1Pg
8EImvcyoBxFhd0Lq7VKriLc8Bw8SXbahPMGT+Y8Yz0uIsLAYVwlkLfgppVPmBaLD
QautcQnI8WxPvCIQf5anyzgAyJC5ac6/CkB+iyPcuWcG3RMYvXnC0QoTlRa5YMlE
FweVDlT2C/MdDyOxiAD/H1EP/eaySnU0zsxyD0yNFRKsQfQ+UJEPd2GS1AGA1lTy
CGdyYj/Gghrusw0hM4rYXQSERWGF0mpEnuJ+7bHDolHu0rzgTQ==
-----END CERTIFICATE-----`;

// v1 /api/v1/data or v2 /api/measurement
export interface Measurement {
  power_w?: number | null;
  active_power_w?: number | null;
  energy_import_kwh?: number | null;
  total_power_import_kwh?: number | null;
  energy_export_kwh?: number | null;
  total_power_export_kwh?: number | null;
  total_gas_m3?: number | null;
  external?: { type: string; value: number | null; unit: string }[];
}

const COUNTERS = ["p1.energy_import", "p1.energy_export", "p1.gas", "p1.water"];
const POWER = "p1.power";

// only fields the meter reports become entities; null marks a reported but unavailable value
export function toStates(m: Measurement) {
  const external = (type: string) => m.external?.find((device) => device.type === type);
  const gas = external("gas_meter");
  const water = external("water_meter");
  const fields: [keyof Entities, string, number | null | undefined, string][] = [
    ["power", POWER, m.power_w ?? m.active_power_w, "W"],
    ["energyImport", "p1.energy_import", m.energy_import_kwh ?? m.total_power_import_kwh, "kWh"],
    ["energyExport", "p1.energy_export", m.energy_export_kwh ?? m.total_power_export_kwh, "kWh"],
    ["gas", "p1.gas", gas ? gas.value : m.total_gas_m3, "m³"],
    ["water", "p1.water", water?.value, "m³"],
  ];
  const entities: Partial<Entities> = {};
  const states: Record<string, HaState> = {};
  for (const [key, id, value, unit] of fields) {
    if (value === undefined) continue;
    entities[key] = [id];
    if (value !== null) states[id] = { entity_id: id, state: String(value), attributes: { unit_of_measurement: unit } };
  }
  return { entities, states };
}

// per local midnight (ms): first and last counter readings, power extremes
type Day = Record<string, { first: number; last: number } | { min: number; max: number }>;
export type History = Record<string, Day>;

const DAY_MS = 86_400_000;
const shift = (midnight: number, days: number) => new Date(midnight).setDate(new Date(midnight).getDate() + days);

export function record(history: History, midnight: number, states: Record<string, HaState>) {
  const day = (history[midnight] ??= {});
  for (const [id, state] of Object.entries(states)) {
    const value = Number(state.state);
    const entry = day[id] as { first: number; last: number; min: number; max: number } | undefined;
    if (id === POWER) day[id] = { min: Math.min(entry?.min ?? value, value), max: Math.max(entry?.max ?? value, value) };
    else day[id] = { first: entry?.first ?? value, last: value };
  }
  // last year ±15 days is the oldest reference period
  for (const key of Object.keys(history)) if (Number(key) < shift(midnight, -381)) delete history[key];
}

// today as one live row; past days in the reference periods of route.ts referenceDays
export function statistics(history: History, midnight: number) {
  const change = (start: number, id: string) => {
    const today = history[start]?.[id] as { first: number; last: number } | undefined;
    const before = history[shift(start, -1)]?.[id] as { last: number } | undefined;
    // yesterday's last reading, so usage while the display was off still counts
    return today && today.last - (before?.last ?? today.first);
  };
  const inPeriod = (start: number) =>
    (start >= shift(midnight, -30) && start < midnight) ||
    Math.abs(start - shift(midnight, -365)) <= 15 * DAY_MS;
  const today: Statistics = {};
  const days: Statistics = {};
  for (const id of COUNTERS) {
    const value = change(midnight, id);
    if (value !== undefined) today[id] = [{ start: midnight, change: value }];
  }
  for (const start of Object.keys(history).map(Number).filter(inPeriod)) {
    for (const [id, entry] of Object.entries(history[start])) {
      const row = "max" in entry ? { start, max: entry.max, min: entry.min } : { start, change: change(start, id) };
      (days[id] ??= []).push(row);
    }
  }
  return { today, days };
}

const FIVE_MINUTES = 300_000;
export type Samples = { day: number; buckets: Record<number, { sum: number; count: number }> };

// ponytail: in memory, so the timeline restarts with the server; persist in History if that matters
export function addSample(samples: Samples, midnight: number, now: number, watts: number | undefined): Statistics {
  if (samples.day !== midnight) Object.assign(samples, { day: midnight, buckets: {} });
  if (watts !== undefined) {
    const bucket = (samples.buckets[now - (now % FIVE_MINUTES)] ??= { sum: 0, count: 0 });
    bucket.sum += watts;
    bucket.count++;
  }
  return { [POWER]: Object.entries(samples.buckets).map(([start, { sum, count }]) => ({ start: Number(start), mean: sum / count })) };
}

async function fetchMeter(): Promise<Measurement> {
  const host = env.HOMEWIZARD_HOST;
  if (!env.HOMEWIZARD_TOKEN) {
    const response = await fetch(`http://${host}/api/v1/data`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HomeWizard v1: HTTP ${response.status}`);
    return response.json();
  }
  return new Promise((resolve, reject) => {
    const request = get(`https://${host}/api/measurement`, {
      headers: { Authorization: `Bearer ${env.HOMEWIZARD_TOKEN}`, "X-Api-Version": "2" },
      ca: CA,
      // ponytail: any homewizard device passes; check the serial in cert.subject if that matters
      checkServerIdentity: () => undefined,
      timeout: 10_000,
    }, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        if (response.statusCode === 401) reject(new Error("HomeWizard rejected HOMEWIZARD_TOKEN"));
        else if (response.statusCode !== 200) reject(new Error(`HomeWizard v2: HTTP ${response.statusCode}`));
        else {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("HomeWizard timed out")));
    request.on("error", reject);
  });
}

const FILE = env.DATA_DIR && `${env.DATA_DIR}/homewizard.json`;
const WRITE_MS = 5 * 60_000;
let history: Promise<History> | undefined;
let written = { at: 0, day: 0 };
const samples: Samples = { day: 0, buckets: {} };

// without DATA_DIR, today restarts from the first reading
const load = async (): Promise<History> => {
  if (!FILE) {
    console.warn("DATA_DIR is not set; daily totals reset on restart");
    return {};
  }
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ FILE, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn(`Ignoring ${FILE}: ${(error as Error).message}`);
    return {};
  }
};

// written on a new day and every 5 minutes, to spare sd cards
async function save(data: History, midnight: number) {
  if (!FILE || (written.day === midnight && Date.now() - written.at < WRITE_MS)) return;
  written = { at: Date.now(), day: midnight };
  try {
    await writeFile(/*turbopackIgnore: true*/ `${FILE}.tmp`, JSON.stringify(data));
    await rename(/*turbopackIgnore: true*/ `${FILE}.tmp`, FILE);
  } catch (error) {
    console.warn(`Could not write ${FILE}: ${(error as Error).message}`);
  }
}

export async function readHomeWizard(midnight: Date) {
  const { entities, states } = toStates(await fetchMeter());
  const data = await (history ??= load());
  record(data, midnight.getTime(), states);
  await save(data, midnight.getTime());
  const watts = states[POWER] && Number(states[POWER].state);
  return { entities, states, ...statistics(data, midnight.getTime()), samples: addSample(samples, midnight.getTime(), Date.now(), watts) };
}
