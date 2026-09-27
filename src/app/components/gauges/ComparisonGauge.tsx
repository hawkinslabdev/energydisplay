import { formatRounding } from "@/app/core/utils/formatting"

interface ComparisonGaugeProps {
    valueIn: number
    valueOut: number
    unit: string
}

export default function ComparisonGauge(props: ComparisonGaugeProps) {
    return (
        <div className="flex flex-col items-center m-4">
            <div className="flex flex-row items-center">
                <img src="/icons/arrow-up.svg" alt="Exported" width={40} height={40} />
                <h3 className="ml-2 text-4xl font-semibold">{formatRounding(props.valueIn)}</h3>
                <img src="/icons/arrow-down.svg" alt="Imported" width={40} height={40} />
                <h3 className="ml-2 text-4xl font-semibold">{formatRounding(props.valueOut)}</h3>
            </div>
            <span className="mt-2 text-xl font-semibold text-gray-500">{props.unit}</span>
        </div>
    )
}