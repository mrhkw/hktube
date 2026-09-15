import { BadgeCheck, Crown, Sparkles } from "lucide-react";

export type BadgeTier = {
  key: "starter" | "creator" | "rising" | "pro" | "million" | "gold" | "diamond" | "sapphire" | "ruby" | "emerald" | "platinum";
  label: string;
  threshold: number;
  className: string;
};

export const BADGE_TIERS: BadgeTier[] = [
  { key: "starter", label: "100 subscribers", threshold: 100, className: "border-sky-300/50 bg-sky-400/15 text-sky-200" },
  { key: "creator", label: "1K subscribers", threshold: 1_000, className: "border-violet-300/50 bg-violet-400/15 text-violet-200" },
  { key: "rising", label: "10K subscribers", threshold: 10_000, className: "border-fuchsia-300/50 bg-fuchsia-400/15 text-fuchsia-200" },
  { key: "pro", label: "100K subscribers", threshold: 100_000, className: "border-cyan-300/50 bg-cyan-400/15 text-cyan-200" },
  { key: "million", label: "1M subscribers", threshold: 1_000_000, className: "border-amber-300/50 bg-amber-400/15 text-amber-200" },
  { key: "gold", label: "10M subscribers", threshold: 10_000_000, className: "border-yellow-200/70 bg-yellow-300/20 text-yellow-100" },
  { key: "diamond", label: "100M subscribers", threshold: 100_000_000, className: "border-sky-100/80 bg-sky-100/15 text-sky-50" },
  { key: "sapphire", label: "1B subscribers", threshold: 1_000_000_000, className: "border-blue-400/70 bg-blue-500/15 text-blue-200" },
  { key: "ruby", label: "10B subscribers", threshold: 10_000_000_000, className: "border-red-400/70 bg-red-500/15 text-red-200" },
  { key: "emerald", label: "100B subscribers", threshold: 100_000_000_000, className: "border-emerald-400/70 bg-emerald-500/15 text-emerald-200" },
  { key: "platinum", label: "1T subscribers", threshold: 1_000_000_000_000, className: "border-white/70 bg-white/10 text-white" },
];

/** Returns the highest subscriber milestone a channel has actually reached. */
export function getSubscriberBadge(subscriberCount: number): BadgeTier | null {
  return [...BADGE_TIERS].reverse().find(tier => subscriberCount >= tier.threshold) ?? null;
}

export function ChannelBadge({ subscriberCount, verified = false, compact = false, verifiedColor = "#3EA6FF" }: { subscriberCount: number; verified?: boolean; compact?: boolean; verifiedColor?: string }) {
  const tier = getSubscriberBadge(Math.max(0, subscriberCount));
  if (!tier && !verified) return null;
  const size = compact ? "text-[10px]" : "text-xs";
  return <span className="inline-flex flex-wrap items-center gap-1.5" title={verified ? `Verified HkTube channel${tier ? ` · ${tier.label}` : ""}` : tier?.label}>
    {verified && <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-bold ${size}`} style={{ borderColor: `${verifiedColor}66`, backgroundColor: `${verifiedColor}22`, color: verifiedColor }}><BadgeCheck className="size-3" aria-hidden="true" />Verified</span>}
    {tier && <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-bold ${size} ${tier.className}`}><span className="sr-only">Subscriber milestone: </span>{tier.key === "gold" ? <Crown className="size-3" aria-hidden="true" /> : <Sparkles className="size-3" aria-hidden="true" />}{tier.label}</span>}
  </span>;
}
