import { useEffect, useState } from "react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Info, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { getAdConsent, setAdConsent, type AdConsent } from "@/components/AdConsentBanner";

const clientId = ((import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) || "ca-pub-6377077633182623").trim();
const homeSlot = ((import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined) || "6094472305").trim();
const hasClient = clientId.startsWith("ca-pub-");
const hasSlot = homeSlot.length > 0;

export default function AdSettings() {
  const [consent, setConsent] = useState<AdConsent | null>(() => getAdConsent());
  useEffect(() => {
    const sync = () => setConsent(getAdConsent());
    window.addEventListener("hktube-ad-consent-changed", sync);
    return () => window.removeEventListener("hktube-ad-consent-changed", sync);
  }, []);

  return <HkTubeShell title="Advertising & AdSense" subtitle="Privacy-first Google AdSense display advertising for public discovery pages."><div className="mx-auto max-w-4xl space-y-5">
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-black text-white"><ShieldCheck className="size-5" /></span><div><h2 className="text-xl font-bold">AdSense integration status</h2><p className="mt-1 text-sm text-neutral-500">The publisher ID, ad unit and consent-gated loader are present. Google still controls publisher approval and fill.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Status label="Publisher ID" ok={hasClient} /><Status label="Home ad unit" ok={hasSlot} /><Status label="Consent gate" ok={true} /></div></section>
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8"><div className="flex gap-3"><Info className="mt-1 size-5 shrink-0" /><div><h2 className="font-bold">Configured publisher</h2><div className="mt-3 space-y-2 text-sm text-neutral-600"><p>Publisher: <code className="rounded bg-neutral-100 px-1.5 py-0.5">{clientId}</code></p><p>Home slot: <code className="rounded bg-neutral-100 px-1.5 py-0.5">{homeSlot}</code></p><p>Request mode: <b>non-personalized ads</b> for this integration.</p></div></div></div></section>
    <section className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8"><h2 className="font-bold">Your advertising choice</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Ads are not loaded until you choose “Allow ads”. “Essential only” keeps advertising requests disabled on this browser. Changing this choice immediately updates the HkTube consent state.</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant={consent === "essential" ? "default" : "outline"} onClick={() => { setAdConsent("essential"); setConsent("essential"); }} className={consent === "essential" ? "bg-black text-white" : ""}>Essential only</Button><Button type="button" variant={consent === "ads" ? "default" : "outline"} onClick={() => { setAdConsent("ads"); setConsent("ads"); }} className={consent === "ads" ? "bg-black text-white" : ""}>Allow ads</Button></div><p className="mt-3 text-xs text-neutral-500">Current choice: {consent === "ads" ? "Ads allowed" : consent === "essential" ? "Essential only" : "No choice yet"}</p></section>
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8"><h2 className="font-bold">Google activation checklist</h2><ol className="mt-3 space-y-3 text-sm leading-6 text-neutral-600"><li><b>1.</b> Add <code>hktube.vercel.app</code> to your Google AdSense Sites list and request review.</li><li><b>2.</b> Confirm that publisher <code>{clientId}</code> and ad unit <code>{homeSlot}</code> belong to the same approved AdSense account.</li><li><b>3.</b> Keep <code>ads.txt</code> reachable at <code>/ads.txt</code>.</li><li><b>4.</b> Google controls approval and when ads begin serving; code alone does not guarantee approval.</li></ol><div className="mt-6 flex flex-wrap gap-3"><Button asChild className="bg-black text-white"><a href="https://www.google.com/adsense/" target="_blank" rel="noreferrer">Open Google AdSense <ExternalLink className="ml-2 size-4" /></a></Button><Button asChild variant="outline"><Link href="/privacy">Privacy policy</Link></Button><Button asChild variant="outline"><Link href="/cookies">Cookies</Link></Button><Button asChild variant="outline"><Link href="/advertising">Advertising disclosure</Link></Button></div></section>
  </div></HkTubeShell>;
}
function Status({ label, ok }: { label: string; ok: boolean }) { return <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className={`size-4 ${ok ? "text-black" : "text-neutral-400"}`} />{label}</div><p className="mt-1 text-xs text-neutral-500">{ok ? "Ready in code" : "Needs configuration"}</p></div>; }
