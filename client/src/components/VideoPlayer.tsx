import { Button } from "@/components/ui/button";
import { formatDuration, VideoRecord } from "@/lib/video";
import { Captions, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function VideoPlayer({ video, autoPlay = false }: { video: VideoRecord; autoPlay?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds || 0);
  const [volume, setVolume] = useState(0.9);
  const [captionsOn, setCaptionsOn] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(video.durationSeconds || 0);
  }, [video.id, video.durationSeconds]);

  function togglePlayback() {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) void element.play(); else element.pause();
  }

  function changeTime(value: number) {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = value;
    setCurrentTime(value);
  }

  function changeVolume(value: number) {
    const element = videoRef.current;
    if (!element) return;
    element.volume = value;
    element.muted = value === 0;
    setVolume(value);
  }

  function toggleCaptions() {
    const track = videoRef.current?.textTracks?.[0];
    if (!track) return;
    const show = track.mode !== "showing";
    track.mode = show ? "showing" : "hidden";
    setCaptionsOn(show);
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border border-violet-400/20 bg-black shadow-[0_0_45px_rgba(139,92,246,.13)]">
      <div className="relative aspect-video bg-[#05050a]">
        <video ref={videoRef} src={video.videoUrl} poster={video.thumbnailUrl || undefined} autoPlay={autoPlay} playsInline onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onLoadedMetadata={event => setDuration(event.currentTarget.duration || video.durationSeconds || 0)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} className="size-full object-contain">
          {video.captionUrl && <track kind="captions" src={video.captionUrl} srcLang="en" label="English captions" />}
          Your browser does not support HTML5 video playback.
        </video>
        {!isPlaying && <Button onClick={togglePlayback} aria-label="Play video" className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/90 p-0 text-white shadow-[0_0_35px_rgba(217,70,239,.55)] hover:bg-fuchsia-400"><Play className="size-6 fill-current" /></Button>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 bg-[#0b0b15] px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="icon" onClick={togglePlayback} className="size-8 text-white hover:bg-white/10" aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}</Button>
        <span className="w-[82px] text-xs tabular-nums text-slate-400">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
        <input aria-label="Video progress" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => changeTime(Number(event.target.value))} className="h-1 min-w-20 flex-1 accent-fuchsia-400" />
        <div className="hidden items-center gap-2 sm:flex"><Button variant="ghost" size="icon" className="size-8 text-slate-300 hover:bg-white/10" onClick={() => changeVolume(volume ? 0 : 0.9)} aria-label="Toggle sound">{volume ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</Button><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => changeVolume(Number(event.target.value))} className="h-1 w-16 accent-cyan-300" /></div>
        <Button variant="ghost" size="sm" disabled={!video.captionUrl} onClick={toggleCaptions} className={captionsOn ? "bg-fuchsia-500/20 text-fuchsia-200 hover:bg-fuchsia-500/30" : "text-slate-300 hover:bg-white/10 disabled:text-slate-600"} aria-label={video.captionUrl ? "Toggle captions" : "Captions are unavailable for this video"}><Captions className="mr-1 size-4" />CC</Button>
        <Button variant="ghost" size="icon" onClick={() => void containerRef.current?.requestFullscreen()} className="ml-auto size-8 text-slate-300 hover:bg-white/10" aria-label="Fullscreen"><Maximize className="size-4" /></Button>
      </div>
    </div>
  );
}
