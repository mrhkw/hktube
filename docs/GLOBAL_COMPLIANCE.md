# HkTube Global Compliance Baseline

Effective baseline: 2026-09-26.

This document is an engineering compliance baseline, not a statement that HkTube has obtained legal certification in every jurisdiction.

## Global baseline

HkTube's safety architecture is designed around the UN human-rights framework and the UN Global Digital Compact principles for a safe digital environment. The implementation prioritizes privacy, freedom of expression, non-discrimination, child safety, proportionate moderation, reporting, redress and security.

## Jurisdiction overlays

- UN baseline: human rights, privacy, expression, non-discrimination, child best interests, safety and redress.
- European Union: notice/action, transparency, user redress, privacy and child-safety considerations under the Digital Services Act framework.
- United Kingdom: illegal-content safety and child-safety duties for in-scope user-to-user services.
- Australia: online-safety expectations and the current under-16 social-media account restriction where the service is in scope.
- United States: COPPA protections where the service is directed to children under 13 or has the required actual knowledge, including parental consent and data-minimization requirements where applicable.
- Brazil: child and adolescent digital-safety, privacy and age-assurance requirements under the current ECA Digital framework where applicable.
- India: local-law and grievance-process review is required for in-scope services.
- Pakistan: local-law review, content reporting and child-safety controls are required; the platform must not hard-code a universal removal deadline unless the applicable current rule requires it.

The database stores these jurisdiction overlays as versioned policy records so they can be updated without changing the core moderation model.

## Engineering controls

1. Public UGC is visible only when approved and not deleted.
2. Uploads are checked server-side before creation.
3. Comments and posts are checked server-side.
4. Users can report content and block users in-app.
5. Moderation actions are audit logged.
6. Banned creators can have public content removed from discovery.
7. Server-only moderation provider keys are never exposed to clients.
8. Community Guidelines, Terms, Privacy and Contact surfaces are available in-app.
9. Child safety is treated as a first-class requirement rather than an optional regional feature.
10. Local law can impose stricter controls than this baseline.

## Important limitation

There is no single UN rulebook that automatically makes a platform legally compliant in every country. Countries, states/provinces and regulators impose different duties, scope tests, notice procedures, age rules, privacy rights, retention rules and appeal mechanisms. HkTube therefore uses a global baseline plus jurisdiction overlays instead of pretending one checkbox makes the entire planet legally identical.

## Primary references

- UN Universal Declaration of Human Rights: https://www.un.org/en/node/124305
- UN Global Digital Compact: https://www.un.org/pact-for-the-future/en/annex-i-global-digital-compact
- UNICEF Convention on the Rights of the Child: https://www.unicef.org/child-rights-convention
- UNICEF online child-safety guidance: https://www.unicef.org/documents/child-safety-online
- Google Play UGC policy: https://support.google.com/googleplay/android-developer/answer/9876937
- European Commission Digital Services Act: https://digital-strategy.ec.europa.eu/
- UK Ofcom Online Safety guidance: https://www.ofcom.org.uk/online-safety/
- Australian eSafety Commissioner: https://www.esafety.gov.au/
- US FTC COPPA: https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
- Brazil government ECA Digital information: https://www.gov.br/mdh/
- Pakistan Ministry of IT and Telecom: https://www.moitt.gov.pk/
