"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import Flow from "./components/layouts/Flow";
import Timeline from "./components/layouts/Timeline";
import { demoReading } from "./demo";
import { DEFAULT_WHEELS, GAUGES, type GaugeName, type Layout, isConfigured, pickLayout } from "./gauges";
import { Bar, GridToday, type State, Wheel, shownBars } from "./parts";

const POLL_MS = 5000;
const CACHE_KEY = "reading";
// static demo build, see DEMO in next.config.mjs
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

function Classic({ reading }: { reading: Partial<State> }) {
  const wheels = reading.wheels ?? DEFAULT_WHEELS;
  return (
    <div className="relative z-10 grid h-[50rem] w-[90rem] grid-cols-[auto_auto_auto] items-center justify-evenly">
      <div className="flex flex-col items-center gap-6">
        <Wheel name={wheels[0]} reading={reading} size={28} />
        <GridToday reading={reading} above />
      </div>
      <div className="flex flex-col items-center gap-8">
        <Wheel name={wheels[1]} reading={reading} size={16} />
        <Wheel name={wheels[2]} reading={reading} size={19} above />
      </div>
      <div className="flex flex-col gap-9">
        {shownBars(reading).map((name, i) => <Bar key={i} name={name} reading={reading} above={i >= 2} />)}
      </div>
    </div>
  );
}

function GridSplit({ reading }: { reading: Partial<State> }) {
  const exported = reading.energy_export_today ?? 0;
  const imported = reading.energy_import_today ?? 0;
  const split = 10 + (exported / (exported + imported || 1)) * 182;
  const segment = (from: number, to: number, stroke: string) =>
    to > from && <line x1={from} y1="10" x2={to} y2="10" strokeLinecap="round" strokeWidth={10} stroke={stroke} />;
  return (
    <svg className="h-[1.8rem] w-72" viewBox="0 0 200 20" aria-hidden="true">
      {exported + imported > 0
        ? <>
            {segment(10, imported ? split - 8 : 192, "#33c557")}
            {segment(exported ? split + 8 : 10, 192, "#8d37ff")}
          </>
        : <line x1={10} y1="10" x2={192} y2="10" strokeLinecap="round" strokeWidth={10} stroke="#ffffff1f" />}
    </svg>
  );
}

function Tiles({ reading }: { reading: Partial<State> }) {
  const names = reading.entities
    ? (Object.keys(GAUGES) as GaugeName[]).filter((name) => isConfigured(name, reading.entities!))
    : [];
  const tile = "flex h-full flex-col justify-between gap-4";
  const title = "text-xl font-medium text-gray-400";
  return (
    <div className="relative z-10 grid w-[90rem] grid-cols-4 gap-x-10 gap-y-16 px-10">
      <div className={tile}>
        <p className={title}>Grid today</p>
        <div className="self-start"><GridToday reading={reading} /></div>
        <GridSplit reading={reading} />
      </div>
      {names.map((name, i) => (
        <div key={name} className={tile}>
          <p className={title}>{GAUGES[name].title}</p>
          <Bar name={name} reading={reading} above={i >= 7} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard(props: { layout: Layout }) {
  const [reading, setReading] = useState<Partial<State>>({});
  const [layout, setLayout] = useState(props.layout);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

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
      setNow(Date.now());
      try {
        if (DEMO) {
          setLayout(pickLayout(new URLSearchParams(location.search).get("layout"), props.layout));
          return setReading(demoReading(new Date()));
        }
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
  }, [props.layout]);

  return (
    <main className="grid h-dvh place-items-center overflow-hidden tabular-nums">
      {layout === "flow" ? <Flow reading={reading} />
        : layout === "timeline" ? <Timeline reading={reading} now={now} />
        : layout === "tiles" ? <Tiles reading={reading} />
        : <Classic reading={reading} />}
      {error && <p className="fixed inset-x-0 bottom-4 z-10 text-center text-xl text-red-400">{error}</p>}
    </main>
  );
}
