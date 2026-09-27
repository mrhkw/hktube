import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Music2, Search, Send, Star } from "lucide-react";

const POSTER = "/clip-reference.jpeg";
const VIDEO = String(import.meta.env.VITE_CLIPS_VIDEO_URL || "").trim();

export default function ClipsPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [playing, setPlaying] = useState(Boolean(VIDEO));
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !VIDEO) return;
    video.muted = !soundOn;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing, soundOn]);

  return (
    <main className="hktube-clips-page clips-reference-page">
      <section className="clips-reference-screen" aria-label="Clips">
        <div className="clips-reference-media" aria-hidden="true">
          <img className="clips-reference-poster" src={POSTER} alt="" />
          {VIDEO ? (
            <video
              ref={videoRef}
              className="clips-reference-video"
              src={VIDEO}
              poster={POSTER}
              muted={!soundOn}
              autoPlay
              playsInline
              loop
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setPlaying(false)}
              onClick={() => setPlaying(value => !value)}
            />
          ) : null}
          <div className="clips-reference-shade" />
        </div>

        <nav className="clips-reference-top" aria-label="Clip feed navigation">
          <button type="button" className="clips-reference-tab clips-reference-tab-muted">
            Following
          </button>
          <button type="button" className="clips-reference-tab clips-reference-tab-active">
            For You
          </button>
          <button type="button" className="clips-reference-search" aria-label="Search">
            <Search aria-hidden="true" />
          </button>
        </nav>

        <aside className="clips-reference-actions" aria-label="Clip actions">
          <button type="button" className="clips-reference-action" aria-label="Like" onClick={() => setLiked(value => !value)}>
            <Heart className={liked ? "clips-reference-icon clips-reference-liked" : "clips-reference-icon"} aria-hidden="true" />
            <span>2.6K</span>
          </button>
          <button type="button" className="clips-reference-action" aria-label="Comments">
            <MessageCircle className="clips-reference-icon" aria-hidden="true" />
            <span>128</span>
          </button>
          <button type="button" className="clips-reference-action" aria-label="Favorite">
            <Star className="clips-reference-icon" aria-hidden="true" />
            <span>512</span>
          </button>
          <button type="button" className="clips-reference-action" aria-label="Share">
            <Send className="clips-reference-icon clips-reference-share" aria-hidden="true" />
            <span>312</span>
          </button>
          <img className="clips-reference-rail-avatar" src={POSTER} alt="" />
        </aside>

        <section className="clips-reference-details" aria-label="Creator and clip details">
          <div className="clips-reference-creator-row">
            <div className="clips-reference-creator-avatar" aria-hidden="true">
              <span>HK</span>
              <small>TUBE</small>
            </div>
            <strong>HkTube Creator</strong>
            <button type="button" className="clips-reference-follow" onClick={() => setFollowing(value => !value)}>
              {following ? "Following" : "Follow"}
            </button>
          </div>
          <p className="clips-reference-caption">Waking up to views like this</p>
          <p className="clips-reference-tags">#travel #nature #adventure #explore</p>
          <div className="clips-reference-sound-row">
            <button type="button" className="clips-reference-sound" onClick={() => setSoundOn(value => !value)} aria-label="Toggle sound">
              <Music2 aria-hidden="true" />
              <span>Original Sound - HkTube Creator</span>
            </button>
            <button type="button" className="clips-reference-use-sound" onClick={() => setSoundOn(true)}>
              Use sound
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
