import React, { useState, useEffect, useRef } from 'react';
import { ShortsPlayer } from '../components/ShortsPlayer';
import { supabase } from '../lib/supabase';

export const Shorts: React.FC = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShorts();
  }, []);

  const fetchShorts = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('is_short', true);

    if (error || !data || data.length === 0) {
      setVideos([
        { id: '1', title: 'Deeplay Shorts Clip 1', video_url: 'https://assets.mixkit.co/videos/preview/mixkit-vertical-shot-of-a-neon-sign-41551-large.mp4', user_name: 'deeplay_official' },
        { id: '2', title: 'Deeplay Shorts Clip 2', video_url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-1232-large.mp4', user_name: 'hktube' },
      ]);
    } else {
      setVideos(data);
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const height = containerRef.current.clientHeight;
    const scrollTop = containerRef.current.scrollTop;
    const index = Math.round(scrollTop / height);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-64px)] bg-black flex justify-center items-center overflow-hidden">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full max-w-sm sm:max-w-md h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
      >
        {videos.map((video, idx) => (
          <div key={video.id} className="w-full h-full snap-start snap-always">
            <ShortsPlayer video={video} isActive={idx === activeIndex} />
          </div>
        ))}
      </div>
    </div>
  );
};
