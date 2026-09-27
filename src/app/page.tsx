"use client";

import { useEffect, useState } from "react";

import type { Entities, Reading } from "./api/state/summarize";
import ComparisonGauge from "./components/gauges/ComparisonGauge";
import MeterGauge from "./components/gauges/MeterGauge";
import RadialGauge from "./components/gauges/RadialGauge";
import Tooltip from "./components/shared/Tooltip";
import { DEFAULT_WHEELS, WHEELS, type WheelName } from "./wheels";

const POLL_MS = 5000;

type State = Reading & { wheels: WheelName[]; entities: Entities; unavailable: string[] };

function Wheel({ name, reading, size, above }: { name: WheelName; reading: Partial<State>; size: number; above?: boolean }) {
  const wheel = WHEELS[name];
  return (
    <Tooltip above={above} title={wheel.title} detail={wheel.detail} source={wheel.source}>
      <RadialGauge
        size={size}
        value={reading[wheel.field] ?? null}
        maxValue={wheel.maxValue}
        unit={wheel.unit}
        icon={wheel.icon}
        gaugeBackground={wheel.background}
        gaugeHighlight={wheel.highlight}
        fontColor="#eaeaea"
      />
    </Tooltip>
  );
}

export default function Home() {
  const [reading, setReading] = useState<Partial<State>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setReading(body);
        setError("");
      } catch (err) {
        setError(String(err));
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const wheels = reading.wheels ?? DEFAULT_WHEELS;

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
          <Tooltip title="Gas cost today" detail="Estimated cost of today's gas usage at the configured rate." source="GAS × GAS_PRICE">
            <MeterGauge
              icon="/icons/flame.svg"
              value={reading.gas_cost_today ?? null}
              minValue={0}
              maxValue={100}
              unit="€"
              gaugeBackground="#595959"
              gaugeHighlight="#ffffff"
            />
          </Tooltip>
          <Tooltip title="Solar today" detail="Total solar energy generated since midnight." source="SOLAR">
            <MeterGauge
              icon="/icons/sun.svg"
              value={reading.solar_today ?? null}
              minValue={0}
              maxValue={35}
              unit="kWh"
              gaugeBackground="#314d2c"
              gaugeHighlight="#5fda35"
            />
          </Tooltip>
          <Tooltip above title="Temperature" detail="Current temperature from the configured sensor or weather integration." source="TEMPERATURE">
            <MeterGauge
              icon="/icons/thermometer.svg"
              value={reading.temperature ?? null}
              minValue={0}
              maxValue={50}
              unit="°C"
              gaugeBackground="#59382b"
              gaugeHighlight="#ff7600"
            />
          </Tooltip>
          {!!reading.entities?.battery.length && (
            <Tooltip above title="Battery" detail="Current battery state of charge." source="BATTERY">
              <MeterGauge
                icon="/icons/battery.svg"
                value={reading.battery_soc ?? null}
                minValue={0}
                maxValue={100}
                unit="%"
                gaugeBackground="#1b4d3e"
                gaugeHighlight="#2ee6a6"
              />
            </Tooltip>
          )}
        </div>
      </div>
      {error && <p className="fixed inset-x-0 bottom-4 z-10 text-center text-xl text-red-400">{error}</p>}
    </main>
  );
}
