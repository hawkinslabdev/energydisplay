import { powerFlows } from "@/app/api/state/metrics";
import RadialGauge from "@/app/components/gauges/RadialGauge";
import Tooltip from "@/app/components/shared/Tooltip";
import { IDLE_W, formatRounding, powerNote } from "@/app/core/utils/formatting";
import { GAUGES } from "@/app/gauges";
import { GridToday, type State } from "@/app/parts";

type Node = "grid" | "solar" | "battery" | "home";

const RADIUS = 8;
const AT: Record<Node, [number, number]> = { solar: [45, 9], grid: [14, 25], home: [76, 25], battery: [45, 41] };
const PYLON = ["M12 2v20", "M2 5h20", "M3 3v2", "M7 3v2", "M17 3v2", "M21 3v2", "M19 5l-7 7-7-7"];
const HOME = { background: "#34313a", highlight: "#eaeaea", icon: ["M3 11l9-8 9 8", "M5 9.5V21h14V9.5"] };

const COLORS: Record<Node, { background: string; highlight: string }> = {
  grid: GAUGES.power,
  solar: GAUGES.solar,
  battery: GAUGES.battery,
  home: HOME,
};

const EDGES = [
  { key: "solar_home", from: "solar", to: "home", d: "M47 16.75Q47 23.5 68.14 23.5" },
  { key: "solar_grid", from: "solar", to: "grid", d: "M43 16.75Q43 23.5 21.86 23.5" },
  { key: "solar_battery", from: "solar", to: "battery", d: "M45 17V33" },
  { key: "grid_home", from: "grid", to: "home", d: "M22 25H68" },
  { key: "battery_home", from: "battery", to: "home", d: "M47 33.25Q47 26.5 68.14 26.5" },
  { key: "battery_grid", from: "battery", to: "grid", d: "M43 33.25Q43 26.5 21.86 26.5" },
  { key: "grid_battery", from: "grid", to: "battery", d: "M21.86 26.5Q43 26.5 43 33.25" },
] as const;

export default function Flow({ reading }: { reading: Partial<State> }) {
  const has = {
    grid: true,
    home: true,
    solar: !!reading.entities?.solar.length,
    battery: !!reading.entities?.battery.length,
  };
  const grid = reading.power_w ?? null;
  const solar = reading.entities?.solarPower.length ? (reading.solar_power_w ?? null) : 0;
  const battery = reading.entities?.batteryPower.length ? (reading.battery_power_w ?? null) : 0;
  const flows = grid === null || solar === null || battery === null ? null : powerFlows(grid, solar, battery);
  const max = reading.ranges?.power_w ?? GAUGES.power.maxValue;

  const nodes: Record<Node, { value: number | null; max: number; unit: string; icon: string[]; title: string; detail: string; source: string }> = {
    grid: { value: grid, max, unit: "w", icon: PYLON, title: "Grid", detail: "Power imported from (positive) or exported to (negative) the grid.", source: GAUGES.power.source },
    solar: { value: reading.solar_power_w ?? null, max, unit: "w", icon: GAUGES.solar.icon, title: "Solar", detail: "Current solar production.", source: "SOLAR_POWER" },
    battery: { value: reading.battery_soc ?? null, max: 100, unit: "%", icon: GAUGES.battery.icon, title: "Battery", detail: "State of charge. Below: charge (↑) or discharge (↓) power.", source: "BATTERY, BATTERY_POWER" },
    home: { value: flows && flows.home >= 0 ? Math.round(flows.home) : null, max, unit: "w", icon: HOME.icon, title: "Home", detail: "Current consumption from grid, solar and battery. A source without a power sensor is left out.", source: "POWER, optional SOLAR_POWER, BATTERY_POWER" },
  };

  const measured: Record<Node, boolean> = {
    grid: true,
    home: true,
    solar: !!reading.entities?.solarPower.length,
    battery: !!reading.entities?.batteryPower.length,
  };
  const edges = EDGES.filter((edge) => has[edge.from] && has[edge.to]);
  const tracks = edges.filter((edge) => edge.key !== "grid_battery");

  return (
    <div className="relative z-10 h-[50rem] w-[90rem] [zoom:0.82]">
      <svg className="absolute inset-0 size-full" viewBox="0 0 90 50" fill="none" strokeLinecap="round" aria-hidden="true">
        {tracks.map((edge) => (
          <path
            key={edge.d}
            d={edge.d}
            stroke="#ffffff14"
            strokeWidth={0.5}
            strokeDasharray={measured[edge.from] && measured[edge.to] ? undefined : "0.6 0.9"}
          />
        ))}
        {edges.map((edge) => {
          const watts = flows?.[edge.key] ?? 0;
          if (watts < IDLE_W) return null;
          return (
            <path
              key={edge.key}
              className="flow"
              d={edge.d}
              stroke={COLORS[edge.from].highlight}
              strokeWidth={0.5}
              style={{ animationDuration: `${Math.min(4, Math.max(0.5, Math.round(4000 / watts) / 2))}s` }}
            />
          );
        })}
      </svg>
      {(Object.keys(nodes) as Node[]).filter((name) => has[name]).map((name) => {
        const node = nodes[name];
        const [x, y] = AT[name];
        return (
          <div key={name} className="absolute" style={{ left: `${x - RADIUS}rem`, top: `${y - RADIUS}rem` }}>
            <Tooltip above={y > 25} title={node.title} detail={node.detail} source={node.source}>
              <RadialGauge
                size={RADIUS * 2}
                value={node.value}
                maxValue={node.max}
                unit={node.unit}
                icon={node.icon}
                gaugeBackground={COLORS[name].background}
                gaugeHighlight={COLORS[name].highlight}
                fontColor="#eaeaea"
              />
            </Tooltip>
          </div>
        );
      })}
      <div className="absolute" style={{ left: `${AT.grid[0]}rem`, top: "35rem", transform: "translateX(-50%)" }}>
        <GridToday reading={reading} above />
      </div>
      {has.solar && (
        <p className="absolute flex items-baseline gap-2 font-semibold" style={{ left: "55rem", top: `${AT.solar[1] - 1.5}rem` }}>
          <span className="text-4xl">{reading.solar_today == null ? "–" : formatRounding(reading.solar_today)}</span>
          <span className="text-xl text-gray-400">kWh today</span>
        </p>
      )}
      {has.battery && !!reading.entities?.batteryPower.length && (
        <p className="absolute text-3xl font-semibold text-gray-400" style={{ left: "55rem", top: `${AT.battery[1] - 1.25}rem` }}>
          {powerNote(reading.battery_power_w) ?? "idle"}
        </p>
      )}
    </div>
  );
}
