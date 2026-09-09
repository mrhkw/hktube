import { Button } from "@/components/ui/button";
import { formatDuration, VideoRecord } from "@/lib/video";
import { AlertTriangle, Captions, Home, Loader2, Maximize, Pause, PictureInPicture, Play, RefreshCw, Repeat2, Settings2, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";

export function VideoPlayer({ video, autoPlay = false, onProgress }: { video: VideoRecord; autoPlay?: boolean; onProgress?: (seconds: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.durationSeconds || 0);
  const [volume, setVolume] = useState(0.9);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(false);
  const [theater, setTheater] = useState(false);
  const isShort = video.category === "shorts";

  useEffect(() => {
    setIsPlaying(false); setCurrentTime(0); setDuration(video.durationSeconds || 0); setIsLoading(true); setPlaybackError(null);
    setSettingsOpen(false); setPlaybackRate(1); setLoop(false); setTheater(false);
  }, [video.id, video.durationSeconds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const element = videoRef.current;
      if (!element) return;
      if (event.key === " ") { event.preventDefault(); togglePlayback(); }
      if (event.key === "ArrowLeft") changeTime(Math.max(0, element.currentTime - 5));
      if (event.key === "ArrowRight") changeTime(Math.min(element.duration || duration, element.currentTime + 5));
      if (event.key.toLowerCase() === "m") changeVolume(element.muted || element.volume === 0 ? 0.9 : 0);
      if (event.key.toLowerCase() === "f") void toggleFullscreen();
      if (event.key.toLowerCase() === "t" && !isShort) setTheater(value => !value);
      if (event.key.toLowerCase() === "p") void pictureInPicture();
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function togglePlayback() {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setPlaybackError("Playback could not start. Check the media URL and browser permissions.")); else element.pause();
  }
  function changeTime(value: number) { const element = videoRef.current; if (!element) return; element.currentTime = value; setCurrentTime(value); }
  function changeVolume(value: number) { const element = videoRef.current; if (!element) return; element.volume = value; element.muted = value === 0; setVolume(value); }
  function toggleCaptions() { const track = videoRef.current?.textTracks?.[0]; if (!track) return; const show = track.mode !== "showing"; track.mode = show ? "showing" : "hidden"; setCaptionsOn(show); }
  function retryPlayback() { const element = videoRef.current; if (!element) return; setPlaybackError(null); setIsLoading(true); element.load(); }
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await containerRef.current?.requestFullscreen(); }
  async function pictureInPicture() {
    const element = videoRef.current;
    if (!element || !document.pictureInPictureEnabled) return;
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await element.requestPictureInPicture(); } catch { /* Browser may require active playback. */ }
  }
  function changePlaybackRate(rate: number) { const element = videoRef.current; if (!element) return; element.playbackRate = rate; setPlaybackRate(rate); }

  return (
    <div ref={containerRef} className={`relative overflow-hidden border border-violet-400/20 bg-black shadow-[0_0_45px_rgba(139,92,246,.13)] transition-[max-width,border-radius] duration-300 ${isShort ? "mx-auto w-full max-w-[720px] rounded-none lg:rounded-2xl" : theater ? "mx-auto w-full max-w-[1500px] rounded-xl" : "rounded-2xl"}`}>
      <div className={isShort ? "relative aspect-[9/16] max-lg:h-[100dvh] max-lg:w-full max-lg:aspect-auto bg-[#05050a]" : "relative aspect-video bg-[#05050a]"}>
        <Link href="/" className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black/85" aria-label="Back to Home"><Home className="size-4" />Home</Link>
        <video ref={videoRef} src={video.videoUrl} poster={video.thumbnailUrl || undefined} autoPlay={autoPlay} playsInline preload="metadata" loop={loop} onLoadStart={() => setIsLoading(true)} onCanPlay={() => setIsLoading(false)} onWaiting={() => setIsLoading(true)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => { setIsPlaying(false); onProgress?.(video.durationSeconds || duration); }} onError={() => { setIsLoading(false); setPlaybackError("This media could not be loaded. The source may be unavailable or unsupported."); }} onLoadedMetadata={event => setDuration(event.currentTarget.duration || video.durationSeconds || 0)} onTimeUpdate={event => { const seconds = event.currentTarget.currentTime; setCurrentTime(seconds); onProgress?.(seconds); }} className={isShort ? "size-full object-cover" : "size-full object-contain"}>
          {video.captionUrl && <track kind="captions" src={video.captionUrl} srcLang="en" label="English captions" />}
          Your browser does not support HTML5 video playback.
        </video>
        {isLoading && !playbackError && <div className="absolute inset-0 grid place-items-center bg-black/35" aria-live="polite"><span className="inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-medium text-white"><Loader2 className="size-4 animate-spin" />Loading media</span></div>}
        {playbackError && <div className="absolute inset-0 grid place-items-center bg-black/75 p-5 text-center"><div><AlertTriangle className="mx-auto size-7 text-amber-300" /><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white">{playbackError}</p><Button onClick={retryPlayback} className="mt-4 bg-fuchsia-500 text-white hover:bg-fuchsia-400"><RefreshCw className="mr-2 size-4" />Retry playback</Button></div></div>}
        {!isPlaying && !isLoading && !playbackError && <Button onClick={togglePlayback} aria-label="Play video" className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/90 p-0 text-white shadow-[0_0_35px_rgba(217,70,239,.55)] transition hover:scale-105 hover:bg-fuchsia-400 active:scale-95"><Play className="size-6 fill-current" /></Button>}
      </div>
      <div className={isShort ? "absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-10 sm:px-4" : "flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-white/10 bg-[#0b0b15] px-3 py-2.5 sm:px-4"}>
        <Button variant="ghost" size="icon" onClick={togglePlayback} className="size-8 text-white transition hover:scale-105 hover:bg-white/10" aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}</Button>
        <span className="w-[82px] text-xs tabular-nums text-slate-400">{formatDuration(currentTime)} / {formatDuration(duration)}</span>
        <input aria-label="Video progress" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => changeTime(Number(event.target.value))} className="h-1 min-w-20 flex-1 accent-fuchsia-400" />
        <div className="hidden items-center gap-2 sm:flex"><Button variant="ghost" size="icon" className="size-8 text-slate-300 hover:bg-white/10" onClick={() => changeVolume(volume ? 0 : 0.9)} aria-label="Toggle sound">{volume ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</Button><input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => changeVolume(Number(event.target.value))} className="h-1 w-16 accent-cyan-300" /></div>
        <Button variant="ghost" size="sm" disabled={!video.captionUrl} onClick={toggleCaptions} className={captionsOn ? "bg-fuchsia-500/20 text-fuchsia-200 hover:bg-fuchsia-500/30" : "text-slate-300 hover:bg-white/10 disabled:text-slate-600"} aria-label={video.captionUrl ? "Toggle captions" : "Captions are unavailable for this video"}><Captions className="mr-1 size-4" />CC</Button>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(value => !value)} className={`size-8 text-slate-300 transition hover:rotate-45 hover:bg-white/10 ${settingsOpen ? "bg-white/10 text-white" : ""}`} aria-label="Player settings"><Settings2 className="size-4" /></Button>
          {settingsOpen && <div className="absolute bottom-11 right-0 z-30 w-56 rounded-2xl border border-white/10 bg-[#10131d]/95 p-2 text-sm text-white shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Playback</div>
            <div className="grid grid-cols-4 gap-1 px-1">{[0.75, 1, 1.25, 1.5].map(rate => <button key={rate} type="button" onClick={() => changePlaybackRate(rate)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition hover:bg-white/10 ${playbackRate === rate ? "bg-violet-500/20 text-violet-200" : "text-slate-300"}`}>{rate}x</button>)}</div>
            <button type="button" onClick={() => setLoop(value => !value)} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/7"><Repeat2 className="size-4" /><span className="flex-1">Loop</span><span className={`size-2 rounded-full ${loop ? "bg-emerald-400" : "bg-slate-600"}`} /></button>
            {!isShort && <button type="button" onClick={() => setTheater(value => !value)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/7"><span className="grid size-4 grid-cols-3 gap-0.5"><i className="rounded-sm bg-current" /><i className="rounded-sm bg-current" /><i className="rounded-sm bg-current" /></span><span className="flex-1">Theater mode</span><span className={`size-2 rounded-full ${theater ? "bg-emerald-400" : "bg-slate-600"}`} /></button>}
            <button type="button" onClick={() => void pictureInPicture()} disabled={!document.pictureInPictureEnabled} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/7 disabled:cursor-not-allowed disabled:text-slate-600"><PictureInPicture className="size-4" /><span>Picture in picture</span></button>
            <div className="mt-1 border-t border-white/8 px-3 pt-2 text-[10px] leading-4 text-slate-600">Space play/pause · ←/→ seek 5s · M mute · F fullscreen · P PiP</div>
          </div>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => void pictureInPicture()} className="hidden size-8 text-slate-300 hover:bg-white/10 sm:inline-flex" aria-label="Picture in picture"><PictureInPicture className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => void toggleFullscreen()} className="ml-auto size-8 text-slate-300 hover:bg-white/10" aria-label="Fullscreen (F)"><Maximize className="size-4" /></Button>
      </div>
    </div>
  );
}
