import { useEffect, useRef, useState } from "react";
import { getAdConsent } from "./AdConsentBanner";

const ADS_ENABLED = import.meta.env.VITE_ADS_ENABLED === "true";
const clientId = ((import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) || "ca-pub-6377077633182623").trim();
const defaultSlot = ((import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined) || "6094472305").trim();
let scriptPromise: Promise<void> | null = null;

function loadAdSense() {
  if (typeof window === "undefined") return Promise.reject(new Error("AdSense is browser-only."));
  if ((window as typeof window & { adsbygoogle?: unknown[] }).adsbygoogle) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-hktube-adsense="true"]');
    if (existing) { existing.addEventListener("load", () => resolve()); existing.addEventListener("error", () => reject(new Error("AdSense failed to load."))); return; }
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.hktubeAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("AdSense failed to load."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

type Props = { slot?: string; label?: string };

export function AdSenseAd({ slot = defaultSlot, label = "Advertisement" }: Props) {
  const ref = useRef<HTMLModElement | null>(null);
  const [enabled, setEnabled] = useState(() => ADS_ENABLED && getAdConsent() === "ads");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(ADS_ENABLED && getAdConsent() === "ads");
    window.addEventListener("hktube-ad-consent-changed", sync);
    return () => window.removeEventListener("hktube-ad-consent-changed", sync);
  }, []);

  useEffect(() => {
    if (!enabled || !clientId.startsWith("ca-pub-") || !slot || !ref.current) return;
    let active = true;
    void loadAdSense().then(() => {
      if (!active || !ref.current) return;
      const ads = (window as typeof window & { adsbygoogle?: unknown[] }).adsbygoogle = (window as typeof window & { adsbygoogle?: unknown[] }).adsbygoogle || [];
      (ads as unknown[] & { requestNonPersonalizedAds?: number }).requestNonPersonalizedAds = 1;
      ads.push({});
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [enabled, slot]);

  if (!enabled || failed || !clientId.startsWith("ca-pub-") || !slot) return null;
  return <section className="mx-auto my-7 w-full max-w-5xl" aria-label={label}>
    <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">{label}</p>
    <div className="min-h-[100px] overflow-hidden rounded-2xl border border-white/6 bg-white/[.015] px-2 py-2 sm:min-h-[120px]">
      <ins ref={ref} className="adsbygoogle block" style={{ display: "block", minHeight: 90, width: "100%" }} data-ad-client={clientId} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  </section>;
}
