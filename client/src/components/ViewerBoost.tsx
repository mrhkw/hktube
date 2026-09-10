import { useEffect, useMemo, useState } from "react";
import { Flame, PlayCircle, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { VideoRecord } from "@/lib/video";

function updateStreak() {
  const today = new Date();
  const key = "hktube-view-streak-v1";
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "{}") as { day?: string; streak?: number };
    const day = today.toISOString().slice(0, 10);
    if (saved.day === day) return saved.streak || 1;
    const previous = new Date(today);
    previous.setDate(today.getDate() - 1);
    const previousDay = previous.toISOString().slice(0, 10);
    const streak = saved.day === previousDay ? Math.max(1, saved.streak || 1) + 1 : 1;
    localStorage.setItem(key, JSON.stringify({ day, streak }));
    return streak;
  } catch {
    return 1;
  }
}

export function ViewerBoost() {
  const [location, setLocation] = useState(() => window.location.pathname);
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const history = trpc.watch_history.mine.useQuery(undefined, { enabled: Boolean(auth.data) && location === "/", retry: false });
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    const syncLocation = () => setLocation(window.location.pathname);
    window.addEventListener("popstate", syncLocation);
    window.addEventListener("hktube-route-change", syncLocation);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener("hktube-route-change", syncLocation);
    };
  }, []);

  useEffect(() => setStreak(updateStreak()), []);
  const items = useMemo(() => (history.data ?? []).slice(0, 4).map(item => item.video as VideoRecord), [history.data]);

  if (location !== "/") return null;
  const go = (href: string) => { window.history.pushState({}, "", href); window.dispatchEvent(new Event("hktube-route-change")); };

  return <section className="mx-auto mt-8 w-full max-w-[1480px] px-3 sm:px-6 lg:px-10" aria-label="Viewer discovery">
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div className="rounded-3xl border border-orange-300/15 bg-gradient-to-r from-orange-500/[.08] via-white/[.025] to-violet-500/[.06] p-5">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-orange-400/10 text-orange-200"><Flame className="size-5" aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-200/70">Viewer streak</p><h2 className="mt-0.5 text-lg font-black text-white">{streak} day{streak === 1 ? "" : "s"} of watching</h2></div></div>
        <p className="mt-3 text-sm text-slate-400">Keep discovering creators you enjoy. Your streak stays on this device and never changes public stats.</p>
      </div>
      <button type="button" onClick={() => go("/trending")} className="group flex min-h-24 items-center gap-3 rounded-3xl border border-violet-300/15 bg-violet-500/[.08] p-5 text-left transition hover:-translate-y-0.5 hover:bg-violet-500/[.13]"><Sparkles className="size-5 text-violet-200" aria-hidden="true" /><span><span className="block text-sm font-black text-white">Today's discovery</span><span className="mt-1 block text-xs text-slate-400">Open Trending for fresh picks.</span></span><PlayCircle className="ml-auto size-5 text-violet-200 transition group-hover:translate-x-0.5" aria-hidden="true" /></button>
    </div>
    {items.length > 0 && <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-white">Continue watching</h2><button type="button" onClick={() => go("/history")} className="text-xs font-bold text-violet-200 hover:text-white">View history</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(video => <button key={video.id} type="button" onClick={() => go(`/watch/${video.id}`)} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.03] text-left transition hover:-translate-y-0.5 hover:border-violet-300/20"><div className="aspect-video bg-white/[.04]">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid h-full place-items-center"><PlayCircle className="size-8 text-slate-500" aria-hidden="true" /></div>}</div><div className="p-3"><p className="line-clamp-2 text-sm font-bold text-white">{video.title}</p><p className="mt-1 text-xs text-slate-500">Resume watching</p></div></button>)}</div></div>}
  </section>;
}
