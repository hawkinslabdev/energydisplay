import type { Entities, Reading } from "./api/state/summarize";
import ComparisonGauge from "./components/gauges/ComparisonGauge";
import MeterGauge from "./components/gauges/MeterGauge";
import RadialGauge from "./components/gauges/RadialGauge";
import Tooltip from "./components/shared/Tooltip";
import { powerNote } from "./core/utils/formatting";
import { DEFAULT_BARS, GAUGES, type Gauge, type GaugeName, isConfigured } from "./gauges";

export type State = Reading & { wheels: GaugeName[]; bars: GaugeName[]; entities: Entities; unavailable: string[] };

// a bar without its entities is hidden, e.g. no battery
export const shownBars = (reading: Partial<State>) =>
  (reading.bars ?? DEFAULT_BARS).filter((name) => !reading.entities || isConfigured(name, reading.entities));

export function Wheel({ name, reading, size, above }: { name: GaugeName; reading: Partial<State>; size: number; above?: boolean }) {
  const wheel = GAUGES[name];
  return (
    <Tooltip above={above} title={wheel.title} detail={wheel.detail} source={wheel.source}>
      <RadialGauge
        size={size}
        value={reading[wheel.field] ?? null}
        maxValue={reading.ranges?.[wheel.field] ?? wheel.maxValue}
        unit={wheel.unit}
        icon={wheel.icon}
        gaugeBackground={wheel.background}
        gaugeHighlight={wheel.highlight}
        fontColor="#eaeaea"
      />
    </Tooltip>
  );
}

export function Bar({ name, reading, above }: { name: GaugeName; reading: Partial<State>; above?: boolean }) {
  const bar = GAUGES[name];
  const { note }: Gauge = bar;
  const watts = note ? reading[note.field] : null;
  return (
    <Tooltip above={above} title={bar.title} detail={watts == null ? bar.detail : `${bar.detail} ${note!.detail}`} source={bar.source}>
      <MeterGauge
        icon={bar.icon}
        value={reading[bar.field] ?? null}
        minValue={0}
        maxValue={reading.ranges?.[bar.field] ?? bar.maxValue}
        unit={bar.unit}
        note={powerNote(watts)}
        gaugeBackground={bar.background}
        gaugeHighlight={bar.highlight}
      />
    </Tooltip>
  );
}

export function GridToday({ reading, above }: { reading: Partial<State>; above?: boolean }) {
  return (
    <Tooltip above={above} title="Grid today" detail="Total energy imported and exported since midnight." source="ENERGY_EXPORT ↑  ENERGY_IMPORT ↓">
      <ComparisonGauge
        valueIn={reading.energy_export_today ?? null}
        valueOut={reading.energy_import_today ?? null}
        unit="kWh"
      />
    </Tooltip>
  );
}
