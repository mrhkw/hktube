# HkTube Android / Google Play build

This directory contains the native Android shell for HkTube. It targets Android 16 / API 36, the current Google Play target for new apps and updates from 31 August 2026.

## Build

1. Install Android Studio with Android SDK 36 and a current Gradle 8.x release.
2. Open this `android/` directory in Android Studio.
3. Let Gradle sync and install the Android 36 SDK if prompted.
4. Run the debug build on a real Android device and verify login, Google sign-in, video playback, upload/file chooser, Shorts, notifications and deep links.
5. Create a release keystore that you control. Never commit the keystore or passwords.
6. Configure Play App Signing in Google Play Console and build a signed Android App Bundle (AAB).

## Production deep links

The shell accepts `https://hktube.vercel.app/...` links. For Android App Links verification, publish the SHA-256 certificate fingerprint of the final release signing certificate in `https://hktube.vercel.app/.well-known/assetlinks.json` before production rollout. The certificate fingerprint cannot be invented before the release key exists.

## Play Console checklist

- Target API 36 or higher.
- Signed AAB and Play App Signing configured.
- Store listing, screenshots, icon, feature graphic and contact details.
- Accurate Content Rating.
- Accurate Data Safety declarations.
- Privacy policy URL and in-app privacy policy.
- Account deletion path for accounts that can be created.
- User-generated-content reporting and blocking controls with active moderation.
- Ads declaration and ad/privacy disclosures if ads are enabled.
- Test login and upload flows on production before submission.
