import { useEffect, useState } from "react";
import { getHkTubeConsent } from "./ConsentBanner";

declare global {
  interface Window { adsbygoogle?: unknown[]; }
}

const clientId = ((import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) || "").trim();
const homeSlot = ((import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined) || "").trim();
const configured = clientId.startsWith("ca-pub-") && homeSlot.length > 0;

function useAdvertisingConsent() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(getHkTubeConsent().advertising);
    sync();
    window.addEventListener("hktube-consent-changed", sync);
    return () => window.removeEventListener("hktube-consent-changed", sync);
  }, []);
  return allowed;
}

export function AdSenseLoader() {
  const allowed = useAdvertisingConsent();
  useEffect(() => {
    if (!configured || !allowed) return;
    if (document.querySelector('script[data-hktube-adsense="true"]')) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.hktubeAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    document.head.appendChild(script);
  }, [allowed]);
  return null;
}

export function HkTubeAd({ slot = homeSlot, className = "" }: { slot?: string; className?: string }) {
  const allowed = useAdvertisingConsent();
  useEffect(() => {
    if (!configured || !allowed || !slot) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* AdSense may not be ready yet. */ }
  }, [slot, allowed]);
  if (!configured || !allowed || !slot) return null;
  return <div className={`min-h-[90px] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 ${className}`} aria-label="Advertisement">
    <ins className="adsbygoogle block" style={{ minHeight: 76 }} data-ad-client={clientId} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
  </div>;
}
