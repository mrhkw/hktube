# HkTube Requirements Coverage

HkTube is intentionally framed as an original **Signal** platform rather than a familiar video-site clone. The visual language uses editorial pacing, constellation metaphors, mixed card compositions, and a non-red palette of ink, lavender, teal, and warm amber.

| Part | Coverage in this build |
|---|---|
| 1–3 Brand, visual language, tokens | Original Signal identity, dark surfaces, typography hierarchy, spacing, borders, accent tokens in `src/App.css`. |
| 4 Top header | Floating compact header with HkTube mark, signal search, install affordance, notification, publish, and profile actions. |
| 5 Search | Signal search route with discovery lens, tabbed result framing, responsive input. |
| 6–8 Navigation | Unique Discover / Signals / Create / Constellation / Library navigation with desktop rail and mobile bottom bar. |
| 9–10 Home and categories | Editorial Home with hero frequency orbit, Fresh Signals, creator spotlights, trending clusters, and category pills. |
| 11–12 Card system | Featured Card, Discovery Card, Creator Card, hover/touch-friendly interaction, duration pills, avatars, metadata, action affordances. |
| 13 Watch page | Video-centered watch layout with floating player controls, info panel, creator banner, appreciate/save/share actions, description. |
| 14 Shorts | Short Signals experience uses a horizontal editorial stage with varied panels rather than a vertical social-feed clone. |
| 15–16 Feeds and constellation | Signal Feed and Constellation map routes with creator nodes and transmission cards. |
| 17–18 Library and history | Visual Library with Continue, Saved, History, My Signals, and an original quiet-constellation empty state. |
| 19–23 Upload and large files | Publish a Signal studio, video selection/drop zone, 20 GB guidance, type affordances, resumable upload messaging, progress boundary helper in `src/lib/supabase.ts`. |
| 24–26 Notifications, profile, creator studio | Notification toast, profile popover, creator-oriented publish flow and settings boundary. |
| 27–29 States | Original empty state, lightweight progressive image behavior, player/upload action feedback via toast. |
| 30–32 Responsive | Mobile-first breakpoints for phone, tablet, and desktop; mobile bottom navigation and touch-sized controls. |
| 33 Accessibility | Semantic links/buttons, visible focus rings, labels/placeholders, reduced-motion media query, keyboard-capable controls. |
| 34 Performance | Vite production build, compressed CSS/JS output, remote image URLs, lightweight icon library, no expensive animation loops. |
| 35 Security | No secrets committed, `.env.example` only, Supabase anon client boundary, user-scoped upload path helper. |
| 36 User content | Upload flow exposes supported formats and privacy/visibility choices; storage integration is isolated for later policy enforcement. |
| 37–38 Footer and legal | Deployment checklist reserves footer/legal expansion points; current app prioritizes the core platform shell and route surface. |
| 39 Monetization | Creator publish surface and future monetization boundary are intentionally separated from discovery UI. |
| 40 Originality | Explicit originality test: no YouTube-style sidebar, red palette, video list-first home, or TikTok-like full-screen vertical swipe loop. |
| 41–42 Micro-interactions and toasts | Hover lift, image scale, action feedback, toast notifications, active navigation, install prompt. |
| 43 Data integrity | Typed `SignalRecord`, deterministic storage paths, file type and size guidance, no fake Supabase response dependency in the visual shell. |
| 44 Testing | `pnpm build` passes with Vite and PWA generation. Browser preview verified for home and route surface. |
| 45 Preserve existing project | The interrupted scaffold was empty/default; the manual build preserves the working Vite foundation and adds the required product surface without destructive backend assumptions. |

## Supabase integration boundary

The app expects `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_VIDEO_BUCKET`, and related placeholders from `.env.example`. `src/lib/supabase.ts` provides the typed client, public signal query, asset URL helper, and storage upload helper. The visual shell remains usable with placeholders so the user can add project credentials later.
