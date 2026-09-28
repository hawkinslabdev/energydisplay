import { fraction, linecap } from "@/app/core/utils/gauge";

interface MeterGaugeProps {
    /** Stroke paths on a 24x24 grid, drawn in the highlight color. */
    icon: string[];
    value: number | null;
    minValue: number;
    maxValue: number;
    unit: string;
    note?: string;
    gaugeBackground: string;
    gaugeHighlight: string;
}

// The bar is drawn in a fixed 200x20 box and scales with the text around it.
const BAR_START = 10;
const BAR_END = 192;
const BAR_WIDTH = 10;

export default function MeterGauge(props: MeterGaugeProps) {
    // negative values, e.g. export compensation, fill from the right
    const fill = fraction(Math.abs(props.value ?? props.minValue), props.maxValue, props.minValue) * (BAR_END - BAR_START);
    const [from, to] = (props.value ?? 0) < 0 ? [BAR_END, BAR_START] : [BAR_START, BAR_END];
    const [whole, decimals] = props.value === null ? ["–", ""] : props.value.toFixed(2).split(".");

    return (
        <div className="flex w-72 flex-col gap-2">
            <div className="flex items-center gap-2">
                <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke={props.gaugeHighlight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {props.icon.map((d) => <path key={d} d={d} />)}
                </svg>
                <span className={`text-6xl font-semibold ${props.value === null ? "text-gray-500" : ""}`}>{whole}</span>
                <div className="flex flex-col gap-1 text-2xl font-semibold leading-none">
                    <span>{props.unit}</span>
                    <span className="text-gray-400">{props.note ?? decimals}</span>
                </div>
            </div>
            <svg className="h-[1.8rem] w-72" viewBox="0 0 200 20">
                <line x1={BAR_START} y1="10" x2={BAR_END} y2="10" strokeLinecap="round" strokeWidth={BAR_WIDTH} stroke={props.gaugeBackground} />
                {props.value !== null && (
                    <line
                        x1={from}
                        y1="10"
                        x2={to}
                        y2="10"
                        strokeLinecap={linecap(fill)}
                        strokeWidth={BAR_WIDTH}
                        stroke={props.gaugeHighlight}
                        strokeDasharray={`${fill} ${BAR_END}`}
                        style={{ transition: "0.3s" }}
                    />
                )}
            </svg>
        </div>
    )
}
