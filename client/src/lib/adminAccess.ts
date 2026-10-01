export const ALLOWED_ADMIN_EMAILS = new Set([
  "hanifnazamdin30@gmail.com",
  "hanifnazamdin6@gmail.com",
]);

export function isAllowlistedAdminEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && ALLOWED_ADMIN_EMAILS.has(email.trim().toLowerCase());
}
