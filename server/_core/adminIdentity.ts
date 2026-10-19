import { isOwnerEmail } from "./env";

export type AdminIdentitySource = "local" | "external";

export type AdminIdentityCandidate = {
  source: AdminIdentitySource;
  openId: string;
  email: string | null | undefined;
  emailVerified?: boolean;
};

/** Local signup fields are attacker-controlled; only a verified identity or an exact server-configured subject can be promoted. */
export function isTrustedAdminIdentity(
  identity: AdminIdentityCandidate,
  ownerOpenId = process.env.OWNER_OPEN_ID ?? "",
): boolean {
  if (identity.source === "local") return false;
  const configuredOwnerId = ownerOpenId.trim();
  if (configuredOwnerId && identity.openId === configuredOwnerId) return true;
  return identity.emailVerified === true && isOwnerEmail(identity.email);
}

export type AdminPrincipal = {
  openId: string;
  email: string | null;
  loginMethod: string | null;
  role: string;
};

export function canUseAdminProcedures(
  user: AdminPrincipal | null | undefined,
  ownerOpenId = process.env.OWNER_OPEN_ID ?? "",
): boolean {
  if (!user || user.role !== "admin" || user.loginMethod === "hktube-local") return false;
  const configuredOwnerId = ownerOpenId.trim();
  return Boolean(
    (configuredOwnerId && user.openId === configuredOwnerId) ||
    isOwnerEmail(user.email),
  );
}
