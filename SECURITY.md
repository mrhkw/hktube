# HkTube Security

HkTube treats authentication, authorization, uploads, API traffic, user content and third-party integrations as security boundaries.

## Implemented controls

- Strict security response headers and CSP.
- HTTPS/HSTS enforcement in production.
- Same-origin checks for cookie-authenticated mutations.
- Request URL, method and header-size limits.
- JSON and URL-encoded body limits.
- API rate limiting with separate authentication and media-upload budgets.
- Path traversal and null-byte request rejection.
- Server-side input/output safety helpers.
- SSRF-resistant URL validation for server-side external fetch boundaries.
- Supabase Row Level Security and authorization-aware database functions.
- Dependency audit and TypeScript/build checks in CI.
- CodeQL static analysis in CI.
- Request IDs and security event logging.
- No service-role credentials in browser code.

## Deployment rule

A security control is considered active only after the corresponding code/configuration is deployed and verified. Infrastructure controls such as managed WAF, DDoS protection, bot management and provider-level firewall rules must also be enabled at the hosting/provider layer; application code alone cannot honestly claim those controls exist.

## Operational requirements

Rotate exposed credentials immediately if a secret is suspected to have leaked. Keep production and preview secrets separate. Review Supabase security advisors after database changes and keep RLS policies under regression testing.
