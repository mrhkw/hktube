import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { ChannelBadge, getSubscriberBadge } from "@/components/ChannelBadge";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bell, CircleDollarSign, Clock3, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "wouter";

const PAYOUT_MESSAGE = "Payouts are not enabled yet. When HkTube connects its secure payout provider, an alert will appear here so you can complete payout setup yourself.";

export default function Monetization() {
  const { data: channels, isLoading, isError } = trpc.channels.mine.useQuery();
  const studio = trpc.creator_studio.dashboard.useQuery();
  const channel = channels?.[0];
  const subscribers = channel?.subscriberCount ?? 0;
  const watchHours = studio.data?.analytics.watchHours ?? 0;
  const eligible = subscribers >= 500 && watchHours >= 500;
  const tier = getSubscriberBadge(subscribers);
  const subscriberProgress = Math.min(100, Math.round((subscribers / 500) * 100));
  const watchProgress = Math.min(100, Math.round((watchHours / 500) * 100));

  return <HkTubeShell title="Monetization" subtitle="Creator eligibility, revenue status and payout readiness.">
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-10 sm:px-6">
      {isLoading ? <section className="rounded-3xl border border-white/10 bg-white/[.035] p-7 text-sm text-slate-400">Loading your creator status…</section> : isError ? <section className="rounded-3xl border border-red-300/20 bg-red-400/[.05] p-7 text-sm text-red-200">Monetization status could not be loaded. Refresh and try again.</section> : !channel ? <section className="rounded-3xl border border-white/10 bg-white/[.035] p-7"><h2 className="text-xl font-black text-white">Create your channel first</h2><p className="mt-2 text-sm leading-6 text-slate-400">Monetization is tied to a real HkTube channel and its recorded subscriber count.</p><Link href="/channel/create" className="mt-5 inline-flex rounded-full bg-violet-500 px-5 py-2.5 text-sm font-bold text-white">Create channel</Link></section> : <>
        <section className="rounded-3xl border border-violet-300/15 bg-gradient-to-br from-violet-500/[.14] via-[#121827] to-cyan-400/[.08] p-6 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-cyan-300">Creator earnings</p><h1 className="mt-2 text-3xl font-black text-white">Monetization center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Eligibility is shown from real channel records. No fake approval, revenue or payout balance is displayed.</p></div><ChannelBadge subscriberCount={subscribers} verified={channel.verificationStatus === "verified"} /></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={WalletCards} label="Subscribers" value={subscribers.toLocaleString()} /><Metric icon={Clock3} label="Watch hours" value={watchHours.toLocaleString()} /><Metric icon={CircleDollarSign} label="Revenue" value="Not connected" /><Metric icon={ShieldCheck} label="Eligibility" value={eligible ? "Eligible" : "Not yet"} /></div>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><div className="flex items-center gap-3"><Clock3 className="size-5 text-cyan-300" /><h2 className="font-black text-white">Eligibility progress</h2></div><p className="mt-3 text-sm text-slate-400">Creator eligibility requires <strong className="text-white">500 subscribers</strong> and <strong className="text-white">500 watch hours</strong>.</p><div className="mt-4 space-y-3"><Progress label="Subscribers" value={subscribers} target={500} progress={subscriberProgress} /><Progress label="Watch hours" value={watchHours} target={500} progress={watchProgress} /></div><p className="mt-4 text-xs font-semibold text-cyan-200">{eligible ? "Eligibility threshold reached. Payouts remain disabled for now." : "Keep creating to reach the eligibility threshold."}</p></article>
          <article className="rounded-2xl border border-amber-300/15 bg-amber-400/[.05] p-6"><div className="flex items-start gap-3"><Bell className="mt-0.5 size-5 shrink-0 text-amber-200" /><div><h2 className="font-black text-white">Withdraw is temporarily unavailable</h2><p className="mt-2 text-sm leading-6 text-slate-300">{PAYOUT_MESSAGE}</p></div></div><Link href="/wallet" className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Open withdraw</Link></article>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-6"><h2 className="font-black text-white">What is ready now</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Status text="Real subscriber count" /><Status text="Subscriber milestone badges" /><Status text="Manual admin verification" /><Status text="Payout setup alert when provider is connected" /></div><div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-4 text-xs leading-5 text-slate-500">HkTube does not claim a payout balance or “approved” earnings until a real payment provider and eligibility decision exist.</div></section>
      </>}
    </div>
  </HkTubeShell>;
}

function Progress({ label, value, target, progress }: { label: string; value: number; target: number; progress: number }) { return <div><div className="mb-1 flex justify-between text-xs text-slate-400"><span>{label}</span><span>{value.toLocaleString()} / {target.toLocaleString()}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" style={{ width: `${progress}%` }} /></div></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-black/15 p-4"><Icon className="size-4 text-cyan-200" /><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }
function Status({ text }: { text: string }) { return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300"><span className="size-2 rounded-full bg-emerald-300" />{text}</div>; }
