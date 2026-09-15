import { BadgeCheck, Crown, Sparkles } from "lucide-react";

export type BadgeTier = {
  key: "starter" | "creator" | "rising" | "pro" | "million" | "gold" | "diamond";
  label: string;
  threshold: number;
  className: string;
};

/** Public subscriber milestones stop at 100M. Billion/trillion scale is not a public badge tier. */
export const BADGE_TIERS: BadgeTier[] = [
  { key: "starter", label: "100 subscribers", threshold: 100, className: "border-sky-300/50 bg-sky-400/15 text-sky-200" },
  { key: "creator", label: "1K subscribers", threshold: 1_000, className: "border-violet-300/50 bg-violet-400/15 text-violet-200" },
  { key: "rising", label: "10K subscribers", threshold: 10_000, className: "border-fuchsia-300/50 bg-fuchsia-400/15 text-fuchsia-200" },
  { key: "pro", label: "100K subscribers", threshold: 100_000, className: "border-cyan-300/50 bg-cyan-400/15 text-cyan-200" },
  { key: "million", label: "1M subscribers", threshold: 1_000_000, className: "border-amber-300/50 bg-amber-400/15 text-amber-200" },
  { key: "gold", label: "10M subscribers · Golden tier", threshold: 10_000_000, className: "border-yellow-200/70 bg-yellow-300/20 text-yellow-100" },
  { key: "diamond", label: "100M subscribers", threshold: 100_000_000, className: "border-sky-100/80 bg-sky-100/15 text-sky-50" },
];

/**
 * Scale-security tiers are deliberately separate from public subscriber badges.
 * They are operational/security architecture milestones, not cosmetic channel awards.
 */
export const SECURITY_SCALE_LAYERS = [
  { key: "billion", threshold: 1_000_000_000, label: "Billion-scale security layer", purpose: "High-scale abuse, rate-limit and integrity controls" },
  { key: "ten-billion", threshold: 10_000_000_000, label: "10B-scale security layer", purpose: "Distributed protection and anomaly-response controls" },
  { key: "hundred-billion", threshold: 100_000_000_000, label: "100B-scale security layer", purpose: "Critical-scale isolation, audit and recovery controls" },
  { key: "trillion", threshold: 1_000_000_000_000, label: "Trillion security layer", purpose: "Highest-scale defense, isolation, key rotation and recovery architecture" },
] as const;

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
