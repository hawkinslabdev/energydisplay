// share of the range covered by value, clamped to 0..1
export const fraction = (value: number, max: number, min = 0) =>
    Math.min(Math.max((value - min) / (max - min), 0), 1) || 0;

// round caps on a stroke shorter than its width draw a dot
export const linecap = (length: number, width: number) => (length < width ? "butt" : "round");

