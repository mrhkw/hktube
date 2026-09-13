import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export const AD_CONSENT_KEY = "hktube-consent-v2";
export type AdConsent = "ads" | "essential";

export function getAdConsent(): AdConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(AD_CONSENT_KEY);
    return value === "ads" || value === "essential" ? value : null;
  } catch {
    return null;
  }
}

export function setAdConsent(value: AdConsent) {
  try { window.localStorage.setItem(AD_CONSENT_KEY, value); } catch {}
  window.dispatchEvent(new CustomEvent("hktube-ad-consent-changed", { detail: value }));
}

export function AdConsentBanner() {
  const [choice, setChoice] = useState<AdConsent | null>(() => getAdConsent());
  const [open, setOpen] = useState(() => !getAdConsent());

  useEffect(() => {
    const sync = () => { const next = getAdConsent(); setChoice(next); setOpen(!next); };
    window.addEventListener("hktube-ad-consent-changed", sync);
    return () => window.removeEventListener("hktube-ad-consent-changed", sync);
  }, []);

  if (choice || !open) return null;
  return <aside className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-3xl border border-white/15 bg-[#0b1019]/[.98] p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:inset-x-5 sm:p-5" role="dialog" aria-label="Advertising privacy choices">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-black">Your advertising privacy choice</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">HkTube uses Google AdSense for display advertising. Ads are requested as non-personalized by this integration. Google may still use cookies for frequency capping and aggregate reporting where legally permitted.</p>
        <Link href="/privacy" className="mt-2 inline-block text-xs font-semibold text-cyan-200 hover:text-white">Read Privacy Policy</Link>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => { setAdConsent("essential"); setChoice("essential"); setOpen(false); }} className="border-white/15 bg-transparent text-white hover:bg-white/10">Essential only</Button>
        <Button type="button" onClick={() => { setAdConsent("ads"); setChoice("ads"); setOpen(false); }} className="bg-white text-slate-950 hover:bg-slate-100">Allow ads</Button>
      </div>
    </div>
  </aside>;
}
