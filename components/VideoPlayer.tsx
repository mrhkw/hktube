'use client';

import React, { useRef, useState, useEffect } from 'react';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  isShort?: boolean;
}

export default function VideoPlayer({ src, poster, isShort = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  return (
    <div className={`relative group bg-black overflow-hidden rounded-xl ${isShort ? 'max-w-[360px] h-[640px] mx-auto' : 'w-full aspect-video'}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        playsInline
        loop={isShort}
      />

      {/* Custom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between">
        <button
          onClick={togglePlay}
          className="text-white font-bold px-3 py-1 bg-white/20 hover:bg-white/30 rounded"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <div className="flex items-center space-x-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 accent-red-600"
          />
        </div>
      </div>
    </div>
  );
}
