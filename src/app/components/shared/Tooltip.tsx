interface TooltipProps {
    /** What the tile shows. */
    title: string;
    /** What the value means, in one line. */
    detail: string;
    /** Environment variables that feed the tile. */
    source: string;
    /** Open above the tile, for tiles near the bottom of the screen. */
    above?: boolean;
    children: React.ReactNode;
}

// Setup help for desktop. Tailwind's hover variant only applies on devices that can hover,
// so a wall tablet never shows it; keyboard focus shows it too.
export default function Tooltip(props: TooltipProps) {
    return (
        <div tabIndex={0} className="group relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#8d37ff]">
            {props.children}
            <div
                role="tooltip"
                className={`pointer-events-none absolute left-1/2 z-20 w-max max-w-[24rem] -translate-x-1/2 translate-y-1 ${props.above ? "bottom-full mb-3" : "top-full mt-3"} rounded-xl border border-white/10 bg-[#140a22] px-4 py-3 text-left opacity-0 shadow-[0_0.75rem_2rem_rgb(0_0_0/0.5)] transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100`}
            >
                <p className="text-lg font-semibold text-white">{props.title}</p>
                <p className="mt-1 text-base text-gray-300">{props.detail}</p>
                <p className="mt-2 font-mono text-sm text-gray-400">{props.source}</p>
            </div>
        </div>
    )
}
