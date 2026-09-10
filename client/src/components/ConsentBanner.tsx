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
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<ConsentState>;
      return { necessary: true, analytics: value.analytics === true, advertising: value.advertising === true };
    } catch { return null; }
  }
}

export function getHkTubeConsent(): ConsentState {
  return readConsent() ?? { necessary: true, analytics: false, advertising: false };
}

export function ConsentBanner() {
  const [consent, setConsent] = useState<ConsentState | null>(() => readConsent());
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const saved = readConsent();
    if (saved) setConsent(saved);
  }, []);

  function save(next: ConsentState) {
    setConsent(next);
    setManage(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* best effort */ }
    }
    window.dispatchEvent(new CustomEvent("hktube-consent-changed", { detail: next }));
  }

  // Keep consent controls usable on mobile even if another component has
  // installed a document-level gesture handler. The native capture listener
  // is intentionally scoped to these data attributes and mirrors React's UI.
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-hktube-consent-action]") : null;
      const action = target?.dataset.hktubeConsentAction;
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === "necessary" || action === "close") save({ necessary: true, analytics: false, advertising: false });
      else if (action === "accept") save({ necessary: true, analytics: true, advertising: true });
      else if (action === "manage") setManage(true);
      else if (action === "save") save({ necessary: true, analytics, advertising });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && consent === null) save({ necessary: true, analytics: false, advertising: false });
    };
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [consent, analytics, advertising]);

  if (consent) return null;

  return <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-4xl rounded-3xl border border-white/12 bg-background/[.98] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5" role="dialog" aria-modal="false" aria-label="Privacy and cookie choices" style={{ pointerEvents: "auto", touchAction: "manipulation" }}>
    <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Cookie className="size-5" /></span><div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-foreground">Privacy choices</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">HkTube uses necessary storage for sign-in and core features. Optional analytics and advertising technologies are off until you choose them.</p></div><button type="button" data-hktube-consent-action="close" onClick={() => save({ necessary: true, analytics: false, advertising: false })} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close privacy choices"><X className="size-4" /></button></div>
      {manage && <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-600" /><div><p className="text-sm font-semibold text-foreground">Optional categories</p><p className="mt-1 text-xs leading-5 text-muted-foreground">No optional tracker is active in the current build. If analytics or advertising is activated later, these saved choices can be honored before loading the relevant technology where consent is required.</p></div></div><div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3"><input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} />Analytics</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3"><input type="checkbox" checked={advertising} onChange={event => setAdvertising(event.target.checked)} />Advertising</label></div></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" data-hktube-consent-action="necessary" onClick={() => save({ necessary: true, analytics: false, advertising: false })} variant="outline">Necessary only</Button><Button type="button" data-hktube-consent-action="accept" onClick={() => save({ necessary: true, analytics: true, advertising: true })} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white">Accept all optional</Button>{manage ? <Button type="button" data-hktube-consent-action="save" onClick={() => save({ necessary: true, analytics, advertising })} variant="ghost">Save choices</Button> : <Button type="button" data-hktube-consent-action="manage" onClick={() => setManage(true)} variant="ghost"><Settings2 className="mr-2 size-4" />Manage choices</Button>}<Link href="/privacy" className="ml-auto text-xs font-semibold text-violet-600 hover:text-violet-500">Privacy Policy</Link></div>
    </div></div>
  </div>;
}
