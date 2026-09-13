import { useEffect, useState } from "react";

const LOAD_STEPS = [
  "Warming up your feed",
  "Loading your HkTube experience",
  "Almost ready",
];

export function HkTubeWelcomeLoader() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(8);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(100, 8 + Math.round((elapsed / 1450) * 92));
      setProgress(next);
      setStep(next < 45 ? 0 : next < 82 ? 1 : 2);
    }, 80);
    const hideTimer = window.setTimeout(() => setVisible(false), 1600);
    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-label="HkTube loading"
      role="status"
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-[#080711] text-white transition-opacity duration-500"
    >
      <div className="absolute inset-0 opacity-70">
        <div className="absolute -left-24 -top-24 size-72 rounded-full bg-violet-600/25 blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-20 size-80 rounded-full bg-fuchsia-600/20 blur-3xl animate-pulse [animation-delay:500ms]" />
        <div className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-6 w-full max-w-sm text-center">
        <div className="mx-auto mb-7 grid size-24 place-items-center rounded-[30px] border border-white/15 bg-white/[.07] shadow-[0_0_70px_rgba(124,58,237,.35)] backdrop-blur-xl">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 text-2xl font-black shadow-lg shadow-violet-500/30">
            HK
          </div>
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.35em] text-violet-300">Welcome to</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">HkTube</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/55">
          Watch. Share. Discover.
        </p>

        <div className="mx-auto mt-9 max-w-xs">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-white/45">
            <span>{LOAD_STEPS[step]}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 shadow-[0_0_18px_rgba(167,139,250,.7)] transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map(dot => (
            <span
              key={dot}
              className="size-1.5 rounded-full bg-white/40 animate-bounce"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
