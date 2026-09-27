import { formatRounding } from "@/app/core/utils/formatting"

interface ComparisonGaugeProps {
    valueIn: number | null
    valueOut: number | null
    unit: string
}

const show = (value: number | null) =>
    value === null ? <span className="text-gray-500">–</span> : formatRounding(value)

export default function ComparisonGauge(props: ComparisonGaugeProps) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-4xl font-semibold">
                <img className="size-10" src="/icons/arrow-up.svg" alt="Exported" />
                <span className="mr-4">{show(props.valueIn)}</span>
                <img className="size-10" src="/icons/arrow-down.svg" alt="Imported" />
                <span>{show(props.valueOut)}</span>
            </div>
            <span className="text-xl font-semibold text-gray-400">{props.unit}</span>
        </div>
    )
}
