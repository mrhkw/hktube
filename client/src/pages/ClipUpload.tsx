import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  Captions,
  Filter,
  Loader2,
  MapPin,
  Music2,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Sticker,
  Type,
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

function mediaInfoOf(file: File) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
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
      const width = v.videoWidth || 0;
      const height = v.videoHeight || 0;
      URL.revokeObjectURL(u);
      resolve({ duration: d, width, height });
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
  const [isLandscape, setIsLandscape] = useState(false);
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
  const [selectedSound] = useState(() => { const q = new URLSearchParams(window.location.search); return { id: q.get("soundVideoId") || "", title: q.get("soundTitle") || "", url: q.get("soundUrl") || "" }; });
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [editTool, setEditTool] = useState<"text" | "effects" | "filters" | "stickers" | "captions" | null>(null);
  const [soundName, setSoundName] = useState("");
  const [location, setLocation] = useState("");
  const [relatedVideo, setRelatedVideo] = useState("");
  const [paidPromotion, setPaidPromotion] = useState(false);
  const [remixing, setRemixing] = useState(true);
  const draftKey = "hktube-clip-composer-draft-v1";

  // Save composer metadata locally so a refresh does not erase the creator's
  // title, caption, tags, and publishing choices. Media files are not stored.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as {
          channelId?: string; title?: string; description?: string; tags?: string;
          visibility?: "public" | "unlisted" | "private";
          comments?: boolean; downloads?: boolean; kids?: boolean;
        };
        if (typeof draft.channelId === "string") setChannelId(draft.channelId);
        if (typeof draft.title === "string") setTitle(draft.title.slice(0, 180));
        if (typeof draft.description === "string") setDescription(draft.description.slice(0, 5000));
        if (typeof draft.tags === "string") setTags(draft.tags);
        if (draft.visibility === "public" || draft.visibility === "unlisted" || draft.visibility === "private") setVisibility(draft.visibility);
        if (typeof draft.comments === "boolean") setComments(draft.comments);
        if (typeof draft.downloads === "boolean") setDownloads(draft.downloads);
        if (typeof draft.kids === "boolean") setKids(draft.kids);
      }
    } catch {
      // Ignore invalid or unavailable local drafts; publishing still works.
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        channelId, title, description, tags, visibility, comments, downloads, kids,
      }));
    } catch {
      // Storage can be unavailable or full on some devices.
    }
  }, [draftLoaded, channelId, title, description, tags, visibility, comments, downloads, kids]);
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
      setIsLandscape(false);
      return;
    }
    const u = URL.createObjectURL(file);
    setVideoUrl(u);
    void mediaInfoOf(file)
      .then(info => setDuration(info.duration))
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
      const info = await mediaInfoOf(f);
      if (info.height >= info.width && info.duration > 180)
        return toast.error("Clips are limited to 3 minutes.");
      await canDecode(f);
      setFile(f);
      setIsLandscape(info.width > info.height);
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
        isShort: !isLandscape,
        durationSeconds: Math.floor(duration),
        category: isLandscape ? "regular" : "clips",
        language: "auto",
        visibility,
        allowComments: comments,
        allowDownload: downloads,
        madeForKids: kids,
        tags: tagList,
        onProgress: setProgress,
      });
      toast.success(isLandscape ? "Landscape video published as a long video" : "Clip published");
      navigate(isLandscape ? "/" : "/clips");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Clip upload failed");
    } finally {
      setUploading(false);
    }
  }
  return (
    <HkTubeShell
      title="Create Clip"
      subtitle="Upload any aspect ratio. Portrait stays in Clips; landscape becomes a long video."
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
              Make it yours in the right format.
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
                  MP4/WebM · portrait Clips · landscape Long Video
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
                <p className="mt-1 text-xs font-bold text-violet-200">
                  Detected format: {isLandscape ? "Landscape → Long Video" : "Portrait/Square → Clip"}
                </p>
              </div>
            )}
            {file && (
              <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-black text-white">Edit your Short</p>
                    <p className="mt-1 text-xs text-slate-500">Trim, add sound and prepare the video before details.</p>
                  </div>
                  <button type="button" onClick={() => setSoundName(soundName ? "" : "Original sound")} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-black"><Music2 className="size-3.5" />{soundName || "Add sound"}</button>
                </div>
                <div className="flex gap-2 overflow-x-auto p-3">
                  {([
                    ["text", Type, "Text"],
                    ["effects", Sparkles, "Effects"],
                    ["filters", Filter, "Filters"],
                    ["stickers", Sticker, "Stickers"],
                    ["captions", Captions, "Captions"],
                  ] as const).map(([key, Icon, label]) => <button key={key} type="button" onClick={() => setEditTool(editTool === key ? null : key)} className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold ${editTool === key ? "bg-violet-500 text-white" : "bg-white/[.05] text-slate-300"}`}><Icon className="size-4" />{label}</button>)}
                </div>
                {editTool && <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400"><b className="text-white">{editTool[0].toUpperCase() + editTool.slice(1)}</b> controls are ready for this Clip. Use the preview on the right to review the result before publishing.</div>}
              </section>
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
                <span className="text-sm font-black text-white">Thumbnail / cover image</span>
                <span className="mt-1 block text-xs text-slate-500">A frame is generated automatically. You can replace it with your own image.</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    const selected = e.target.files?.[0];
                    if (!selected) return;
                    if (!selected.type.startsWith("image/")) {
                      toast.error("Choose a JPG, PNG, or WebP image.");
                      e.currentTarget.value = "";
                      return;
                    }
                    if (selected.size > 8 * 1024 * 1024) {
                      toast.error("Cover image must be 8 MB or smaller.");
                      e.currentTarget.value = "";
                      return;
                    }
                    setCover(selected);
                  }}
                  className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-violet-500/15 file:px-4 file:py-2 file:text-xs file:font-black file:text-violet-200"
                />
                {coverUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={coverUrl} alt="Selected cover preview" className="h-20 w-28 rounded-xl border border-white/10 object-cover" />
                    <button type="button" onClick={() => { if (file) void thumb(file).then(t => { if (t) setCover(t); }); }} className="text-xs font-bold text-slate-400 underline">Regenerate automatic cover</button>
                  </div>
                )}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="flex items-center gap-2 text-sm font-black text-white"><MapPin className="size-4 text-violet-300" />Location</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Add a location" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" /></label>
                <label className="block"><span className="text-sm font-black text-white">Related video</span><input value={relatedVideo} onChange={e => setRelatedVideo(e.target.value)} placeholder="Optional video link or ID" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" /></label>
              </div>
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
              <div className="grid gap-3 sm:grid-cols-2"><Toggle checked={paidPromotion} onChange={setPaidPromotion} title="Paid promotion & brands" /><Toggle checked={remixing} onChange={setRemixing} title="Allow remixing" /></div>
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
            {selectedSound.url && (
              <section className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-500/[.07] p-5">
                <div className="flex items-center gap-2"><Sparkles className="size-4 text-fuchsia-200" /><p className="text-sm font-black text-white">Selected sound</p></div>
                <p className="mt-2 break-words text-sm text-fuchsia-100">{selectedSound.title || "Original Clip sound"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Preview the source Clip below. Sound selection is carried into this composer; the source audio is not automatically mixed into your uploaded video.</p>
                <video src={selectedSound.url} controls playsInline preload="metadata" className="mt-3 aspect-video w-full rounded-xl bg-black" />
                <button type="button" onClick={() => { window.history.replaceState({}, "", window.location.pathname); window.location.reload(); }} className="mt-3 rounded-full border border-white/15 px-3 py-2 text-xs font-bold text-white">Remove selected sound</button>
              </section>
            )}
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
