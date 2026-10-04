# HkTube Android / Google Play build

This directory contains the native Android shell for HkTube. It targets Android 16 / API 36, which is the current Google Play target for new apps and updates from 31 August 2026.

## Build

1. Install Android Studio with Android SDK 36 and a current Gradle 8.x release.
2. Open this `android/` directory in Android Studio.
3. Let Gradle sync and install the Android 36 SDK if prompted.
4. Run the debug build on a real Android device and verify email sign-in/sign-up, video playback, upload/file chooser, Shorts, account deletion, advertising consent and deep links.
5. Google OAuth must not run inside the embedded WebView. HkTube launches the exact first-party HTTPS login in Chrome; the native shell validates that intent and only accepts its own HTTPS App Link callback. Chrome and WebView storage are separate, so use Chrome after sign-in until the production App Link association has been verified.
6. Create a release keystore that you control. Never commit the keystore or passwords.
7. Configure Play App Signing in Google Play Console and build a signed Android App Bundle (AAB).

## Security and permissions

The production manifest requests only INTERNET. Notification permission is not requested until a real notification provider is implemented. Cleartext HTTP is disabled by the network-security configuration.

## Production deep links

The shell accepts only exact-host `https://hktube.vercel.app/...` links. For automatic Google OAuth return into the app, publish a correct `https://hktube.vercel.app/.well-known/assetlinks.json` containing the final release package and SHA-256 signing-certificate fingerprint, then verify Android App Links on a release-signed installation. Until then, Chrome and the embedded WebView do not share their Supabase browser session; continue using HkTube in Chrome. The certificate fingerprint cannot be invented before the release signing key exists.

## Google Play checklist

- Target API 36 or higher.
- Signed AAB and Play App Signing configured.
- Package name `com.hktube.app` registered in Play Console when required.
- Store listing, 512×512 PNG icon, screenshots, feature graphic and support contact.
- Accurate Content Rating.
- Accurate Data Safety declarations covering the WebView, authentication, uploads, user-generated content, storage and advertising providers actually used.
- Privacy policy URL and in-app privacy policy.
- Account deletion path at `/delete-account`.
- User-generated-content reporting and moderation controls active before production submission.
- Ads declaration set to Contains ads because HkTube can display Google AdSense on public discovery pages.
- Advertising/privacy consent tested on a clean device.
- Reviewer instructions and a demo account prepared if production-only features require sign-in.
- Test login, channel creation, upload, playback, reporting and deletion flows on production before submission.

See `play-store/README.md` for the complete listing and operator checklist.
