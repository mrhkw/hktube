import { cn } from "@/lib/utils";

type HKWLoaderProps = {
  fullscreen?: boolean;
  label?: string;
  className?: string;
};

export function HKWLoader({ fullscreen = false, label = "Loading HKW", className }: HKWLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "hkw-loader flex flex-col items-center justify-center text-slate-900",
        fullscreen ? "fixed inset-0 z-[99999] min-h-[100dvh] overflow-hidden bg-[#07111d] text-white" : "min-h-[24vh] w-full py-12",
        className,
      )}
    >
      {fullscreen && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><span className="hkw-loader-aurora hkw-loader-aurora-one" /><span className="hkw-loader-aurora hkw-loader-aurora-two" /><span className="hkw-loader-grid" /></div>}
      <div className="relative z-10 flex flex-col items-center">
        <div className={cn("hkw-loader-orbit relative grid place-items-center", fullscreen ? "size-36" : "size-24")}>
          <span className="hkw-loader-ring hkw-loader-ring-one" />
          <span className="hkw-loader-ring hkw-loader-ring-two" />
          <span className="hkw-loader-ring hkw-loader-ring-three" />
          <span className="hkw-loader-spark hkw-loader-spark-one" />
          <span className="hkw-loader-spark hkw-loader-spark-two" />
          <div className={cn("hkw-loader-core overflow-hidden rounded-[28%] border border-white/35 bg-slate-950 shadow-[0_0_45px_rgba(113,87,255,.65)]", fullscreen ? "size-20" : "size-14")}>
            <img src="/brand/hkw-mark.webp" alt="HKW" className="size-full object-cover" />
          </div>
        </div>
        <div className={cn("mt-5 flex items-center gap-2 font-black tracking-tight", fullscreen ? "text-2xl text-white" : "text-base text-slate-800")}>
          <span>HKW</span><span className="hkw-loader-live-dot" /><span className={cn("font-medium", fullscreen ? "text-white/55" : "text-slate-400")}>{label.replace(/^Loading HKW\s*/, "") || "Live"}</span>
        </div>
        {fullscreen && <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map(dot => <span key={dot} className="hkw-loader-dot" style={{ animationDelay: `${dot * 160}ms` }} />)}</div>}
      </div>
    </div>
  );
}
