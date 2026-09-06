import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Info, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const clientId = ((import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined) || "ca-pub-6377077633182623").trim();
const homeSlot = ((import.meta.env.VITE_ADSENSE_HOME_SLOT as string | undefined) || "6094472305").trim();
const hasClient = clientId.startsWith("ca-pub-");
const hasSlot = homeSlot.length > 0;

export default function AdSettings() {
  return <HkTubeShell title="Advertising & AdSense" subtitle="HkTube AdSense integration is configured for the supplied publisher account."><div className="mx-auto max-w-4xl space-y-5">
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-11 place-items-center rounded-2xl bg-black text-white"><ShieldCheck className="size-5" /></span><div><h2 className="text-xl font-bold">AdSense integration status</h2><p className="mt-1 text-sm text-neutral-500">Publisher and homepage ad unit are configured in the app.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Status label="AdSense code" ok={hasClient} /><Status label="Home ad unit" ok={hasSlot} /><Status label="Responsive ad units" ok={hasClient && hasSlot} /></div></section>
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8"><div className="flex gap-3"><Info className="mt-1 size-5 shrink-0" /><div><h2 className="font-bold">Configured HkTube AdSense</h2><div className="mt-3 space-y-2 text-sm text-neutral-600"><p>Publisher: <code className="rounded bg-neutral-100 px-1.5 py-0.5">{clientId}</code></p><p>Home slot: <code className="rounded bg-neutral-100 px-1.5 py-0.5">{homeSlot}</code></p></div></div></div></section>
    <section className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8"><h2 className="font-bold">Activation checklist</h2><ol className="mt-3 space-y-3 text-sm leading-6 text-neutral-600"><li><b>1.</b> Add hktube.vercel.app to your Google AdSense Sites list and request review.</li><li><b>2.</b> Make sure the supplied ad unit remains active in AdSense.</li><li><b>3.</b> Google controls approval and when ads begin serving; code alone does not guarantee approval.</li></ol><div className="mt-6 flex flex-wrap gap-3"><Button asChild className="bg-black text-white"><a href="https://www.google.com/adsense/" target="_blank" rel="noreferrer">Open Google AdSense <ExternalLink className="ml-2 size-4" /></a></Button><Button asChild variant="outline"><Link href="/privacy">Privacy policy</Link></Button><Button asChild variant="outline"><Link href="/cookies">Cookies</Link></Button></div></section>
  </div></HkTubeShell>;
}
function Status({ label, ok }: { label: string; ok: boolean }) { return <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"><div className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className={`size-4 ${ok ? "text-black" : "text-neutral-400"}`} />{label}</div><p className="mt-1 text-xs text-neutral-500">{ok ? "Configured" : "Needs configuration"}</p></div>; }
