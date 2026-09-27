import type { Entities, Reading } from "./api/state/summarize";

interface Wheel {
    field: keyof Reading;
    /** Stroke paths on a 24x24 grid, drawn in the highlight color. */
    icon: string[];
    /** Entities the wheel needs; unset wheels skip options whose entities are missing. */
    requires: (keyof Entities)[];
    maxValue: number;
    unit: string;
    background: string;
    highlight: string;
    title: string;
    detail: string;
    /** Environment variables that feed the wheel. */
    source: string;
}

// Options for WHEEL1, WHEEL2 and WHEEL3.
export const WHEELS = {
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
        detail: "Total water usage recorded since midnight.",
        source: "WATER",
    },
    gas: {
        field: "gas_today",
        icon: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"], requires: ["gas"], maxValue: 10, unit: "m3", background: "#501228", highlight: "#fd2d86",
        title: "Gas today",
        detail: "Total gas consumption recorded since midnight.",
        source: "GAS",
    },
    grid: {
        field: "grid_net_today",
        icon: ["M12 2v20", "M2 5h20", "M3 3v2", "M7 3v2", "M17 3v2", "M21 3v2", "M19 5l-7 7-7-7"], requires: ["energyImport", "energyExport"], maxValue: 20, unit: "kWh", background: "#1f2a50", highlight: "#6d8bff",
        title: "Net grid today",
        detail: "Energy imported minus energy exported since midnight.",
        source: "ENERGY_IMPORT − ENERGY_EXPORT",
    },
    solar: {
        field: "solar_today",
        icon: ["M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z", "M12 2v2", "M12 20v2", "M4.93 4.93l1.41 1.41", "M17.66 17.66l1.41 1.41", "M2 12h2", "M20 12h2", "M6.34 17.66l-1.41 1.41", "M19.07 4.93l-1.41 1.41"], requires: ["solar"], maxValue: 35, unit: "kWh", background: "#314d2c", highlight: "#5fda35",
        title: "Solar today",
        detail: "Total solar energy generated since midnight.",
        source: "SOLAR",
    },
    self_consumption: {
        field: "solar_self_consumed_pct",
        icon: ["M3 11l9-8 9 8", "M5 9.5V21h14V9.5", "M15 15.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"], requires: ["solar", "energyExport"], maxValue: 100, unit: "%", background: "#1f4630", highlight: "#7fd49b",
        title: "Self-consumed solar",
        detail: "Share of today's solar energy used at home instead of exported.",
        source: "SOLAR, ENERGY_EXPORT",
    },
} satisfies Record<string, Wheel>;

export type WheelName = keyof typeof WHEELS;

export const DEFAULT_WHEELS: WheelName[] = ["power", "water", "gas"];

export const isWheel = (name: string): name is WheelName => name in WHEELS;

/**
 * Explicit WHEEL1..3 values are kept. An unset wheel uses its default when that is configured,
 * otherwise the first configured option not already shown.
 */
export function pickWheels(explicit: (string | undefined)[], entities: Entities): WheelName[] {
    const names = explicit.map((name) => name?.trim().toLowerCase() ?? "");
    const configured = (wheel: WheelName) => WHEELS[wheel].requires.every((key) => entities[key].length);
    const wheels = names.map((name, i) =>
        isWheel(name) ? name : configured(DEFAULT_WHEELS[i]) ? DEFAULT_WHEELS[i] : undefined);
    const taken = new Set(wheels);
    return wheels.map((wheel, i) => {
        if (wheel) return wheel;
        const pick = (Object.keys(WHEELS) as WheelName[]).find((option) => configured(option) && !taken.has(option))
            ?? DEFAULT_WHEELS[i];
        taken.add(pick);
        return pick;
    });
}
