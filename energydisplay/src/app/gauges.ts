import type { Entities, Reading } from "./api/state/summarize";

export interface Gauge {
    field: keyof Reading;
    note?: { field: "battery_power_w" | "solar_power_w"; detail: string };
    /** Stroke paths on a 24x24 grid. */
    icon: string[];
    /** Entities the gauge needs; missing entities cause the gauge to be skipped. */
    requires: (keyof Entities)[];
    /** Full scale fallback when daily statistics are unavailable. */
    maxValue: number;
    unit: string;
    background: string;
    highlight: string;
    title: string;
    detail: string;
    /** Environment variables that feed the gauge. */
    source: string;
}

export const GAUGES = {
    power: {
        field: "power_w",
        icon: ["M13 2 3 14h9l-1 8 10-12h-9l1-8z"], requires: ["power"], maxValue: 5000, unit: "w", background: "#2c134d", highlight: "#8d37ff",
        title: "Current power",
        detail: "Real-time power flowing into or out of the home.",
        source: "POWER",
    },
    water: {
        field: "water_today_l",
        icon: ["M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"], requires: ["water"], maxValue: 100, unit: "L", background: "#1b3b50", highlight: "#3dbfff",
        title: "Water today",
        detail: "Total water usage recorded since midnight. Midpoint benchmark: typical day of the last 30 days and the same season last year.",
        source: "WATER",
    },
    gas: {
        field: "gas_today",
        icon: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"], requires: ["gas"], maxValue: 10, unit: "m3", background: "#501228", highlight: "#fd2d86",
        title: "Gas today",
        detail: "Total gas consumption recorded since midnight. Midpoint benchmark: typical day of the last 30 days and the same season last year.",
        source: "GAS",
    },
    grid: {
        field: "grid_net_today",
        icon: ["M7 20V4", "M3 8l4-4 4 4", "M17 4v16", "M13 16l4 4 4-4"], requires: ["energyImport", "energyExport"], maxValue: 20, unit: "kWh", background: "#1f2a50", highlight: "#6d8bff",
        title: "Net grid today",
        detail: "Net imported from the grid (positive) or net exported to the grid (negative) since midnight. Midpoint benchmark: typical day of the last 30 days and the same season last year.",
        source: "ENERGY_IMPORT − ENERGY_EXPORT",
    },
    solar: {
        field: "solar_today",
        icon: ["M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z", "M12 2v2", "M12 20v2", "M4.93 4.93l1.41 1.41", "M17.66 17.66l1.41 1.41", "M2 12h2", "M20 12h2", "M6.34 17.66l-1.41 1.41", "M19.07 4.93l-1.41 1.41"], requires: ["solar"], maxValue: 35, unit: "kWh", background: "#314d2c", highlight: "#5fda35",
        note: { field: "solar_power_w", detail: "With current production." },
        title: "Solar today",
        detail: "Total solar energy generated since midnight. Midpoint benchmark: typical day of the last 30 days and the same season last year.",
        source: "SOLAR, optional SOLAR_POWER",
    },
    self_consumption: {
        field: "solar_self_consumed_pct",
        icon: ["M3 11l9-8 9 8", "M5 9.5V21h14V9.5", "M15 15.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"], requires: ["solar", "energyExport"], maxValue: 100, unit: "%", background: "#1f4630", highlight: "#7fd49b",
        title: "Self-consumed solar energy",
        detail: "Share of today's solar energy used by the home instead of exported to the grid. Solar energy stored in the battery counts when the home uses it.",
        source: "SOLAR, ENERGY_EXPORT, battery in the Home Assistant Energy dashboard",
    },
    self_sufficiency: {
        field: "self_sufficiency_pct",
        icon: ["M3 11l9-8 9 8", "M5 9.5V21h14V9.5", "M12 18v-6", "M9 15l3-3 3 3"], requires: ["energyImport", "solar"], maxValue: 100, unit: "%", background: "#1f4630", highlight: "#7fd49b",
        title: "Self-sufficiency",
        detail: "Share of today's home electricity from on-site sources (solar panels, batteries).",
        source: "ENERGY_IMPORT, ENERGY_EXPORT, SOLAR, battery in the Home Assistant Energy dashboard",
    },
    gas_cost: {
        field: "gas_cost_today",
        icon: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"], requires: ["gas"], maxValue: 10, unit: "€", background: "#595959", highlight: "#ffffff",
        title: "Gas cost today",
        detail: "Gas cost since midnight, from Home Assistant cost statistics or the configured rate. Midpoint benchmark: typical day of the last 30 days and the same season last year.",
        source: "Gas price in the Home Assistant Energy dashboard, or GAS × GAS_PRICE",
    },
    electricity_cost: {
        field: "electricity_cost_today",
        icon: ["M4 10h12", "M4 14h9", "M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"], requires: ["energyImport"], maxValue: 10, unit: "€", background: "#4d4213", highlight: "#ffd23f",
        title: "Electricity cost today",
        detail: "Grid import cost minus export compensation since midnight, from Home Assistant cost statistics or the configured rates. Midpoint benchmark: typical day of the last 30 days and the same season last year.",
        source: "Grid prices in the Home Assistant Energy dashboard, or ENERGY_IMPORT × ELECTRICITY_PRICE − ENERGY_EXPORT × ELECTRICITY_COMPENSATION",
    },
    temperature: {
        field: "temperature",
        icon: ["M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"], requires: ["temperature"], maxValue: 50, unit: "°C", background: "#59382b", highlight: "#ff7600",
        title: "Temperature",
        detail: "Current temperature from the configured sensor or weather integration.",
        source: "TEMPERATURE",
    },
    battery: {
        field: "battery_soc",
        icon: ["M3 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", "M23 13v-2"], requires: ["battery"], maxValue: 100, unit: "%", background: "#1b4d3e", highlight: "#2ee6a6",
        note: { field: "battery_power_w", detail: "With charge (↑) or discharge (↓) power." },
        title: "Battery",
        detail: "Current battery state of charge.",
        source: "BATTERY, optional BATTERY_POWER",
    },
} satisfies Record<string, Gauge>;

export type GaugeName = keyof typeof GAUGES;

export const DEFAULT_WHEELS: GaugeName[] = ["power", "water", "gas"];
export const DEFAULT_BARS: GaugeName[] = ["gas_cost", "solar", "temperature", "battery"];

export const isGauge = (name: string): name is GaugeName => name in GAUGES;
export const isConfigured = (gauge: GaugeName, entities: Entities) =>
    GAUGES[gauge].requires.every((key) => entities[key].length);

export const LAYOUTS = ["classic", "flow", "timeline", "tiles"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const pickLayout = (value?: string | null, fallback: Layout = "classic"): Layout =>
    LAYOUTS.find((layout) => layout === value?.trim().toLowerCase()) ?? fallback;

export function pickGauges(explicit: (string | undefined)[], defaults: GaugeName[], entities: Entities): GaugeName[] {
    const names = explicit.map((name) => name?.trim().toLowerCase() ?? "");
    const configured = (gauge: GaugeName) => isConfigured(gauge, entities);
    const gauges = names.map((name, i) =>
        isGauge(name) ? name : configured(defaults[i]) ? defaults[i] : undefined);
    const taken = new Set(gauges);
    return gauges.map((gauge, i) => {
        if (gauge) return gauge;
        const pick = (Object.keys(GAUGES) as GaugeName[]).find((option) => configured(option) && !taken.has(option))
            ?? defaults[i];
        taken.add(pick);
        return pick;
    });
}