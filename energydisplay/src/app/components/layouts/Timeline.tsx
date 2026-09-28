import { useId } from "react";

import Tooltip from "@/app/components/shared/Tooltip";
import { formatRounding } from "@/app/core/utils/formatting";
import { GAUGES, type GaugeName, isConfigured } from "@/app/gauges";
import { Bar, GridToday, type State, shownBars } from "@/app/parts";

const DAY_MS = 86_400_000;
const GAP_MS = 600_000;
const HALF_BUCKET_MS = 150_000;
const LEFT = 60;
const RIGHT = 820;
const TOP = 12;
const BOTTOM = 212;
const IMPORT = "#8d37ff";
const EXPORT = "#33c557";

type Point = [time: number, watts: number];

const segments = (points: Point[]) =>
  points.reduce<Point[][]>((runs, point, i) => {
    if (i && point[0] - points[i - 1][0] <= GAP_MS) runs[runs.length - 1].push(point);
    else runs.push([point]);
    return runs;
  }, []);

function Stat({ icon, color, value, unit, title, detail, source }: {
  icon: string[]; color: string; value: number | null | undefined; unit: string; title: string; detail: string; source: string;
}) {
  return (
    <Tooltip title={title} detail={detail} source={source}>
      <div className="flex items-center gap-3">
        <svg className="size-12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon.map((d) => <path key={d} d={d} />)}
        </svg>
        <span className={`text-7xl font-semibold ${value == null ? "text-gray-500" : ""}`}>{value == null ? "–" : formatRounding(value)}</span>
        <span className="text-3xl font-semibold" style={{ color }}>{unit}</span>
      </div>
    </Tooltip>
  );
}

export default function Timeline({ reading, now }: { reading: Partial<State>; now: number }) {
  const clip = useId();
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const samples = reading.timeline ?? [];
  const live = reading.power_w ?? null;
  const solarLive = reading.solar_power_w ?? null;

  const power: Point[] = samples.flatMap((s) => (s.power === null ? [] : [[s.start + HALF_BUCKET_MS, s.power]]));
  const solar: Point[] = samples.flatMap((s) => (s.solar && s.solar > 0 ? [[s.start + HALF_BUCKET_MS, s.solar]] : []));
  if (power.length && live !== null && now - power[power.length - 1][0] <= GAP_MS) power.push([now, live]);
  if (solar.length && solarLive && solarLive > 0 && now - solar[solar.length - 1][0] <= GAP_MS) solar.push([now, solarLive]);

  const values = [...power, ...solar].map(([, watts]) => watts).concat(live ?? 0);
  const top = Math.max(1000, Math.ceil(Math.max(...values) / 1000) * 1000);
  const bottom = Math.min(0, Math.floor(Math.min(...values) / 1000) * 1000);
  const x = (time: number) => LEFT + ((time - midnight) / DAY_MS) * (RIGHT - LEFT);
  const y = (watts: number) => TOP + ((top - watts) / (top - bottom)) * (BOTTOM - TOP);
  const line = (run: Point[]) => run.map(([time, watts], i) => `${i ? "L" : "M"}${x(time).toFixed(1)} ${y(watts).toFixed(1)}`).join("");
  const area = (run: Point[]) => `${line(run)}L${x(run[run.length - 1][0]).toFixed(1)} ${y(0)}L${x(run[0][0]).toFixed(1)} ${y(0)}Z`;
  const kw = (watts: number) => `${formatRounding(watts / 1000)} kW`;
  const hasSolar = !!reading.entities?.solar.length;
  const bars = shownBars(reading);
  const spare = (Object.keys(GAUGES) as GaugeName[]).find((name) =>
    name !== "power" && name !== "solar" && !bars.includes(name) && !!reading.entities && isConfigured(name, reading.entities));
  const below = bars.flatMap((name) => (name === "solar" && hasSolar ? (spare ? [spare] : []) : [name]));

  return (
    <div className="relative z-10 flex h-[50rem] w-[90rem] flex-col justify-center gap-7 px-10">
      <div className="flex items-center justify-between px-6">
        <Stat icon={GAUGES.power.icon} color={GAUGES.power.highlight} value={live} unit="w" title={GAUGES.power.title} detail={GAUGES.power.detail} source={GAUGES.power.source} />
        <GridToday reading={reading} />
        {hasSolar && (
          <Stat icon={GAUGES.solar.icon} color={GAUGES.solar.highlight} value={reading.solar_today} unit="kWh" title={GAUGES.solar.title} detail="Total solar energy generated since midnight." source="SOLAR" />
        )}
      </div>
      {reading.timeline && now > 0 && (
        <svg className="h-[23.5rem] w-[84rem] self-center" viewBox="0 0 840 235" fill="none" role="img" aria-label="Grid power since midnight">
          <defs>
            <clipPath id={`${clip}-above`}><rect x={LEFT} y={0} width={RIGHT - LEFT} height={y(0)} /></clipPath>
            <clipPath id={`${clip}-below`}><rect x={LEFT} y={y(0)} width={RIGHT - LEFT} height={235} /></clipPath>
          </defs>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => {
            const at = x(midnight + hour * 3_600_000);
            return (
              <g key={hour}>
                <line x1={at} x2={at} y1={TOP} y2={BOTTOM} stroke="#ffffff0f" />
                <text x={at} y={232} fill="#6b7280" fontSize={14} textAnchor="middle">{String(hour).padStart(2, "0")}</text>
              </g>
            );
          })}
          {[top, 0, bottom].filter((watts, i, all) => all.indexOf(watts) === i).map((watts) => (
            <g key={watts}>
              <line x1={LEFT} x2={RIGHT} y1={y(watts)} y2={y(watts)} stroke={watts ? "#ffffff0f" : "#ffffff33"} />
              <text x={LEFT - 10} y={y(watts) + 5} fill="#6b7280" fontSize={14} textAnchor="end">{kw(watts)}</text>
            </g>
          ))}
          {segments(power).map((run) => (
            <g key={run[0][0]}>
              <path d={area(run)} fill={IMPORT} fillOpacity={0.3} clipPath={`url(#${clip}-above)`} />
              <path d={area(run)} fill={EXPORT} fillOpacity={0.3} clipPath={`url(#${clip}-below)`} />
              <path d={line(run)} stroke={IMPORT} strokeWidth={2} strokeLinejoin="round" clipPath={`url(#${clip}-above)`} />
              <path d={line(run)} stroke={EXPORT} strokeWidth={2} strokeLinejoin="round" clipPath={`url(#${clip}-below)`} />
            </g>
          ))}
          {segments(solar).map((run) => (
            <path key={run[0][0]} d={line(run)} stroke={GAUGES.solar.highlight} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="6 5" />
          ))}
          <line x1={x(now)} x2={x(now)} y1={TOP} y2={BOTTOM} stroke="#ffffff40" strokeDasharray="2 4" />
          {live !== null && <circle cx={x(now)} cy={y(live)} r={6} fill={live < 0 ? EXPORT : IMPORT} />}
          {!power.length && (
            <text x={(LEFT + RIGHT) / 2} y={(TOP + BOTTOM) / 2} fill="#6b7280" fontSize={20} textAnchor="middle">No power history for today yet</text>
          )}
        </svg>
      )}
      <div className="flex justify-center gap-10 text-xl font-medium text-gray-400">
        <span className="flex items-center gap-3"><span className="size-4 rounded-sm" style={{ background: IMPORT }} />Import</span>
        <span className="flex items-center gap-3"><span className="size-4 rounded-sm" style={{ background: EXPORT }} />Export</span>
        {solar.length > 0 && (
          <span className="flex items-center gap-3"><span className="h-1 w-6 rounded-full" style={{ background: GAUGES.solar.highlight }} />Solar</span>
        )}
      </div>
      <div className="mt-6 flex justify-evenly [zoom:0.85]">
        {below.map((name, i) => <Bar key={i} name={name} reading={reading} above />)}
      </div>
    </div>
  );
}
