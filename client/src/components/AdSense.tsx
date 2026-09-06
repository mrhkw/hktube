import { useEffect } from "react";

declare global {
  interface Window { adsbygoogle?: unknown[]; }
}

const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const enabled = Boolean(clientId?.startsWith("ca-pub-"));

export function AdSenseLoader() {
  useEffect(() => {
    if (!enabled || !clientId) return;
    if (document.querySelector('script[data-hktube-adsense="true"]')) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.hktubeAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    document.head.appendChild(script);
  }, []);
  return null;
}

export function HkTubeAd({ slot, className = "" }: { slot?: string; className?: string }) {
  useEffect(() => {
    if (!enabled || !clientId || !slot) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* AdSense may not be ready yet. */ }
  }, [slot]);
  if (!enabled || !clientId || !slot) return null;
  return <div className={`min-h-[90px] w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 ${className}`} aria-label="Advertisement">
    <ins className="adsbygoogle block" style={{ minHeight: 76 }} data-ad-client={clientId} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
  </div>;
}
