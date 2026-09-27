import { formatRounding } from "@/app/core/utils/formatting";
import { fraction, linecap } from "@/app/core/utils/gauge";

interface RadialGaugeProps {
    /** Diameter in rem. */
    size: number;
    value: number | null;
    maxValue: number;
    unit: string;
    /** Stroke paths on a 24x24 grid, shown above the value. */
    icon?: string[];
    gaugeBackground: string;
    gaugeHighlight: string;
    fontColor: string;
}

// Drawn in a fixed 200x200 box and scaled by CSS, so the gauge is crisp at any size.
const RADIUS = 100;
const STROKE = RADIUS * 0.15;
const INNER = RADIUS - STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * INNER;

export default function RadialGauge(props: RadialGaugeProps) {
    // negative values, e.g. grid export, fill counterclockwise
    const fill = fraction(Math.abs(props.value ?? 0), props.maxValue) * CIRCUMFERENCE;

    return (
        <svg
            viewBox={`0 0 ${RADIUS * 2} ${RADIUS * 2}`}
            style={{ width: `${props.size}rem`, height: `${props.size}rem` }}
        >
            <circle
                cx={RADIUS}
                cy={RADIUS}
                fill="transparent"
                r={INNER}
                stroke={props.gaugeBackground}
                strokeWidth={STROKE}
            />
            {props.value !== null && (
                <circle
                    cx={RADIUS}
                    cy={RADIUS}
                    fill="transparent"
                    r={INNER}
                    stroke={props.gaugeHighlight}
                    strokeWidth={STROKE}
                    strokeDasharray={`${fill} ${CIRCUMFERENCE}`}
                    strokeLinecap={linecap(fill, STROKE)}
                    transform={props.value < 0 ? `matrix(1 0 0 -1 0 ${RADIUS * 2})` : undefined}
                    style={{ transition: "0.3s" }}
                />
            )}
            {props.icon && (
                <g
                    transform={`translate(${RADIUS - 20} 24) scale(${40 / 24})`}
                    fill="none"
                    stroke={props.gaugeHighlight}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {props.icon.map((d) => <path key={d} d={d} />)}
                </g>
            )}
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                fill={props.value === null ? "#6b7280" : props.fontColor}
                fontSize={RADIUS / 2}
                fontWeight="bold"
                dy=".3em"
            >
                {props.value === null ? "–" : props.unit === "%" ? Math.round(props.value) : formatRounding(props.value)}
            </text>
            <text
                x="50%"
                y="70%"
                textAnchor="middle"
                fill={props.gaugeHighlight}
                fontSize={RADIUS / 3}
                fontWeight="medium"
                dy=".3em"
            >
                {props.unit}
            </text>
        </svg>
    )
}
