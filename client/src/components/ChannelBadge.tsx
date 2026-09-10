import { BadgeCheck, Crown, Sparkles } from "lucide-react";

export type BadgeTier = {
  key: "starter" | "creator" | "rising" | "pro" | "million" | "gold";
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
];

/** Returns the highest subscriber milestone a channel has actually reached. */
export function getSubscriberBadge(subscriberCount: number): BadgeTier | null {
  return [...BADGE_TIERS].reverse().find(tier => subscriberCount >= tier.threshold) ?? null;
}

export function ChannelBadge({ subscriberCount, verified = false, compact = false }: { subscriberCount: number; verified?: boolean; compact?: boolean }) {
  const tier = getSubscriberBadge(subscriberCount);
  if (!tier && !verified) return null;
  return <span title={verified ? `Verified HkTube channel${tier ? ` · ${tier.label}` : ""}` : tier?.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-bold ${compact ? "text-[10px]" : "text-xs"} ${tier?.className ?? "border-cyan-300/50 bg-cyan-400/15 text-cyan-200"}`}>
    {tier?.key === "gold" ? <Crown className="size-3" aria-hidden="true" /> : verified ? <BadgeCheck className="size-3" aria-hidden="true" /> : <Sparkles className="size-3" aria-hidden="true" />}
    {verified ? "Verified" : tier?.label}
  </span>;
}
