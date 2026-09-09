import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";

type ConsentState = { necessary: true; analytics: boolean; advertising: boolean };
const STORAGE_KEY = "hktube-consent-v1";

function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ConsentState>;
    return { necessary: true, analytics: value.analytics === true, advertising: value.advertising === true };
  } catch {
    return null;
  }
}

export function getHkTubeConsent(): ConsentState {
  return readConsent() ?? { necessary: true, analytics: false, advertising: false };
}

export function ConsentBanner() {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [manage, setManage] = useState(false);

  useEffect(() => setConsent(readConsent()), []);

  function save(next: ConsentState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
    setManage(false);
    window.dispatchEvent(new CustomEvent("hktube-consent-changed", { detail: next }));
  }

  if (consent) return null;

  return <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-4xl rounded-3xl border border-white/12 bg-[#101521]/[.98] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5" role="dialog" aria-label="Privacy and cookie choices">
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Cookie className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-white">Privacy choices</h2><p className="mt-1 text-xs leading-5 text-slate-400">HkTube uses necessary storage for sign-in and core features. Optional analytics and advertising technologies are off until you choose them.</p></div><button type="button" onClick={() => save({ necessary: true, analytics: false, advertising: false })} className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/8 hover:text-white" aria-label="Use necessary only"><X className="size-4" /></button></div>
        {manage && <div className="mt-4 rounded-2xl border border-white/8 bg-white/[.025] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-200" /><div><p className="text-sm font-semibold text-white">Optional categories</p><p className="mt-1 text-xs leading-5 text-slate-500">When HkTube later activates third-party analytics or ads, these choices will control whether those optional technologies may be loaded where legally required. No optional tracker is active in the current build.</p></div></div><div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border border-white/8 p-3"><input type="checkbox" checked={false} readOnly />Analytics — currently inactive</label><label className="flex items-center gap-2 rounded-xl border border-white/8 p-3"><input type="checkbox" checked={false} readOnly />Advertising — currently inactive</label></div></div>}
        <div className="mt-4 flex flex-wrap items-center gap-2"><Button onClick={() => save({ necessary: true, analytics: false, advertising: false })} variant="outline" className="border-white/12 text-slate-200 hover:bg-white/8">Necessary only</Button><Button onClick={() => save({ necessary: true, analytics: true, advertising: true })} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white">Accept optional</Button><Button onClick={() => setManage(value => !value)} variant="ghost" className="text-slate-300 hover:bg-white/8"><Settings2 className="mr-2 size-4" />{manage ? "Hide details" : "Manage choices"}</Button><Link href="/privacy" className="ml-auto text-xs font-semibold text-fuchsia-200 hover:text-fuchsia-100">Privacy Policy</Link></div>
      </div>
    </div>
  </div>;
}
