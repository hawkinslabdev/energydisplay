"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import type { Entities, Reading } from "./api/state/summarize";
import ComparisonGauge from "./components/gauges/ComparisonGauge";
import MeterGauge from "./components/gauges/MeterGauge";
import RadialGauge from "./components/gauges/RadialGauge";
import Tooltip from "./components/shared/Tooltip";
import { DEFAULT_BARS, DEFAULT_WHEELS, GAUGES, type GaugeName } from "./gauges";

const POLL_MS = 5000;
const CACHE_KEY = "reading";

type State = Reading & { wheels: GaugeName[]; bars: GaugeName[]; entities: Entities; unavailable: string[] };

function Wheel({ name, reading, size, above }: { name: GaugeName; reading: Partial<State>; size: number; above?: boolean }) {
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

function Bar({ name, reading, above }: { name: GaugeName; reading: Partial<State>; above?: boolean }) {
  const bar = GAUGES[name];
  return (
    <Tooltip above={above} title={bar.title} detail={bar.detail} source={bar.source}>
      <MeterGauge
        icon={bar.icon}
        value={reading[bar.field] ?? null}
        minValue={0}
        maxValue={reading.ranges?.[bar.field] ?? bar.maxValue}
        unit={bar.unit}
        gaugeBackground={bar.background}
        gaugeHighlight={bar.highlight}
      />
    </Tooltip>
  );
}

export default function Home() {
  const [reading, setReading] = useState<Partial<State>>({});
  const [error, setError] = useState("");

  // Last reading from a previous page load, shown until the first poll answers. Layout effect so it lands before paint.
  useLayoutEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a lazy useState initializer would mismatch the prerendered HTML
      if (cached) setReading(JSON.parse(cached));
    } catch {}
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setReading(body);
        setError("");
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(body));
        } catch {}
      } catch (err) {
        setError(String(err));
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const wheels = reading.wheels ?? DEFAULT_WHEELS;
  // a bar without its entities is hidden, e.g. no battery
  const bars = (reading.bars ?? DEFAULT_BARS).filter((name) =>
    !reading.entities || GAUGES[name].requires.every((key) => reading.entities![key].length));

  return (
    <main className="grid h-dvh place-items-center overflow-hidden tabular-nums">
      <div className="relative z-10 grid h-[50rem] w-[90rem] grid-cols-[auto_auto_auto] items-center justify-evenly">
        <div className="flex flex-col items-center gap-6">
          <Wheel name={wheels[0]} reading={reading} size={28} />
          <Tooltip above title="Grid today" detail="Total energy imported and exported since midnight." source="ENERGY_EXPORT ↑  ENERGY_IMPORT ↓">
            <ComparisonGauge
              valueIn={reading.energy_export_today ?? null}
              valueOut={reading.energy_import_today ?? null}
              unit="kWh"
            />
          </Tooltip>
        </div>
        <div className="flex flex-col items-center gap-8">
          <Wheel name={wheels[1]} reading={reading} size={16} />
          <Wheel name={wheels[2]} reading={reading} size={19} above />
        </div>
        <div className="flex flex-col gap-9">
          {bars.map((name, i) => <Bar key={i} name={name} reading={reading} above={i >= 2} />)}
        </div>
      </div>
      {error && <p className="fixed inset-x-0 bottom-4 z-10 text-center text-xl text-red-400">{error}</p>}
    </main>
  );
}
