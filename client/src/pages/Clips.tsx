import { useEffect, useRef, useState, type ReactNode } from "react";
import { Heart, MessageCircle, Music2, Search, Send, Star } from "lucide-react";
import "./clips-reference.css";

const POSTER = "/clip-reference.jpeg";
const VIDEO = String(import.meta.env.VITE_CLIPS_VIDEO_URL || "").trim();

type ReferenceActionProps = {
  icon: ReactNode;
  count: string;
  label: string;
};

function ClipVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playing, setPlaying] = useState(Boolean(VIDEO));
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !VIDEO || videoFailed) return;

    video.muted = !soundOn;
    if (playing) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing, soundOn, videoFailed]);

  if (!VIDEO || videoFailed) {
    return (
      <div className="clips-reference-media" aria-hidden="true">
        <img className="clips-reference-poster" src={POSTER} alt="" />
        <div className="clips-reference-shade" />
      </div>
    );
  }

  return (
    <div className="clips-reference-media" aria-hidden="true">
      <img className="clips-reference-poster" src={POSTER} alt="" />
      <video
        ref={videoRef}
        className="clips-reference-video"
        src={VIDEO}
        poster={POSTER}
        muted={!soundOn}
        autoPlay
        playsInline
        loop
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setVideoFailed(true);
          setPlaying(false);
        }}
        onClick={() => setPlaying(value => !value)}
      />
      <div className="clips-reference-shade" />
      <button
        type="button"
        className="clips-reference-video-hit-area"
        aria-label={playing ? "Pause video" : "Play video"}
        onClick={() => setPlaying(value => !value)}
      />
    </div>
  );
}

function ClipTopNavigation() {
  return (
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
  );
}

function ClipAction({ icon, count, label }: ReferenceActionProps) {
  return (
    <button type="button" className="clips-reference-action" aria-label={label}>
      {icon}
      <span>{count}</span>
    </button>
  );
}

function ClipRightActions() {
  return (
    <aside className="clips-reference-actions" aria-label="Clip actions">
      <ClipAction
        icon={<Heart className="clips-reference-icon" aria-hidden="true" />}
        count="2.6K"
        label="Like"
      />
      <ClipAction
        icon={<MessageCircle className="clips-reference-icon" aria-hidden="true" />}
        count="128"
        label="Comments"
      />
      <ClipAction
        icon={<Star className="clips-reference-icon" aria-hidden="true" />}
        count="512"
        label="Favorite"
      />
      <ClipAction
        icon={<Send className="clips-reference-icon clips-reference-share" aria-hidden="true" />}
        count="312"
        label="Share"
      />
      <img
        className="clips-reference-rail-avatar"
        src={POSTER}
        alt=""
      />
    </aside>
  );
}

function ClipCreatorRow() {
  return (
    <div className="clips-reference-creator-row">
      <div className="clips-reference-creator-avatar" aria-hidden="true">
        <img src="/hktube-icon.svg" alt="" />
      </div>
      <strong>HkTube Creator</strong>
      <button type="button" className="clips-reference-follow">
        Follow
      </button>
    </div>
  );
}

function ClipCaption() {
  return (
    <>
      <p className="clips-reference-caption">Waking up to views like this</p>
      <p className="clips-reference-tags">#travel #nature #adventure #explore</p>
    </>
  );
}

function ClipSoundRow() {
  const [soundOn, setSoundOn] = useState(false);

  return (
    <div className="clips-reference-sound-row">
      <button
        type="button"
        className="clips-reference-sound"
        onClick={() => setSoundOn(value => !value)}
        aria-label={soundOn ? "Sound on" : "Sound off"}
      >
        <Music2 aria-hidden="true" />
        <span>Original Sound - HkTube Creator</span>
      </button>
      <button
        type="button"
        className="clips-reference-use-sound"
        onClick={() => setSoundOn(true)}
      >
        Use sound
      </button>
    </div>
  );
}

function ClipDetails() {
  return (
    <section className="clips-reference-details" aria-label="Creator and clip details">
      <ClipCreatorRow />
      <ClipCaption />
      <ClipSoundRow />
    </section>
  );
}

export default function ClipsPage() {
  return (
    <main className="hktube-clips-page clips-reference-page">
      <section className="clips-reference-screen" aria-label="Clips">
        <ClipVideoBackground />
        <ClipTopNavigation />
        <ClipRightActions />
        <ClipDetails />
      </section>
    </main>
  );
}
