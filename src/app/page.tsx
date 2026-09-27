"use client";

import { useEffect, useState } from "react";

import type { Reading } from "./api/state/summarize";
import ComparisonGauge from "./components/gauges/ComparisonGauge";
import MeterGauge from "./components/gauges/MeterGauge";
import RadialGauge from "./components/gauges/RadialGauge";
import { formatRounding } from "./core/utils/formatting";

const POLL_MS = 5000;

export default function Home() {
  const [reading, setReading] = useState<Partial<Reading>>({});
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="grid grid-rows-4 grid-flow-col gap-4">
        <div className="row-span-4 mx-4 my-12">
          <RadialGauge
            radius={150}
            value={reading.power_w ?? 0}
            maxValue={5000}
            unit="w"
            gaugeBackground="#2c134d"
            gaugeHighlight="#8d37ff"
            fontColor="#eaeaea"
          />
          <ComparisonGauge
            valueIn={reading.energy_export_today ?? 0}
            valueOut={reading.energy_import_today ?? 0}
            unit="kWh"
          />
        </div>
        <div className="row-span-2 col-span-2">
          <RadialGauge
            radius={90}
            value={reading.water_today_l ?? 0}
            maxValue={100}
            unit="L"
            gaugeBackground="#1b3b50"
            gaugeHighlight="#3dbfff"
            fontColor="#eaeaea"
          />
        </div>
        <div className="row-span-2 col-span-2">
          <RadialGauge
            radius={110}
            value={reading.gas_today ?? 0}
            maxValue={10}
            unit="m3"
            gaugeBackground="#501228"
            gaugeHighlight="#fd2d86"
            fontColor="#eaeaea"
          />
        </div>
        <div className="mx-8 col-span-2">
          <MeterGauge
            icon="/icons/flame.svg"
            value={formatRounding(reading.gas_cost_today ?? 0)}
            minValue={0}
            maxValue={100}
            unit="€"
            gaugeBackground="#595959"
            gaugeHighlight="#ffffff"
            fontColor=""
            width={200}
            height={20}
          />
        </div>
        <div className="mx-8 col-span-2">
          <MeterGauge
            icon="/icons/sun.svg"
            value={formatRounding(reading.solar_today ?? 0)}
            minValue={0}
            maxValue={35}
            unit="kWh"
            gaugeBackground="#314d2c"
            gaugeHighlight="#5fda35"
            fontColor=""
            width={200}
            height={20}
          />
        </div>
        <div className="mx-8 col-span-2">
          <MeterGauge
            icon="/icons/thermometer.svg"
            value={formatRounding(reading.temperature ?? 0)}
            minValue={0}
            maxValue={50}
            unit="°C"
            gaugeBackground="#59382b"
            gaugeHighlight="#ff7600"
            fontColor=""
            width={200}
            height={20}
          />
        </div>
        <div className="mx-8 col-span-2">
          <MeterGauge
            icon="/icons/battery.svg"
            value={formatRounding(reading.battery_soc ?? 0)}
            minValue={0}
            maxValue={100}
            unit="%"
            gaugeBackground="#1b4d3e"
            gaugeHighlight="#2ee6a6"
            fontColor=""
            width={200}
            height={20}
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-center">{error}</p>}
    </main>
  );
}
