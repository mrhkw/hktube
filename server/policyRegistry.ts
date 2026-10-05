export const HKTUBE_POLICY_VERSION = "hktube-policy-2026-10-05";

export type PolicyAction = "ALLOW" | "REVIEW" | "BLOCK" | "REMOVE";

export const HKTUBE_POLICY_RULES = [
  { id: "CHILD_SAFETY_HIGH_CONFIDENCE", action: "REMOVE" as const, threshold: 0.8, signal: "child_safety_confidence", reversible: true, humanEscalation: true },
  { id: "ADULT_OR_SEXUAL_HIGH_CONFIDENCE", action: "REMOVE" as const, threshold: 0.9, signal: "sexual_confidence", reversible: true, humanEscalation: false },
  { id: "GRAPHIC_CONTENT_HIGH_CONFIDENCE", action: "REMOVE" as const, threshold: 0.95, signal: "graphic_confidence", reversible: true, humanEscalation: false },
  { id: "PROHIBITED_SAFETY_HIGH_CONFIDENCE", action: "BLOCK" as const, threshold: 0.9, signal: "safety_confidence", reversible: true, humanEscalation: true },
  { id: "DUPLICATE_REVIEW", action: "REVIEW" as const, threshold: 0.92, signal: "duplicate_score", reversible: true, humanEscalation: true },
  { id: "MEDIUM_CONFIDENCE_REVIEW", action: "REVIEW" as const, threshold: 0.6, signal: "safety_confidence", reversible: true, humanEscalation: true },
] as const;

export function getPolicyRule(id: string) {
  return HKTUBE_POLICY_RULES.find(rule => rule.id === id) ?? null;
}
