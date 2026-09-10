import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ChannelBadge, getSubscriberBadge } from "@/components/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bell, CircleDollarSign, Clock3, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "wouter";

const PAYOUT_MESSAGE = "Payouts are not enabled yet. When HkTube connects its secure payout provider, an alert will appear here so you can complete payout setup yourself.";

export default function Monetization() {
  const { data: channels, isLoading, isError } = trpc.channels.mine.useQuery();
  const channel = channels?.[0];
  const subscribers = channel?.subscriberCount ?? 0;
  const tier = getSubscriberBadge(subscribers);
  const next = [100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000].find(value => subscribers < value) ?? null;
  const progress = next ? Math.min(100, Math.round((subscribers / next) * 100)) : 100;

  return <HkTubeShell title="Monetization" subtitle="Creator eligibility, revenue status and payout readiness.">
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-10 sm:px-6">
      {isLoading ? <section className="rounded-3xl border border-white/10 bg-white/[.035] p-7 text-sm text-slate-400">Loading your creator status…</section> : isError ? <section className="rounded-3xl border border-red-300/20 bg-red-400/[.05] p-7 text-sm text-red-200">Monetization status could not be loaded. Refresh and try again.</section> : !channel ? <section className="rounded-3xl border border-white/10 bg-white/[.035] p-7"><h2 className="text-xl font-black text-white">Create your channel first</h2><p className="mt-2 text-sm leading-6 text-slate-400">Monetization is tied to a real HkTube channel and its recorded subscriber count.</p><Link href="/channel/create" className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-2.5 text-sm font-bold text-white">Create channel</Link></section> : <>
        <section className="rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/[.14] via-[#121827] to-cyan-400/[.08] p-6 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-cyan-300">Creator earnings</p><h1 className="mt-2 text-3xl font-black text-white">Monetization center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Eligibility is shown from real channel records. No fake approval, revenue or payout balance is displayed.</p></div><ChannelBadge subscriberCount={subscribers} verified={channel.verificationStatus === "verified"} /></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={WalletCards} label="Subscribers" value={subscribers.toLocaleString()} /><Metric icon={CircleDollarSign} label="Revenue" value="Not connected" /><Metric icon={ShieldCheck} label="Channel verification" value={channel.verificationStatus} /></div>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><div className="flex items-center gap-3"><Clock3 className="size-5 text-cyan-300" /><h2 className="font-black text-white">Subscriber milestone</h2></div><p className="mt-3 text-sm text-slate-400">{tier ? `Current milestone: ${tier.label}.` : "Your first badge milestone starts at 100 subscribers."}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-500">{next ? `${subscribers.toLocaleString()} / ${next.toLocaleString()} subscribers toward the next milestone` : "All configured subscriber milestones reached"}</p></article>
          <article className="rounded-2xl border border-amber-300/15 bg-amber-400/[.05] p-6"><div className="flex items-start gap-3"><Bell className="mt-0.5 size-5 shrink-0 text-amber-200" /><div><h2 className="font-black text-white">Payout alert</h2><p className="mt-2 text-sm leading-6 text-slate-300">{PAYOUT_MESSAGE}</p></div></div><Button type="button" variant="outline" className="mt-5 border-white/10 text-white" onClick={() => window.alert(PAYOUT_MESSAGE)}>Show payout status</Button></article>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="font-black text-white">What is ready now</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Status text="Real subscriber count" /><Status text="Subscriber milestone badges" /><Status text="Manual admin verification" /><Status text="Payout setup alert when provider is connected" /></div><div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">HkTube does not claim a payout balance or “approved” earnings until a real payment provider and eligibility decision exist.</div></section>
      </>}
    </div>
  </HkTubeShell>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="size-4 text-cyan-200" /><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }
function Status({ text }: { text: string }) { return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300"><span className="size-2 rounded-full bg-emerald-300" />{text}</div>; }
