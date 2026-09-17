# HkTube Product Standard

This is the product-level source of truth for HkTube. HkTube may learn from proven interaction patterns in major video platforms, but it must keep its own identity, naming, visual language, navigation and ranking behavior.

## Product shape

HkTube is a two-format video network with a social layer:

- **Long Video** — focused watch page, theater/fullscreen playback, resume position, chapters when metadata exists, related videos, comments, saves, playlists and creator context.
- **Clips** — vertical, full-screen, swipe-first discovery with For You and Following modes, autoplay, mute, save, like, share, follow and recommendation controls.
- **Posts** — text/social updates connected to creators and video communities.
- **Explore** — an independent discovery surface for rising videos, fresh uploads, topics and creators.
- **Home** — personalized discovery; it must not become a duplicate of Explore or Trending.
- **Following** — content from creators the viewer follows, still ranked for relevance and freshness.
- **Library / History / Playlists** — durable viewer utilities rather than discovery feeds.
- **Creator Studio** — upload, moderation state, content management, analytics and creator AI tools.

## Identity rules

Do not copy YouTube or TikTok branding, labels, icons, colors, layouts or proprietary interaction details. Borrow only general product patterns that are useful to viewers.

HkTube's own vocabulary is:

- Clips = short-form vertical video
- Explore = broad discovery
- Home = personalized discovery
- Following = followed creators
- Rising now = popularity surface
- Create = unified creation entry point
- Creator Studio = creator management

## Discovery rules

Home ranking should combine explicit and implicit signals rather than optimizing raw views alone. Signals include watch completion, watch duration, likes, saves, shares, comments, follows, search behavior, freshness, topic affinity, creator affinity, negative feedback, prior exposure, safety eligibility and format preference.

The ranking system must also diversify creators and topics, avoid immediate repeats, respect blocks/hide feedback, and provide a reason/explanation surface where practical.

Explore is intentionally less personalized than Home. It should help new creators and topics get discovered instead of reinforcing only the viewer's existing habits.

## Search rules

Search should separate:

1. Videos
2. Creators
3. Topics

Video relevance should consider title/description/tag matching, freshness and engagement without turning search into a popularity-only list. Filters should distinguish Clips from Long Video.

## Long-video rules

Long Video is not a TikTok-style page. It gets a dedicated watch surface with:

- stable playback
- resume position
- keyboard controls on desktop
- comments and replies
- save/like/share/follow
- related recommendations
- creator context
- playback error recovery
- moderation eligibility

Storage uploads must validate media before publishing. Failed database writes must clean up uploaded objects so orphaned media does not accumulate.

## Clips rules

Clips must open into a true immersive vertical viewer. One visible item plays at a time. Swiping changes the item. Background thumbnails are fallbacks, not substitutes for playback. Playback failures must be visible and actionable.

Viewer feedback must be real data: not interested, hide creator and hide topic feed back into recommendation state. No fake buttons.

## Social rules

Posts, comments, likes, saves, follows, notifications and reports must use real persistence and authorization. Every mutation must fail safely and present a useful user-facing error.

## Safety and integrity

Only public + published + approved media belongs in public discovery. Moderation states must be enforced consistently in feeds, search, watch pages and creator surfaces.

Never expose service-role credentials to the browser. Security-sensitive RPCs must have explicit grants and authorization checks. User-controlled URLs and media paths must be validated.

## Performance rules

- Lazy-load large discovery surfaces.
- Avoid blocking the first render on unrelated data.
- Preload only the current and immediately upcoming Clip media.
- Use long-lived cache headers for immutable media objects.
- Keep mobile navigation compact and avoid unnecessary full-width blank ad areas.
- Recover expired sessions without forcing the user through repeated sign-in when a refresh is possible.

## Mobile and desktop

Mobile is the primary Clip experience. Long Video remains a conventional watch experience. Desktop gets a persistent discovery rail and richer creator/watch layouts. The same product model must remain understandable on both.

## Quality gate

A feature is not complete merely because a button exists. Before calling it complete, verify:

- UI action has a real handler
- persistence works
- authorization is correct
- loading and error states exist
- mobile layout works
- desktop layout works
- refresh/deep-link works
- empty state works
- moderation visibility is correct
- production build succeeds
- production route returns successfully
- no known regression was introduced

## Current research principles

Current official platform documentation confirms that YouTube recommendations use signals including watch history, search history, subscriptions, likes/dislikes, negative feedback and satisfaction, while TikTok describes recommendation using user interactions, content information and user information, with diversification and negative-feedback controls. HkTube should implement the underlying product principles without copying either platform's interface or brand.
