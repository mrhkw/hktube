# HkTube vs YouTube mobile app: full website review

**Audit basis:** HkTube source at commit `1006663` plus official YouTube Help pages current at review time. The source-derived inventory contains **64 route patterns** across viewer, creator, account, legal and owner/admin areas. This is a code-and-documentation audit, not a logged-in end-to-end test of every screen, Supabase policy, provider, or device. A route or button alone is not proof that its backend works. Runtime-dependent findings are labelled as such.

## Overall finding

HkTube has more than a basic video feed: it includes discovery, long videos, a swipeable Clips feed, creator pages, upload, posts, Studio tools, account security and owner operations. The largest observable parity gaps are **accurate account privacy enforcement, monetization honesty, complete watch-history controls, the subscriptions video feed, post discovery on public channels, creator-side video/caption editing, Shorts creation, and truthful help/support paths**.

Do not try to copy YouTube's proprietary recommender, licensed music/catalog, payment products or native-app-only behaviour without the necessary product, legal and technical foundations. Keep HkTube's existing moderation, authentication, admin checks and honest “not connected” states. That is not excess functionality to remove.

| Product area | HkTube today | Compared with YouTube Android app | Audit judgement |
|---|---|---|---|
| Home and discovery | Public video feed, app-specific ranking/feedback, Explore, topic cards and a separate Clips shelf/feed | YouTube combines personalized Home with Explore/category/Charts destinations and more search filters; its ranking is proprietary | Partial; preserve HkTube discovery, clarify simple “rising”/“trending” signals [1][2][3] |
| Watch and engagement | Watch page and swipeable Clips; likes, saves, comments, subscriptions, reports and some recommendation feedback call backend helpers | YouTube exposes explicit quality/captions controls, chapters, comment controls and eligible Shorts creation/remix | Partial; browser-native player controls are not a substitute for verified app controls [4][5][6][7] |
| Channel/profile and posts | Owner profile editing, public channel, Long Videos/Clips, post publishing, playlist detail | YouTube supports configurable channel Home sections, posts and per-channel notification controls | Major gap in channel/posts surface; HkTube Messages and Stories are intentional extras [8][9][10] |
| Upload and Studio | Authenticated upload, thumbnails, visibility, basic settings, creator metrics, scheduling records and tool pages | YouTube Studio supports editing, captions, richer analytics, moderation and schedule management | Partial; important screens are thin and some actions/worker behaviour are unverified [11][12][13][14] |
| Subscriptions, Library and notifications | Channel list, saved/liked library, history and live notification inbox | YouTube has recent-upload subscriptions feed, centralized You tab, richer history controls and notification preferences | Partial; highest-value gaps are recent uploads, history controls and notification choices [15][16][17] |
| Account, privacy and safety | Supabase auth, TOTP/session controls, local settings, privacy center, reports, contact and email deletion request | YouTube/Google offers account-level data controls and mobile safety/accessibility controls | Major gap; local preferences are not server-enforced account privacy [18][19][20] |
| Mobile navigation/accessibility | Responsive web shell, desktop sidebar, five-item phone dock, install prompt, some reduced-motion/caption preferences | YouTube Android app includes mobile-native capabilities such as eligible PiP/background/casting and its own account/library navigation | Partial; do not promise native app capabilities from a web page [21][22][23] |
| Monetization, AI and operator tools | Real stats/status surfaces, pending wallet/provider, admin moderation and owner-only agent tools; some draft-only features | YouTube monetization is feature-, review-, policy-, country- and tier-dependent; Premium benefits require entitlements | Major gap by design/status; correct false eligibility and keep provider/payout state honest [24][25][26] |

## What the code shows

### Home, Explore, Search and Trending

`/`, `/home`, and aliases show published public videos. The signed-in path uses HkTube's own ranking heuristic and has fallback behaviour; anonymous Home uses a recent-content subset rather than personal recommendations. The feed includes playback/progress and engagement/reporting actions. `/explore` derives fresh/rising/topic surfaces from fetched content. `/search` has video/channel/topic result modes, local recent searches, All/Shorts/long filters and sorts. `/trending` is a real collection surface, but simple view-count ordering is not YouTube Charts. YouTube documents recommendation feedback including “fewer Shorts,” and its app search filters include upload date, type and duration; Explore categories and Charts vary by location/device [1][2][3].

**Best next work:** Add only filters the HkTube query can genuinely support; explain that “Rising” uses HkTube's measured window/signals or rename it. Keep personalized and anonymous fallback states clear. Do not claim algorithm parity.

### Video player, Clips and engagement

`/watch/:id` loads published Supabase video/channel data, resumes available progress, and renders native browser video controls. Likes, Watch Later/save, subscriptions, comments/replies, sharing and reporting call backend helpers. `/clips` and `/shorts` render a swipeable vertical feed with controls and engagement actions. However, source inspection found no actual Shorts camera/editor/remix workflow; “Use sound” currently points into a legacy redirect. The Home Clips shelf now deep-links to a chosen Clip. The generic `VideoCard` includes some visual actions whose state is local, unlike the persisted watch/Clips actions. YouTube documents creator-authorized Shorts remix and licensed-audio restrictions, viewer quality/caption choices, chapters, and conditional PiP [4][5][6][7].

**Best next work:** Make the Short upload/edit/publish flow complete and transparent. Add quality/caption/chapter UI only where HkTube has the actual rendition/caption/chapter data. Wire generic card actions to real authenticated APIs or remove/disable actions that only appear to persist. Never assume YouTube audio rights apply to HkTube.

### Channels, posts and social

`/profile` supports owner identity and content tabs; `/channel/create` makes a channel; `/channel/:handle` displays public identity, counts, Long Videos and Clips and supports subscribe/share. `/upload/post` accepts text and images, with privacy/moderation constraints. The supplied public channel screen does not show posts/playlists or a configurable Home surface. The owner's Posts tab is not proof of a public channel post feed or viewer interactions. HkTube `Messages` and text `Stories` have real backend paths in source and are product extras, not YouTube-equivalence claims. YouTube documents configurable Home sections, Posts formats and per-channel notification bells; post availability is subject to account/audience restrictions [8][9][10].

**Best next work:** Show only approved public posts and playlists on public channels, after checking backend queries and authorization. Verify `/posts` before expanding it. Expand post formats only if schema and moderation workflows support them. Add subscribe notification choices only if the event/delivery system actually supports them.

### Upload and Creator Studio

`/upload` has an authenticated upload path with video file/size restrictions, title/description, thumbnails, visibility, language/category/tags and several content settings; resumable transfer and persistence are implemented through Supabase/helper code. `/studio` shows creator content and statistics. Analytics has recorded-event reports and is comparatively honest about missing impressions/CTR/revenue. `/studio/captions` adds track metadata and chapter records, but source does not establish a caption transcript/file editor. `/studio/schedule` writes schedule rows, but the claimed periodic worker was not verified. Creator comments mainly supports deletion. YouTube Studio documents post-upload editing, real caption authoring, schedule lifecycle and richer analytics reports [11][12][13][14].

**Best next work:** Prioritize secure owner-only editing of published video details and real caption upload/editing. Verify a schedule worker and add edit/cancel/status/failure handling before presenting schedules as operational. Do not fabricate analytics for impressions, revenue or audience. Build out comment moderation with server-enforced ownership and review rules.

### Subscriptions, Library, History and Notifications

`/subscriptions` displays followed channels but not their recent uploads. `/library` has saved/liked entries and search. `/history` reads recent watch history but the inspected surface is read-only. Playlist routes support some creation/list/detail/remove/share actions; edit/reorder details were not established across all source. `/notifications` loads activity, live inserts and read state; this is not the same as delivery preferences. YouTube Android offers a recent-upload Subscriptions feed, history search/date/delete/pause, playlist controls, and channel notification levels [15][16][17].

**Best next work:** Build a followed-channel recent-upload feed. Add history search and privacy-safe individual/range deletion plus pause/resume only after the backend can enforce those semantics. Provide channel-level notification preferences only when the provider supports them. Inspect playlist authoring end-to-end before promising edit/reorder.

### Account, privacy, help and safety

`/auth` source implements email/phone authentication (provider dependent); it is not Google sign-in. The security center includes Supabase MFA/session APIs. Many `/settings` preferences are explicitly device-local. `PrivacyCenter` switches write to `localStorage`; the banner warned that server enforcement is required, but row labels could still sound like active account-level controls. `/delete-account` opens an email draft rather than submitting or completing deletion. Help is a route hub; some claims about reporting/account functions should be limited to controls actually present. YouTube's Google Account supports watch/search-history management; its app also documents Restricted Mode, reporting and mobile accessibility [18][19][20].

**Applied during this continuation:** Privacy switches now repeat that they are on-device preferences only and do not change account/server/content/social privacy. Help no longer claims Google sign-in. Monetization no longer states that a 500/500 count makes a creator eligible (see next section).

**Best next work:** If a privacy setting is meant to protect account/content visibility, implement and test it server-side before advertising it as protection. Until then, disclose its local-only scope. Make deletion copy explicit that mailto opens an email draft and is not a completed request. Keep legal/security boundaries; do not test destructive actions against production data.

### Mobile shell and accessibility

HkTube has responsive navigation, an app-like five-item bottom dock, desktop sidebar, and a consent-gated browser install prompt. Recent commits fixed phone viewport/dock spacing and added a distinct Clips recommendation shelf. Source does not demonstrate PiP/background/casting in the web shell; YouTube's mobile app features are dependent on device, content, account tier and region [21][22][23].

**Best next work:** Validate focus, screen-reader, zoom/text-size, reduced motion, safe area and install behaviour on supported mobile browsers. Offer browser-appropriate manual install instructions if automatic install prompting is unavailable. Do not represent a responsive website as native YouTube-app parity.

### Monetization, premium-like features and extras

The HkTube monetization surface shows real subscriber and recorded watch-hour totals, but source had hardcoded **500 subscribers + 500 watch hours** and could label a channel “Eligible.” HkTube has not published or implemented a monetization program capable of making that decision. The wallet/payout provider is pending. YouTube itself uses multiple separate YPP levels and feature-specific eligibility, review, policy, country and payment criteria; its paid Premium playback benefits are entitlement-controlled [24][25][26].

**Applied during this continuation:** the 500/500 eligibility claim is removed. The page now says program status is not configured, stats are informational only, and no creator is marked eligible or approved. Revenue and payout remain honestly unavailable.

HkTube's admin dashboard, moderation workflow, verification review, AI/agent tools, messages and stories are not consumer-app parity requirements. Keep useful capabilities and owner/role/server checks. Clearly label planned/provider-dependent operations. No plan, payment, payout, copyright-fingerprint, or media-rendering capability should be switched on without a real supported provider and authorized lifecycle.

## Prioritized backlog

**P0 — Accuracy and privacy**

- Keep account-level privacy controls clearly marked local-only until server enforcement exists. Never label browser `localStorage` as account security.
- Do not call threshold progress monetization eligibility or approval until HkTube publishes and implements its own program and review policy.
- Make Help/sign-in and account-deletion copy match the actual flow; a mailto draft is not a submitted or completed deletion request.

**P1 — Core viewer and creator parity**

- Complete an authorized Shorts creation/upload/edit/publish flow.
- Add a real subscriptions feed for recent uploads.
- Add history search/deletion/pause backed by secure, testable server controls.
- Make public channel pages show applicable approved posts/playlists and provide real viewer-side post discovery/interactions.
- Add secure editing of existing video details and actual caption content/timing support.
- Verify scheduling worker and lifecycle before presenting schedules as live.
- Expand search filters only when the backend actually implements them.

**P2 — Controls and polish**

- Add channel notification preferences where supported by real delivery infrastructure.
- Improve playlist editing/reordering after confirming backend support.
- Improve report follow-up, help content and mobile navigation to Following/History/Notifications.
- Extend accessibility and caption controls on playback surfaces only where tracks/platforms support them.
- Define HkTube “trending” signals and show the measurement window; do not call simple top-view sorting curated Charts.

**P3 — Conditional/plan/provider work**

- Decide whether HkTube will offer a paid plan, and implement explicit entitlement checks before exposing any premium-equivalent benefits. Do not bypass third-party restrictions.
- If HkTube adds monetization, build feature-specific rules, review, earnings and payout-provider integration before showing balances or approval.
- If generated media is ever published, add accurate disclosure and rights/moderation controls first.
- Treat casting, background play and PiP as platform-specific future work—not an automatic web parity fix.

## Route-family coverage

All **64** route patterns from `client/src/App.tsx` were enumerated. Core families inspected against source include Home aliases (`/`, `/home`, `/index.html`, `/app`), `/explore`, `/trending`, `/search`, `/clips`, `/shorts`, `/watch/:id`, `/embed/:id`, `/subscriptions`, `/library`, `/history`, `/notifications`, `/playlists`, `/playlist/:id`, `/posts`, `/profile`, `/channel/create`, `/channel/:handle`, `/upload`, `/upload/post`, `/studio` and Studio tools/analytics/schedule/comments/captions/copyright, `/settings` and its security/privacy/ads routes, `/auth`, `/messages`, `/stories`, `/monetization`, `/wallet`, `/verification`, `/ai`, `/studio/ai`, `/algorithm`, `/admin` and its moderation/AI/controls/agent routes, help, legal, about, contact and delete-account. Some routes were established from route wiring only or through sibling components; they are not represented here as individually end-to-end verified. The route inventory snapshot is [complete route inventory](HKTUBE_ROUTE_INVENTORY.md) for review during this task; the canonical complete route list remains in `client/src/App.tsx`.

## Official references

[1]: https://support.google.com/youtube/answer/6342839?hl=en "Manage your recommendations & search results — YouTube Help"
[2]: https://support.google.com/youtube/answer/111997?hl=en&co=GENIE.Platform%3DAndroid "Advanced search filters — Android — YouTube Help"
[3]: https://support.google.com/youtube/answer/9744563?hl=en "Explore YouTube — YouTube Help"
[4]: https://support.google.com/youtube/answer/10623810?hl=en&co=GENIE.Platform%3DAndroid "Create YouTube Shorts with remixed content — Android"
[5]: https://support.google.com/youtube/answer/91449?hl=en&co=GENIE.Platform%3DAndroid "Change video quality — Android — YouTube Help"
[6]: https://support.google.com/youtube/answer/100078?hl=en&co=GENIE.Platform%3DAndroid "Manage caption settings — Android — YouTube Help"
[7]: https://support.google.com/youtube/answer/9884579?hl=en "Video Chapters — YouTube Help"
[8]: https://support.google.com/youtube/answer/3219384?hl=en "Customize your channel layout — YouTube Help"
[9]: https://support.google.com/youtube/answer/9409631?hl=en "Learn about posts — YouTube Help"
[10]: https://support.google.com/youtube/answer/3382248?hl=en&co=GENIE.Platform%3DAndroid "Manage YouTube notifications — Android — YouTube Help"
[11]: https://support.google.com/youtube/answer/57407?hl=en "Upload YouTube videos — YouTube Help"
[12]: https://support.google.com/youtube/answer/57404?hl=en "Edit video settings — YouTube Help"
[13]: https://support.google.com/youtube/answer/2734796?hl=en "Add subtitles and captions — YouTube Help"
[14]: https://support.google.com/youtubecreatorstudio/answer/9002587?hl=en "Get started with YouTube Analytics — YouTube Help"
[15]: https://support.google.com/youtube/answer/4489286?hl=en&co=GENIE.Platform%3DAndroid "Subscribe to YouTube channels — Android — YouTube Help"
[16]: https://support.google.com/youtube/answer/95725?hl=en&co=GENIE.Platform%3DAndroid "View, delete, or turn on or off watch history — Android — YouTube Help"
[17]: https://support.google.com/youtube/answer/57792?hl=en&co=GENIE.Platform%3DAndroid "Create and manage playlists — Android — YouTube Help"
[18]: https://support.google.com/youtube/answer/174084?hl=en&co=GENIE.Platform%3DAndroid "Turn Restricted Mode on or off — Android — YouTube Help"
[19]: https://support.google.com/youtube/answer/2802027?hl=en&co=GENIE.Platform%3DAndroid "Report inappropriate videos and content — Android — YouTube Help"
[20]: https://support.google.com/youtube/answer/6087602?hl=en "Accessibility for YouTube mobile app — YouTube Help"
[21]: https://support.google.com/youtube/answer/9209643?hl=en&co=GENIE.Platform%3DAndroid "Explore the You tab — Android — YouTube Help"
[22]: https://support.google.com/youtube/answer/7437614?hl=en "Use background play — YouTube Help"
[23]: https://support.google.com/youtube/answer/7640706?hl=en&co=GENIE.Platform%3DAndroid "Watch YouTube on your smart TV: Cast videos — Android"
[24]: https://support.google.com/youtube/answer/13429240?hl=en&co=GENIE.Platform%3DAndroid "Overview of the expanded YouTube Partner Program"
[25]: https://support.google.com/youtube/answer/72851?hl=en&co=GENIE.Platform%3DAndroid "YouTube Partner Program overview & eligibility"
[26]: https://support.google.com/youtube/answer/6308116?hl=en&co=GENIE.Platform%3DAndroid "Use your YouTube Premium benefits — Android"
