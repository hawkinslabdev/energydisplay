interface MeterGaugeProps {
    icon: string;
    value: number | null;
    minValue: number;
    maxValue: number;
    unit: string;
    gaugeBackground: string;
    gaugeHighlight: string;
}

// The bar is drawn in a fixed 200x20 box and scales with the text around it.
const BAR_START = 10;
const BAR_END = 192;

export default function MeterGauge(props: MeterGaugeProps) {
    const value = props.value ?? props.minValue;
    const clamped = Math.max(props.minValue, Math.min(value, props.maxValue));
    const barEnd = BAR_START + ((clamped - props.minValue) / (props.maxValue - props.minValue)) * (BAR_END - BAR_START);
    const [whole, fraction] = props.value === null ? ["–", ""] : props.value.toFixed(2).split(".");

    return (
        <div className="flex w-72 flex-col gap-2">
            <div className="flex items-center gap-2">
                <img className="size-10" src={props.icon} alt="" />
                <span className={`text-6xl font-semibold ${props.value === null ? "text-gray-500" : ""}`}>{whole}</span>
                <div className="flex flex-col gap-1 text-2xl font-semibold leading-none">
                    <span>{props.unit}</span>
                    <span className="text-gray-400">{fraction}</span>
                </div>
            </div>
            <svg className="h-[1.8rem] w-72" viewBox="0 0 200 20">
                <line x1={BAR_START} y1="10" x2={BAR_END} y2="10" strokeLinecap="round" strokeWidth="10" stroke={props.gaugeBackground} />
                {props.value !== null && (
                    <line x1={BAR_START} y1="10" x2={barEnd} y2="10" strokeLinecap="round" strokeWidth="10" stroke={props.gaugeHighlight} />
                )}
            </svg>
        </div>
    )
}
