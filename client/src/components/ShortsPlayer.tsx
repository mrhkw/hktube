import React, { useRef, useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play } from 'lucide-react';

interface VideoItem {
  id: string;
  video_url: string;
  title: string;
  user_name?: string;
  likes_count?: number;
}

export const ShortsPlayer: React.FC<{ video: VideoItem; isActive: boolean }> = ({ video, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes_count || 0);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleLike = () => {
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <div className="relative h-[100dvh] min-h-[100svh] w-screen snap-start snap-always flex items-center justify-center bg-black overflow-hidden">
      <video
        ref={videoRef}
        src={video.video_url}
        className="size-full object-cover cursor-pointer"
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
      />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
          <Play className="w-16 h-16 text-white/80 fill-white" />
        </div>
      )}

      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-10 rounded-full bg-black/40 p-3 text-white backdrop-blur-md transition hover:bg-black/60"
      >
        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
      </button>

      <div className="absolute bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4rem))] right-4 z-10 flex flex-col items-center gap-6 text-white">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1 group">
          <div className={`p-3 rounded-full bg-black/40 backdrop-blur-md group-hover:scale-110 transition ${liked ? 'text-red-500' : 'text-white'}`}>
            <Heart className={`w-7 h-7 ${liked ? 'fill-red-500' : ''}`} />
          </div>
          <span className="text-xs font-semibold">{likeCount}</span>
        </button>

        <button className="flex flex-col items-center gap-1 group">
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-md group-hover:scale-110 transition">
            <MessageCircle className="w-7 h-7" />
          </div>
          <span className="text-xs font-semibold">Comments</span>
        </button>

        <button className="flex flex-col items-center gap-1 group">
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-md group-hover:scale-110 transition">
            <Share2 className="w-7 h-7" />
          </div>
          <span className="text-xs font-semibold">Share</span>
        </button>
      </div>

      <div className="absolute bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] left-4 right-16 z-10 text-white">
        <h3 className="font-bold text-base mb-1">@{video.user_name || 'deeplay_creator'}</h3>
        <p className="text-sm line-clamp-2 text-gray-200">{video.title}</p>
      </div>
    </div>
  );
};
