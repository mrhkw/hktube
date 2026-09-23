import React, { useState, useRef, useEffect } from "react";

// Deeplay Unique Custom Pinwheel Brand Logo
export const DeeplayLogoSVG = ({
  className = "w-8 h-8",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 500 500"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g filter="drop-shadow(0px 4px 8px rgba(0,0,0,0.5))">
      <path
        d="M250 50 C320 50 380 90 410 150 L310 190 C290 160 270 150 250 150 Z"
        fill="#9333EA"
      />
      <path
        d="M450 250 C450 320 410 380 350 410 L310 310 C340 290 350 270 350 250 Z"
        fill="#9333EA"
      />
      <path
        d="M250 450 C180 450 120 410 90 350 L190 310 C210 340 230 350 250 350 Z"
        fill="#9333EA"
      />
      <path
        d="M50 250 C50 180 90 120 150 90 L190 190 C160 210 150 230 150 250 Z"
        fill="#9333EA"
      />
      <path
        d="M250 110 C300 110 340 140 360 190 L280 220 C270 190 260 180 250 180 Z"
        fill="#EAB308"
      />
      <path
        d="M390 250 C390 300 360 340 310 360 L280 280 C310 270 320 260 320 250 Z"
        fill="#EAB308"
      />
      <path
        d="M250 390 C200 390 160 360 140 310 L220 280 C230 310 240 320 250 320 Z"
        fill="#EAB308"
      />
      <path
        d="M110 250 C110 200 140 160 190 140 L220 220 C190 230 180 240 180 250 Z"
        fill="#EAB308"
      />
      <rect
        x="200"
        y="200"
        width="100"
        height="100"
        rx="12"
        transform="rotate(45 250 250)"
        fill="#14B8A6"
        stroke="#0F766E"
        strokeWidth="6"
      />
    </g>
  </svg>
);

export interface Clip {
  id: string;
  videoUrl: string;
  author: string;
  avatar: string;
  isVerified: boolean;
  description: string;
  musicTitle: string;
  likes: number;
  commentsCount: number;
  favorites: number;
  shares: number;
  category: string;
}

const DEMO_CLIPS: Clip[] = [
  {
    id: "1",
    videoUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-vertical-shot-of-a-woman-smiling-at-the-camera-41525-large.mp4",
    author: "@mrhkw3",
    avatar: "https://picsum.photos/100",
    isVerified: true,
    description:
      "Deeplay Clips Engine! Full TikTok experience with double tap heart, custom sound disc, speed controller & smart drawers 🚀 #deeplay #clips",
    musicTitle: "Original Sound - @mrhkw3",
    likes: 42300,
    commentsCount: 1580,
    favorites: 6200,
    shares: 2800,
    category: "Trending",
  },
  {
    id: "2",
    videoUrl:
      "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4",
    author: "@deeplay_official",
    avatar: "https://picsum.photos/101",
    isVerified: true,
    description:
      "Fast, smooth buffering free clips feed. Enjoy continuous scrolling with auto-play feature! ⚡ #shorts #trending",
    musicTitle: "Deeplay Beat - Special Remix",
    likes: 18900,
    commentsCount: 640,
    favorites: 3100,
    shares: 950,
    category: "Music",
  },
];
export const ClipsView: React.FC = () => {
  // Feed & Video Logic State
  const [clips] = useState<Clip[]>(DEMO_CLIPS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(true);
  const [autoScroll, setAutoScroll] = useState(false);

  // Interactive Engagement States
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});
  const [favMap, setFavMap] = useState<Record<string, boolean>>({});
  const [favCountMap, setFavCountMap] = useState<Record<string, number>>({});
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // UI Animations & Overlay Sheets
  const [heartAnim, setHeartAnim] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeSheet, setActiveSheet] = useState<
    "comment" | "report" | "share" | null
  >(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [comments, setComments] = useState([
    {
      id: "1",
      user: "@usman_dev",
      text: "Deeplay Clips UI ab bilkul original TikTok style lag raha hai! 🔥",
      time: "1m ago",
    },
    {
      id: "2",
      user: "@ali_king",
      text: "Saare action buttons aur animations ekdam smooth hain 👍",
      time: "Just now",
    },
  ]);
  const [newCommentText, setNewCommentText] = useState("");

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  // Auto-play / Pause handling on scroll
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (video) {
        if (idx === activeIndex) {
          video.currentTime = 0;
          video.playbackRate = playbackSpeed;
          video.muted = isMuted;
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        } else {
          video.pause();
        }
      }
    });
  }, [activeIndex, playbackSpeed, isMuted]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const index =
      container.clientHeight > 0
        ? Math.round(container.scrollTop / container.clientHeight)
        : 0;
    const boundedIndex = Math.max(0, Math.min(index, clips.length - 1));
    if (
      boundedIndex !== activeIndex &&
      boundedIndex >= 0 &&
      boundedIndex < clips.length
    ) {
      setActiveIndex(boundedIndex);
    }
  };

  const togglePlayPause = () => {
    const current = videoRefs.current[activeIndex];
    if (current) {
      if (isPlaying) {
        current.pause();
        setIsPlaying(false);
      } else {
        current.play();
        setIsPlaying(true);
      }
    }
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.5, 2.0];
    const nextSpeed =
      speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    showToast(`Playback Speed: ${nextSpeed.toFixed(1)}x`);
  };

  const handleDoubleTap = (
    e: React.MouseEvent<HTMLDivElement>,
    clipId: string,
    defaultLikes: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHeartAnim({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setHeartAnim(null), 800);

    if (!likedMap[clipId]) {
      setLikedMap(p => ({ ...p, [clipId]: true }));
      setLikeCountMap(p => ({
        ...p,
        [clipId]: (p[clipId] ?? defaultLikes) + 1,
      }));
    }
  };

  const toggleLike = (id: string, defaultLikes: number) => {
    const isLiked = !!likedMap[id];
    setLikedMap(p => ({ ...p, [id]: !isLiked }));
    setLikeCountMap(p => ({
      ...p,
      [id]: (p[id] ?? defaultLikes) + (isLiked ? -1 : 1),
    }));
  };

  const toggleFavorite = (id: string, defaultFavs: number) => {
    const isFav = !!favMap[id];
    setFavMap(p => ({ ...p, [id]: !isFav }));
    setFavCountMap(p => ({
      ...p,
      [id]: (p[id] ?? defaultFavs) + (isFav ? -1 : 1),
    }));
    showToast(isFav ? "Saved to Favorites" : "Removed from Favorites");
  };

  const toggleFollow = (author: string) => {
    setFollowingMap(p => {
      const state = !p[author];
      showToast(state ? `Followed ${author}` : `Unfollowed ${author}`);
      return { ...p, [author]: state };
    });
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    setComments(p => [
      ...p,
      {
        id: Date.now().toString(),
        user: "@you",
        text: newCommentText,
        time: "Just now",
      },
    ]);
    setNewCommentText("");
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden select-none font-sans">
      {/* Dynamic Toast System */}
      {toastMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl text-white text-xs font-semibold px-4 py-2.5 rounded-full border border-white/20 shadow-2xl z-50 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Top Header Navigation (Deeplay Branding + Player Controls) */}
      <div className="fixed top-0 left-0 w-full px-4 py-3 flex justify-between items-center z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <DeeplayLogoSVG className="w-8 h-8 drop-shadow-md" />
          <span className="font-extrabold text-lg text-white">Deeplay</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white uppercase tracking-wider">
            CLIPS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={cycleSpeed}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-bold transition active:scale-95"
          >
            ⚡ {playbackSpeed.toFixed(1)}x
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`backdrop-blur-md border px-3 py-1 rounded-full text-xs font-bold transition active:scale-95 ${
              autoScroll
                ? "bg-emerald-500/30 border-emerald-500 text-emerald-400"
                : "bg-white/10 border-white/20 text-white"
            }`}
          >
            🔄 {autoScroll ? "Auto ON" : "Auto OFF"}
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-xs active:scale-95"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>
      {/* TikTok Snap Vertical Video Feed */}
      <div
        className="h-screen w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        onScroll={handleScroll}
      >
        {clips.map((clip, index) => {
          const isLiked = !!likedMap[clip.id];
          const isFav = !!favMap[clip.id];
          const isFollowing = !!followingMap[clip.author];
          const currentLikes = likeCountMap[clip.id] ?? clip.likes;
          const currentFavs = favCountMap[clip.id] ?? clip.favorites;

          return (
            <div
              key={clip.id}
              className="relative h-screen w-full snap-start snap-always bg-black flex justify-center items-center overflow-hidden"
              onDoubleClick={e => handleDoubleTap(e, clip.id, clip.likes)}
            >
              {/* Main Vertical Video Element */}
              <video
                ref={el => {
                  videoRefs.current[index] = el;
                }}
                src={clip.videoUrl}
                className="w-full h-full object-cover cursor-pointer"
                loop={!autoScroll}
                muted={isMuted}
                playsInline
                onClick={togglePlayPause}
                onEnded={() =>
                  autoScroll &&
                  activeIndex < clips.length - 1 &&
                  setActiveIndex(i => i + 1)
                }
              />

              {/* Play Pause Visual Overlay */}
              {!isPlaying && activeIndex === index && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                  <div className="w-16 h-16 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white pl-1 border border-white/20 shadow-2xl">
                    <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Heart Pop Animation on Double Tap */}
              {heartAnim && (
                <div
                  className="absolute pointer-events-none z-50 animate-ping"
                  style={{
                    top: heartAnim.y,
                    left: heartAnim.x,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <svg
                    className="w-20 h-20 fill-pink-500 drop-shadow-2xl"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
              )}

              {/* Content Details Overlay (Left Bottom & Right Action Bar) */}
              <div className="absolute inset-0 flex justify-between items-end p-4 pb-12 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none">
                {/* Left Profile info & Music track */}
                <div className="max-w-[70%] pointer-events-auto space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white drop-shadow">
                      {clip.author}
                    </span>
                    {clip.isVerified && (
                      <svg
                        className="w-4 h-4 fill-cyan-400"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    )}
                    <button
                      onClick={() => toggleFollow(clip.author)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition shadow ${
                        isFollowing
                          ? "bg-white/20 text-white border border-white/30"
                          : "bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                      }`}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  </div>

                  <p className="text-xs text-gray-100 leading-relaxed drop-shadow font-normal">
                    {clip.description}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-gray-200 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full w-fit">
                    <svg
                      className="w-3.5 h-3.5 fill-current animate-spin"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <span className="truncate w-36 font-medium">
                      {clip.musicTitle}
                    </span>
                  </div>
                </div>

                {/* Right Interactive Vector Action Buttons */}
                <div className="flex flex-col items-center gap-4 pointer-events-auto z-10">
                  {/* Avatar + Quick Follow */}
                  <div className="relative mb-1">
                    <img
                      src={clip.avatar}
                      className="w-12 h-12 rounded-full border-2 border-white object-cover shadow-2xl"
                      alt="avatar"
                    />
                    <button
                      onClick={() => toggleFollow(clip.author)}
                      className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-xs border border-black shadow ${
                        isFollowing ? "bg-emerald-500" : "bg-pink-600"
                      }`}
                    >
                      {isFollowing ? "✓" : "+"}
                    </button>
                  </div>

                  {/* Like Button */}
                  <button
                    onClick={() => toggleLike(clip.id, clip.likes)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`p-3 rounded-full backdrop-blur-md transition-all duration-200 group-active:scale-125 ${
                        isLiked
                          ? "bg-pink-600/30 text-pink-500 border border-pink-500/40"
                          : "bg-black/40 text-white border border-white/10"
                      }`}
                    >
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow">
                      {currentLikes.toLocaleString()}
                    </span>
                  </button>

                  {/* Comment Button */}
                  <button
                    onClick={() => setActiveSheet("comment")}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white group-active:scale-125 transition-all">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow">
                      {clip.commentsCount}
                    </span>
                  </button>

                  {/* Bookmark Button */}
                  <button
                    onClick={() => toggleFavorite(clip.id, clip.favorites)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`p-3 rounded-full backdrop-blur-md transition-all duration-200 group-active:scale-125 ${
                        isFav
                          ? "bg-yellow-500/30 text-yellow-400 border border-yellow-500/40"
                          : "bg-black/40 text-white border border-white/10"
                      }`}
                    >
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow">
                      {currentFavs.toLocaleString()}
                    </span>
                  </button>

                  {/* Share Button */}
                  <button
                    onClick={() => setActiveSheet("share")}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white group-active:scale-125 transition-all">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow">
                      {clip.shares}
                    </span>
                  </button>

                  {/* Report Flag */}
                  <button
                    onClick={() => setActiveSheet("report")}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-gray-300 group-active:scale-125 transition-all">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-medium text-gray-300">
                      Report
                    </span>
                  </button>

                  {/* Audio Disc Visual Animation */}
                  <div className="w-10 h-10 bg-zinc-900 border-2 border-purple-500/80 rounded-full flex items-center justify-center animate-spin mt-1 overflow-hidden shadow-2xl relative">
                    <img
                      src={clip.avatar}
                      className="w-6 h-6 rounded-full object-cover"
                      alt="disc"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Backdrop for Sheets */}
      {activeSheet && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          onClick={() => setActiveSheet(null)}
        />
      )}

      {/* Interactive Comments Drawer */}
      <div
        className={`fixed bottom-0 left-0 w-full h-[65vh] bg-zinc-900/95 backdrop-blur-2xl rounded-t-3xl z-50 p-4 flex flex-col transition-transform duration-300 border-t border-zinc-800 ${
          activeSheet === "comment" ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800 font-bold text-sm">
          <span>Comments ({comments.length})</span>
          <button
            onClick={() => setActiveSheet(null)}
            className="p-1 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 text-xs">
              <img
                src="https://picsum.photos/50"
                className="w-8 h-8 rounded-full border border-zinc-700"
                alt="user"
              />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-300">{c.user}</span>
                  <span className="text-[10px] text-gray-500">{c.time}</span>
                </div>
                <p className="text-gray-200 mt-0.5">{c.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
          <input
            type="text"
            value={newCommentText}
            onChange={e => setNewCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
          />
          <button
            onClick={handleAddComment}
            className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 rounded-full text-white text-xs font-bold"
          >
            Post
          </button>
        </div>
      </div>

      {/* Interactive Share Drawer */}
      <div
        className={`fixed bottom-0 left-0 w-full h-[35vh] bg-zinc-900/95 backdrop-blur-2xl rounded-t-3xl z-50 p-5 flex flex-col transition-transform duration-300 border-t border-zinc-800 ${
          activeSheet === "share" ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800 font-bold text-sm">
          <span>Share Video</span>
          <button
            onClick={() => setActiveSheet(null)}
            className="p-1 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 text-center text-xs">
          <button
            onClick={() => {
              showToast("Link Copied!");
              setActiveSheet(null);
            }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center text-xl shadow">
              📋
            </div>
            Copy Link
          </button>
          <button
            onClick={() => {
              showToast("Opening WhatsApp...");
              setActiveSheet(null);
            }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center text-xl shadow">
              💬
            </div>
            WhatsApp
          </button>
          <button
            onClick={() => {
              showToast("Reposted!");
              setActiveSheet(null);
            }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center text-xl shadow">
              🔁
            </div>
            Repost
          </button>
          <button
            onClick={() => {
              showToast("Video Saved!");
              setActiveSheet(null);
            }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center text-xl shadow">
              ⬇️
            </div>
            Save
          </button>
        </div>
      </div>

      {/* Content Moderation / Report Drawer */}
      <div
        className={`fixed bottom-0 left-0 w-full h-[40vh] bg-zinc-900/95 backdrop-blur-2xl rounded-t-3xl z-50 p-5 flex flex-col transition-transform duration-300 border-t border-zinc-800 ${
          activeSheet === "report" ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800 font-bold text-sm text-red-400">
          <span>🚩 Report Content</span>
          <button
            onClick={() => setActiveSheet(null)}
            className="p-1 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5 mt-4">
          <button
            onClick={() => {
              showToast("Report Submitted");
              setActiveSheet(null);
            }}
            className="bg-zinc-800/80 border border-zinc-700 p-3.5 rounded-xl text-left text-xs hover:bg-zinc-700 transition"
          >
            🚫 Spam or Misleading
          </button>
          <button
            onClick={() => {
              showToast("Report Submitted");
              setActiveSheet(null);
            }}
            className="bg-zinc-800/80 border border-zinc-700 p-3.5 rounded-xl text-left text-xs hover:bg-zinc-700 transition"
          >
            ⚠️ Inappropriate Content
          </button>
          <button
            onClick={() => {
              showToast("Report Submitted");
              setActiveSheet(null);
            }}
            className="bg-zinc-800/80 border border-zinc-700 p-3.5 rounded-xl text-left text-xs hover:bg-zinc-700 transition"
          >
            ©️ Copyright Infringement
          </button>
        </div>
      </div>
    </div>
  );
};
