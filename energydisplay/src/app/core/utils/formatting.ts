
/** Rounds a number to two decimal places. */
export const formatRounding = (value: number): number => {
    // Round the value to two decimal places using EPSILON to avoid floating point issues
    const roundedValue = Math.round((value + Number.EPSILON) * 100) / 100;

    // Check if the rounded value is NaN, and if so, recursively call the function with 0
    if (isNaN(roundedValue)) {
        return 0;
    }

    // Return the rounded value
    return roundedValue;
}

export const IDLE_W = 20;

// home assistant battery power is negative while charging
export const powerNote = (watts: number | null | undefined) => {
    if (watts == null || Math.abs(watts) < IDLE_W) return undefined;
    const size = Math.round(Math.abs(watts));
    return `${watts < 0 ? "↑" : "↓"} ${size < 1000 ? `${size} W` : `${(size / 1000).toFixed(1)} kW`}`;
};
