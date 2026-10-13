import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Circle, FlipHorizontal2, Loader2, Lock, Radio, Settings2, Users, X } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";

export default function LiveStudio() {
  const { isAuthenticated, loading } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [audience, setAudience] = useState<"everyone" | "kids">("everyone");
  const [schedule, setSchedule] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) startLogin();
  }, [isAuthenticated, loading]);

  useEffect(() => () => stopCamera(), []);

  async function startCamera(nextFacing = facing) {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera preview is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      toast.error("Camera or microphone permission was denied.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function flipCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (cameraOn) await startCamera(next);
  }

  function submit() {
    toast.info("Live streaming setup is ready. Connect a streaming provider in Creator Studio to go live.");
  }

  if (!isAuthenticated) return <HkTubeShell title="Live"><div className="p-10 text-center text-slate-400">Sign in to start a live setup.</div></HkTubeShell>;

  return (
    <HkTubeShell title="Live" subtitle="Set up your camera, audience and stream details.">
      <main className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft className="size-4" />Back</Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-xs font-black text-rose-200"><Radio className="size-3.5" />Live setup</span>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-black">
            <div className="relative aspect-video bg-[#080a10]">
              {cameraOn ? <video ref={videoRef} muted playsInline className="size-full object-cover" /> : <div className="grid size-full place-items-center p-8 text-center"><Camera className="size-12 text-slate-700" /><p className="mt-3 text-sm text-slate-400">Preview your camera before going live.</p><button type="button" onClick={() => void startCamera()} className="mt-4 rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white">Turn on camera</button></div>}
              {cameraOn && <><span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-xs font-black text-white"><Circle className="size-3 fill-rose-500 text-rose-500" />Preview</span><button type="button" onClick={() => void flipCamera()} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-black/65 text-white" aria-label="Flip camera"><FlipHorizontal2 className="size-5" /></button><button type="button" onClick={stopCamera} className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-black/65 text-white" aria-label="Turn off camera"><X className="size-5" /></button></>}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 p-4"><div><p className="text-sm font-black text-white">Camera and microphone</p><p className="mt-1 text-xs text-slate-500">Check framing, lighting and audio before publishing.</p></div><span className={cameraOn ? "rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-200" : "rounded-full bg-white/[.06] px-3 py-1.5 text-xs font-black text-slate-400"}>{cameraOn ? "Ready" : "Off"}</span></div>
          </section>
          <section className="rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[.18em] text-rose-300">Go live</p>
            <h1 className="mt-2 text-2xl font-black text-white">Tell viewers what is happening.</h1>
            <label className="mt-6 block"><span className="text-sm font-black text-white">Title</span><input value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} placeholder="Add a title for your live stream" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-rose-300/50" /></label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-black text-white">Visibility</span><select value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white"><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label><label className="block"><span className="text-sm font-black text-white">Audience</span><select value={audience} onChange={e => setAudience(e.target.value as typeof audience)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white"><option value="everyone">Not made for kids</option><option value="kids">Made for kids</option></select></label></div>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-4"><input type="checkbox" checked={schedule} onChange={e => setSchedule(e.target.checked)} className="size-4 accent-rose-500" /><span><b className="block text-sm text-white">Schedule for later</b><span className="mt-1 block text-xs text-slate-500">Prepare the stream now and choose a time in Creator Studio.</span></span></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><Settings2 className="size-5 text-rose-200" /><p className="mt-2 text-sm font-black text-white">Stream settings</p><p className="mt-1 text-xs leading-5 text-slate-500">Camera, microphone and privacy are checked before launch.</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><Users className="size-5 text-rose-200" /><p className="mt-2 text-sm font-black text-white">Audience controls</p><p className="mt-1 text-xs leading-5 text-slate-500">Choose who can discover and watch your stream.</p></div></div>
            <button type="button" onClick={submit} disabled={!title.trim()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-rose-500 px-6 text-sm font-black text-white transition hover:bg-rose-400 disabled:opacity-50"><Lock className="size-4" />{schedule ? "Schedule live" : "Go live"}</button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Live provider connection is kept separate from HkTube uploads so your video files remain safe.</p>
          </section>
        </div>
      </main>
    </HkTubeShell>
  );
}
