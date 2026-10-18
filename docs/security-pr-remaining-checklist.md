# HkTube Security PR: Remaining Operator Checklist

This checklist is intentionally honest: repository edits and a passing CI run do not prove production security or Google Play readiness.

## Automated in this PR
- Android release minification/resource shrinking configuration.
- WebView SSL errors are explicitly cancelled.
- Android build/lint CI is added for future pull requests.
- A reviewed SQL migration changes public video search to SECURITY INVOKER and removes anonymous execution from the comment-write RPC.

## Still requires a human/account owner
1. Review PR #41 and wait for GitHub Actions. Do not merge if checks fail.
2. Confirm the Vercel project is visible to the connected integration; the current connector lookup returned 404. Verify the preview URL and test login, upload, playback, Clips, reporting, and deletion from a clean browser.
3. In Supabase Dashboard > Authentication > Security and Protection, enable leaked-password protection if available for the project's plan/configuration, then test signup/password reset.
4. Review and apply the SQL migration through the normal migration/deployment process only after PR review. It has not been applied to production by this PR.
5. Review every RLS-enabled public table with no policies. Tables with no client grants may intentionally be service-role-only; do not add generic policies to them. Confirm grants and intended access before changes.
6. Configure and verify the server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel if the app's server-side account deletion/admin features require it. Never place this key in `VITE_*` variables or browser code.
7. Finish real account deletion: the current `/delete-account` UI opens a mail draft and does not itself delete the account. Test a server-side, identity-verified deletion workflow and its dependent data retention rules before Play submission.
8. Run a full-history secret scan (e.g. Gitleaks) and remediate any findings by rotating exposed credentials. Never paste secret values into issues or logs.
9. Create the release upload key locally or in an approved secret manager; never commit the keystore or its passwords.
10. On a real Android device, verify signup/login, upload/file picker, playback, Clips, HTTPS/deep links, account deletion, and back navigation.
11. Build and inspect the signed AAB, archive `mapping.txt`, record the signing certificate fingerprint, and complete Play Console Data Safety, content rating, UGC/reporting, privacy policy, account deletion URL, and tester requirements.

## Current verified blockers
- Android build/lint and signed AAB have not yet been run in this workflow execution.
- Vercel project/preview verification is blocked by connector 404.
- Supabase leaked-password protection was reported disabled by Security Advisor.
- Account deletion currently opens an email draft rather than completing deletion.
