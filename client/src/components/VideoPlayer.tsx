import { Button } from "@/components/ui/button";
import { formatDuration, VideoRecord } from "@/lib/video";
import { AlertTriangle, Captions, Home, Loader2, Maximize, Pause, Play, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";

export function VideoPlayer({ video, autoPlay = false }: { video: VideoRecord; autoPlay?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds || 0);
  const [volume, setVolume] = useState(0.9);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const isShort = video.category === "shorts";

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(video.durationSeconds || 0);
    setIsLoading(true);
    setPlaybackError(null);
  }, [video.id, video.durationSeconds]);

  function togglePlayback() {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaybackError("Playback could not start. Check the media URL and browser permissions.")); else element.pause();
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

  function retryPlayback() {
    const element = videoRef.current;
    if (!element) return;
    setPlaybackError(null);
    setIsLoading(true);
    element.load();
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden border border-violet-400/20 bg-black shadow-[0_0_45px_rgba(139,92,246,.13)] ${isShort ? "mx-auto w-full max-w-[720px] rounded-none lg:rounded-2xl" : "rounded-2xl"}`}>
      <div className={isShort ? "relative aspect-[9/16] max-lg:h-[100dvh] max-lg:w-full max-lg:aspect-auto bg-[#05050a]" : "relative aspect-video bg-[#05050a]"}>
        <Link href="/" className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black/85" aria-label="Back to Home"><Home className="size-4" />Home</Link>
        <video ref={videoRef} src={video.videoUrl} poster={video.thumbnailUrl || undefined} autoPlay={autoPlay} playsInline preload="metadata" onLoadStart={() => setIsLoading(true)} onCanPlay={() => setIsLoading(false)} onWaiting={() => setIsLoading(true)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onError={() => { setIsLoading(false); setPlaybackError("This media could not be loaded. The source may be unavailable or unsupported."); }} onLoadedMetadata={event => setDuration(event.currentTarget.duration || video.durationSeconds || 0)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} className={isShort ? "size-full object-cover" : "size-full object-contain"}>
          {video.captionUrl && <track kind="captions" src={video.captionUrl} srcLang="en" label="English captions" />}
          Your browser does not support HTML5 video playback.
        </video>
        {isLoading && !playbackError && <div className="absolute inset-0 grid place-items-center bg-black/35" aria-live="polite"><span className="inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white"><Loader2 className="size-4 animate-spin" />Loading media</span></div>}
        {playbackError && <div className="absolute inset-0 grid place-items-center bg-black/75 p-5 text-center"><div><AlertTriangle className="mx-auto size-7 text-amber-300" /><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white">{playbackError}</p><Button onClick={retryPlayback} className="mt-4 bg-fuchsia-500 text-white hover:bg-fuchsia-400"><RefreshCw className="mr-2 size-4" />Retry playback</Button></div></div>}
        {!isPlaying && !isLoading && !playbackError && <Button onClick={togglePlayback} aria-label="Play video" className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/90 p-0 text-white shadow-[0_0_35px_rgba(217,70,239,.55)] hover:bg-fuchsia-400"><Play className="size-6 fill-current" /></Button>}
      </div>
      <div className={isShort ? "absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-10 sm:px-4" : "flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 bg-[#0b0b15] px-3 py-2.5 sm:px-4"}>
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
