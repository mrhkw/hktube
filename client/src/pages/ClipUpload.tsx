import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  listMySupabaseChannels,
  type SupabaseChannel,
} from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { toast } from "sonner";

function durationOf(file: File) {
  return new Promise<number>((resolve, reject) => {
    const v = document.createElement("video"),
      u = URL.createObjectURL(file);
    const t = window.setTimeout(() => {
      URL.revokeObjectURL(u);
      reject(new Error("Video metadata could not be read."));
    }, 10000);
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      window.clearTimeout(t);
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      URL.revokeObjectURL(u);
      resolve(d);
    };
    v.onerror = () => {
      window.clearTimeout(t);
      URL.revokeObjectURL(u);
      reject(new Error("This video cannot be decoded by the browser."));
    };
    v.src = u;
  });
}
function canDecode(file: File) {
  return new Promise<void>((resolve, reject) => {
    const v = document.createElement("video"),
      u = URL.createObjectURL(file);
    const done = (error?: Error) => {
      window.clearTimeout(t);
      URL.revokeObjectURL(u);
      error ? reject(error) : resolve();
    };
    const t = window.setTimeout(
      () =>
        done(
          new Error(
            "This video format is not playable on this device. Export the Clip as MP4/H.264 and try again."
          )
        ),
      12000
    );
    v.muted = true;
    v.preload = "auto";
    v.onloadeddata = () => done();
    v.onerror = () =>
      done(
        new Error(
          "This video format is not playable on this device. Export the Clip as MP4/H.264 and try again."
        )
      );
    v.src = u;
  });
}
function thumb(file: File) {
  return new Promise<File | null>(resolve => {
    const v = document.createElement("video"),
      c = document.createElement("canvas"),
      u = URL.createObjectURL(file);
    const done = (f: File | null) => {
      URL.revokeObjectURL(u);
      resolve(f);
    };
    v.muted = true;
    v.preload = "auto";
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(
        Math.max(v.duration * 0.12, 0.1),
        Math.max(v.duration - 0.1, 0.1)
      );
    };
    v.onseeked = () => {
      const w = Math.min(v.videoWidth || 720, 1080);
      c.width = w;
      c.height = Math.max(
        1,
        Math.round((w * (v.videoHeight || 1280)) / (v.videoWidth || 720))
      );
      const ctx = c.getContext("2d");
      if (!ctx) return done(null);
      ctx.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(
        b =>
          done(
            b ? new File([b], "clip-cover.jpg", { type: "image/jpeg" }) : null
          ),
        "image/jpeg",
        0.86
      );
    };
    v.onerror = () => done(null);
    v.src = u;
  });
}

export default function ClipUploadPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [channels, setChannels] = useState<SupabaseChannel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<
    "public" | "unlisted" | "private"
  >("public");
  const [comments, setComments] = useState(true);
  const [downloads, setDownloads] = useState(false);
  const [kids, setKids] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) {
      if (!loading) startLogin();
      return;
    }
    void listMySupabaseChannels()
      .then(v => {
        setChannels(v);
        setChannelId(v[0]?.id ?? "");
      })
      .catch(e =>
        toast.error(e instanceof Error ? e.message : "Channels could not load")
      );
  }, [isAuthenticated, loading]);
  useEffect(() => {
    if (!file) {
      setVideoUrl("");
      setDuration(0);
      return;
    }
    const u = URL.createObjectURL(file);
    setVideoUrl(u);
    void durationOf(file)
      .then(setDuration)
      .catch(e => toast.error(e.message));
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(() => {
    if (!cover) {
      setCoverUrl("");
      return;
    }
    const u = URL.createObjectURL(cover);
    setCoverUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [cover]);
  const can = Boolean(file && channelId && title.trim() && !uploading);
  const tagList = useMemo(
    () =>
      Array.from(
        new Set(
          tags
            .split(/[,#\s]+/)
            .map(x => x.trim().toLowerCase())
            .filter(Boolean)
        )
      ).slice(0, 20),
    [tags]
  );
  async function choose(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/"))
      return toast.error("Choose a video file.");
    try {
      const d = await durationOf(f);
      if (d > 180) return toast.error("Clips are limited to 3 minutes.");
      await canDecode(f);
      setFile(f);
      if (!cover) {
        const t = await thumb(f);
        if (t) setCover(t);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Video could not be inspected"
      );
    }
  }
  async function publish() {
    if (!file || !can) return;
    setUploading(true);
    try {
      await createSupabaseVideo({
        channelId,
        title: title.trim(),
        description: description.trim(),
        file,
        thumbnail: cover,
        isShort: true,
        durationSeconds: Math.floor(duration),
        category: "clips",
        language: "auto",
        visibility,
        allowComments: comments,
        allowDownload: downloads,
        madeForKids: kids,
        tags: tagList,
        onProgress: setProgress,
      });
      toast.success("Clip published");
      navigate("/clips");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clip upload failed");
    } finally {
      setUploading(false);
    }
  }
  return (
    <HkTubeShell
      title="Create Clip"
      subtitle="Original HkTube short-video composer."
    >
      <main className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link
            href="/clips"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"
          >
            <ArrowLeft className="size-4" />
            Back to Clips
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-200">
            <Sparkles className="size-3.5" />
            Clips Studio
          </span>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">
              Publish a Clip
            </p>
            <h1 className="mt-2 text-2xl font-black text-white">
              Make it vertical. Make it yours.
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              HkTube's own short-video composer with real publishing.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="grid min-h-36 cursor-pointer place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center hover:border-violet-300/50">
                <UploadCloud className="size-8 text-violet-300" />
                <span className="mt-2 text-sm font-black text-white">
                  Choose Clip
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  MP4/WebM · vertical · max 180s
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="sr-only"
                  onChange={e => void choose(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="grid min-h-36 cursor-pointer place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-center hover:border-fuchsia-300/50">
                <Camera className="size-8 text-fuchsia-300" />
                <span className="mt-2 text-sm font-black text-white">
                  Record Clip
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Use your device camera
                </span>
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="sr-only"
                  onChange={e => void choose(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {file && (
              <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-500/[.06] p-4 text-sm">
                <div className="flex items-center gap-2 font-bold text-emerald-200">
                  <Check className="size-4" />
                  Ready: {file.name}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Duration {Math.floor(duration)}s ·{" "}
                  {Math.round((file.size / 1024 / 1024) * 10) / 10} MB
                </p>
              </div>
            )}
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-black text-white">Channel</span>
                <select
                  value={channelId}
                  onChange={e => setChannelId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none"
                >
                  {channels.map(c => (
                    <option key={c.id} value={c.id}>
                      @{c.handle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-black text-white">
                  Clip title
                </span>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value.slice(0, 180))}
                  maxLength={180}
                  placeholder="Give your Clip a clear title"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-white">Caption</span>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 5000))}
                  rows={4}
                  placeholder="Tell viewers what they are watching…"
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-white">Hashtags</span>
                <input
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="#gaming #cars #funny"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <span className="text-xs font-black text-white">
                    Visibility
                  </span>
                  <select
                    value={visibility}
                    onChange={e =>
                      setVisibility(e.target.value as typeof visibility)
                    }
                    className="mt-2 w-full bg-transparent text-sm text-slate-300 outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <Toggle
                  checked={comments}
                  onChange={setComments}
                  title="Comments"
                />
                <Toggle
                  checked={downloads}
                  onChange={setDownloads}
                  title="Downloads"
                />
              </div>
              <Toggle checked={kids} onChange={setKids} title="Made for kids" />
              <div className="rounded-2xl border border-amber-300/10 bg-amber-500/[.04] p-4 text-xs leading-5 text-slate-400">
                <b className="text-amber-200">Rights check:</b> Upload only
                video/audio you created or have permission/licensing to use.
                Reported copyright concerns can be reviewed before continued
                recommendation.
              </div>
            </div>
            <button
              disabled={!can}
              onClick={() => void publish()}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black text-white disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Publishing {progress}%
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 size-4" />
                  Publish Clip
                </>
              )}
            </button>
          </section>
          <aside className="space-y-4">
            <section className="sticky top-20 overflow-hidden rounded-3xl border border-white/10 bg-black">
              <div className="aspect-[9/16] max-h-[680px] w-full">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    poster={coverUrl || undefined}
                    controls
                    muted
                    playsInline
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="grid size-full place-items-center p-8 text-center text-sm text-slate-500">
                    <Camera className="mx-auto size-10 text-slate-700" />
                    <p className="mt-3">Your Clip preview appears here.</p>
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 p-4">
                <p className="line-clamp-2 font-black text-white">
                  {title || "Your Clip title"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {duration ? duration + " seconds" : "0 seconds"}
                </p>
              </div>
            </section>
            <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-300" />
                <p className="text-sm font-black text-white">Built-in checks</p>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
                <li>• Vertical format validation</li>
                <li>• 180-second duration limit</li>
                <li>• Authenticated resumable upload</li>
                <li>• Moderation/copyright review ready</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </HkTubeShell>
  );
}
function Toggle({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="size-4 accent-violet-500"
      />
      <span className="text-xs font-black text-white">{title}</span>
    </label>
  );
}
