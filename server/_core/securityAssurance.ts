export type AuthenticatorAssuranceLevel = "aal1" | "aal2";
export type AuthenticationProvider = "supabase" | "legacy" | "cron";

export type AssuranceIdentity = {
  authProvider?: AuthenticationProvider;
  authLevel?: AuthenticatorAssuranceLevel;
};

/**
 * High-impact actions require a verified Supabase second factor. Legacy
 * HkTube sessions deliberately fail closed because their token has no
 * independently verifiable MFA assurance claim.
 */
export function hasVerifiedSecondFactor(identity: AssuranceIdentity): boolean {
  return identity.authProvider === "supabase" && identity.authLevel === "aal2";
}

export const MFA_REQUIRED_MESSAGE =
  "Two-step verification is required for this action. Open Security Center, verify an authenticator, then try again.";
