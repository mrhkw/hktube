import { useEffect, useRef, useState } from 'react'
import { Maximize, Pause, Play, PictureInPicture2, Download, Share2, Bookmark, Flag } from 'lucide-react'
import { toggleSave, reportContent } from '../../lib/content'

interface Props { videoId: string; src: string; poster?: string; title?: string; allowDownload?: boolean; captionsUrl?: string; onReport?: () => void }
export default function VideoPlayer({ videoId, src, poster, title = 'HkTube video', allowDownload = false, captionsUrl, onReport }: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [saved, setSaved] = useState(false)
  const [quality, setQuality] = useState('Auto')
  const toggle = () => { if (!ref.current) return; if (ref.current.paused) void ref.current.play(); else ref.current.pause() }
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed }, [speed])
  const fullscreen = () => { if (ref.current?.requestFullscreen) void ref.current.requestFullscreen() }
  const pip = async () => { if (ref.current && document.pictureInPictureEnabled && document.pictureInPictureElement !== ref.current) await ref.current.requestPictureInPicture() }
  const share = async () => { if (navigator.share) await navigator.share({ title, url: window.location.href }); else await navigator.clipboard?.writeText(window.location.href) }
  const save = async () => { try { const result = await toggleSave('video', videoId); setSaved(result.saved) } catch { /* auth UI owns sign-in messaging */ } }
  const report = async () => { const reason = window.prompt('Why are you reporting this video?'); if (reason) { await reportContent('video', videoId, reason); onReport?.() } }
  return <section className="video-player" aria-label={title}>
    <div className="video-frame"><video ref={ref} src={src} poster={poster} controls={false} playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}>
      {captionsUrl && <track kind="captions" src={captionsUrl} srcLang="en" label="English" default />}
    </video><button type="button" className="video-center-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause /> : <Play />}</button></div>
    <div className="video-controls"><button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><label>Quality <select value={quality} onChange={e => setQuality(e.target.value)}><option>Auto</option><option>1080p</option><option>720p</option><option>480p</option></select></label><label>Speed <select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label><button type="button" onClick={pip} title="Picture in picture"><PictureInPicture2 size={18} /></button><button type="button" onClick={fullscreen} title="Fullscreen"><Maximize size={18} /></button></div>
    <div className="video-actions"><button type="button" onClick={save}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</button><button type="button" onClick={share}><Share2 size={17} />Share</button>{allowDownload && <a href={src} download className="btn-secondary"><Download size={17} />Download</a>}<button type="button" onClick={report}><Flag size={17} />Report</button></div>
  </section>
}
