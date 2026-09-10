import { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [consentReady, setConsentReady] = useState(false);

  useEffect(() => {
    const syncConsent = () => setConsentReady(Boolean(window.localStorage.getItem("hktube-consent-v1")));
    syncConsent();
    window.addEventListener("hktube-consent-changed", syncConsent);
    const handler = (event: Event) => {
      event.preventDefault();
      const nextEvent = event as BeforeInstallPromptEvent;
      const dismissedAt = Number(window.localStorage.getItem("hktube-install-dismissed") || 0);
      setInstallEvent(nextEvent);
      setVisible(Boolean(window.localStorage.getItem("hktube-consent-v1")) && Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) setVisible(false);
    return () => { window.removeEventListener("beforeinstallprompt", handler); window.removeEventListener("hktube-consent-changed", syncConsent); };
  }, []);

  useEffect(() => {
    if (!consentReady || !installEvent) return;
    const dismissedAt = Number(window.localStorage.getItem("hktube-install-dismissed") || 0);
    setVisible(Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000);
  }, [consentReady, installEvent]);

  if (!visible || !installEvent || !consentReady) return null;

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
    if (choice.outcome === "dismissed") window.localStorage.setItem("hktube-install-dismissed", String(Date.now()));
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-xl rounded-2xl border border-violet-300/20 bg-[#111625]/95 p-4 shadow-2xl shadow-violet-950/30 backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:ml-auto">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Download className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><Sparkles className="size-3.5 text-fuchsia-300" aria-hidden="true" /><p className="text-sm font-bold text-white">Install HkTube</p></div>
          <p className="mt-1 text-xs leading-5 text-slate-400">Add HkTube to your home screen for a faster, app-like viewing experience.</p>
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void install()} className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white">Install app</Button><Button size="sm" variant="ghost" onClick={() => { setVisible(false); setInstallEvent(null); }} className="text-slate-300">Later</Button></div>
        </div>
        <button type="button" aria-label="Dismiss install prompt" onClick={() => { setVisible(false); setInstallEvent(null); }} className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
      </div>
    </div>
  );
}
