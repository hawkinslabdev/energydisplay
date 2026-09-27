// energy dashboard gauge math, ported from home assistant frontend energy.ts

export interface Flows {
  from_grid: number;
  to_grid: number;
  solar: number;
  from_battery: number;
  to_battery: number;
}

const sumOf = <T>(items: T[], value: (item: T) => number) =>
  items.reduce((sum, item) => sum + value(item), 0);

// port of computeConsumptionSingle
export function consumption(flows: Flows) {
  let { from_grid, to_grid, solar, from_battery, to_battery } = flows;
  const used_total = from_grid + solar + from_battery - to_grid - to_battery;
  let remaining = Math.max(used_total, 0);

  let grid_to_battery = Math.max(0, Math.min(to_battery, from_grid - remaining));
  to_battery -= grid_to_battery;
  from_grid -= grid_to_battery;
  const solar_to_battery = Math.min(solar, to_battery);
  to_battery -= solar_to_battery;
  solar -= solar_to_battery;
  const solar_to_grid = Math.min(solar, to_grid);
  to_grid -= solar_to_grid;
  solar -= solar_to_grid;
  const battery_to_grid = Math.min(from_battery, to_grid);
  from_battery -= battery_to_grid;
  const grid_to_battery_2 = Math.min(from_grid, to_battery);
  grid_to_battery += grid_to_battery_2;
  from_grid -= grid_to_battery_2;
  const used_solar = Math.min(remaining, solar);
  remaining -= used_solar;
  const used_battery = Math.min(from_battery, remaining);

  return { used_total, used_solar, used_battery, grid_to_battery, battery_to_grid, solar_to_battery, solar_to_grid };
}

// port of calculateSolarConsumedGauge, battery energy traced lifo
export function solarConsumedPct(hours: Flows[]) {
  const solar = sumOf(hours, (hour) => hour.solar);
  if (!solar) return null;
  const routed = hours.map(consumption);
  if (!hours.some((hour) => hour.to_battery || hour.from_battery)) {
    return (sumOf(routed, (hour) => hour.used_solar) / solar) * 100;
  }

  let consumed = 0;
  let returned = 0;
  const stack: { solar: boolean; value: number }[] = [];
  const drain = (amount: number, onSolar: (energy: number) => void) => {
    while (amount > 0 && stack.length) {
      const last = stack[stack.length - 1];
      const energy = Math.min(amount, last.value);
      last.value -= energy;
      if (last.value <= 0) stack.pop();
      if (last.solar) onSolar(energy);
      amount -= energy;
    }
  };
  for (const hour of routed) {
    consumed += hour.used_solar;
    returned += hour.solar_to_grid;
    if (hour.grid_to_battery) stack.push({ solar: false, value: hour.grid_to_battery });
    if (hour.solar_to_battery) stack.push({ solar: true, value: hour.solar_to_battery });
    drain(hour.used_battery, (energy) => (consumed += energy));
    drain(hour.battery_to_grid, (energy) => (returned += energy));
  }
  return consumed + returned ? (consumed / (consumed + returned)) * 100 : null;
}

// port of the self-sufficiency gauge card
export function selfSufficiencyPct(hours: Flows[]) {
  const used = sumOf(hours.map(consumption), (hour) => hour.used_total);
  const imported = sumOf(hours, (hour) => hour.from_grid);
  return used > 0 ? (1 - Math.min(1, imported / used)) * 100 : null;
}

// largest absolute value, undefined when there is none
export const peak = (values: Iterable<number>) =>
  Math.max(0, ...[...values].map(Math.abs)) || undefined;

// twice the median absolute value, so half scale is a typical day
export const typical = (values: Iterable<number>) => {
  const sorted = [...values].map(Math.abs).sort((a, b) => a - b);
  const middle = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2;
  return 2 * median || undefined;
};
