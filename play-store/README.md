# HkTube Google Play release pack

This folder is the release checklist for the Android shell in `android/`.

## App identity

- App name: HkTube
- Package name: `com.hktube.app`
- Target API: 36 (Android 16)
- Minimum API: 26
- Current version: 1.0.0 / versionCode 1
- Website: https://hktube.vercel.app/
- Privacy policy: https://hktube.vercel.app/privacy
- Account deletion: https://hktube.vercel.app/delete-account
- Support: hanifnazamdin17@gmail.com

## Store listing draft

### Short description
Watch, discover, create channels, and publish videos on HkTube.

### Full description
HkTube is a creator-first video platform for watching, discovering and publishing video content.

• Discover public videos, Shorts and trending content.
• Follow creators and keep your own library.
• Create a channel and publish original videos.
• Upload thumbnails and captions when supported.
• Manage your account, privacy choices and creator settings.
• Report content that violates HkTube's Community Guidelines.
• Request account deletion from inside the app or on the web.

HkTube requires an account only for account-based features such as publishing and creator tools. Video playback and public discovery can be used without an account where available.

### Store support email
hanifnazamdin17@gmail.com

## Play Console declarations to prepare

1. Privacy policy: use the active HkTube privacy URL above.
2. Data Safety: declare all data collected or shared by the HkTube WebView, Supabase/Auth, media storage, and Google advertising integration. Do not mark a category as not collected merely because the Android shell itself does not have a native SDK for it.
3. Ads: select that the app contains ads because public discovery pages can load Google AdSense after the user's advertising choice.
4. Content rating: complete the official questionnaire based on the actual production content and moderation rules.
5. Target audience: select the actual intended audience; do not mark the app as child-directed unless it is genuinely designed and operated for children.
6. App access: provide reviewer instructions and a working demo account if any restricted production functionality cannot be reviewed while signed out.
7. Account deletion: keep `/delete-account` reachable from the app and website and make sure deletion requests are actually processed by the operator.
8. UGC: keep reporting, moderation, community rules and support routes active before production submission.
9. App package registration: register `com.hktube.app` in Play Console when prompted by Android developer verification requirements.
10. Identity and developer profile: complete Play Console identity/contact verification and keep the legal/support information consistent.
11. App signing: use Play App Signing and keep the upload/release keystore private and backed up.
12. Testing: if the Play developer account is a new personal account created after 13 November 2023, complete the required closed test with at least 12 opted-in testers continuously for 14 days before requesting production access.

## Release assets

Play Console requires a 512×512 PNG app icon for the store listing and screenshots. The repository currently contains the HkTube vector launcher icon; create the final 512×512 PNG from the approved brand artwork before uploading the listing. Do not use Google/YouTube branding in HkTube assets.

Recommended screenshot set:
- Home / discovery
- Shorts
- Watch video
- Create channel
- Upload video
- Profile / creator tools
- Settings / privacy

Use real production screens, no fake metrics, fake reviews, fake ad revenue, or claims that are not available in the submitted build.

## Reviewer access

Before production submission, verify from a clean device:
- email sign-up and login
- email verification flow
- channel creation
- video/file picker
- video playback
- Shorts playback
- privacy pages
- advertising consent
- account deletion request
- content reporting
- back navigation and deep links

## Known operator actions that cannot be automated from the repository

- Play Console developer identity verification
- Play App Signing configuration
- final release signing key creation
- closed-test tester enrollment and 14-day duration
- production access request
- Play review submission
- AdSense site review/approval
- confirmation that the configured publisher/ad unit is approved and serving

These are account-level Google actions and must be completed in the relevant Google consoles. Never commit private keys, passwords, OAuth client secrets, or payment information to this repository.
