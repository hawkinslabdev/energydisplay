import { formatRounding } from "@/app/core/utils/formatting"

interface ComparisonGaugeProps {
    valueIn: number | null
    valueOut: number | null
    unit: string
}

const arrow = (d: string[], color: string, label: string) => (
    <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
        {d.map((path) => <path key={path} d={path} />)}
    </svg>
)

const show = (value: number | null) =>
    value === null ? <span className="text-gray-500">–</span> : formatRounding(value)

export default function ComparisonGauge(props: ComparisonGaugeProps) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-4xl font-semibold">
                {arrow(["M12 19V5", "M5 12l7-7 7 7"], "#33C557", "Exported")}
                <span className="mr-4">{show(props.valueIn)}</span>
                {arrow(["M12 5v14", "M19 12l-7 7-7-7"], "#8D37FF", "Imported")}
                <span>{show(props.valueOut)}</span>
            </div>
            <span className="text-xl font-semibold text-gray-400">{props.unit}</span>
        </div>
    )
}
