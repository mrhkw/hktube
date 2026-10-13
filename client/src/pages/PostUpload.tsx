import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { supabase } from "@/lib/supabase";
import { sanitizeInput } from "@shared/security";

type ImageFilter = "original" | "warm" | "mono" | "vivid";
const FILTERS: Record<ImageFilter, { label: string; css: string }> = {
  original: { label: "Original", css: "none" },
  warm: { label: "Warm", css: "sepia(.18) saturate(1.15)" },
  mono: { label: "Mono", css: "grayscale(1)" },
  vivid: { label: "Vivid", css: "saturate(1.35) contrast(1.06)" },
};
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 40 * 1024 * 1024;

async function filteredImage(file: File, filter: ImageFilter): Promise<File> {
  if (filter === "original") return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image editor is unavailable.");
    context.filter = FILTERS[filter].css;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Filtered image export failed.")), "image/jpeg", .92));
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-edited.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}

export default function PostUploadPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [filter, setFilter] = useState<ImageFilter>("original");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const previews = useMemo(() => images.map(file => URL.createObjectURL(file)), [images]);

  useEffect(() => { if (!isAuthenticated && !loading) startLogin(); }, [isAuthenticated, loading]);
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);

  function selectImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.some(file => !TYPES.has(file.type.toLowerCase()) || file.size <= 0 || file.size > MAX_FILE)) {
      toast.error("Use JPG, PNG or WebP images under 8 MB each.");
      return;
    }
    if (images.length + selected.length > 10 || [...images, ...selected].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) {
      toast.error("A post can contain up to 10 images and 40 MB total.");
      return;
    }
    setImages(current => [...current, ...selected]);
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !isAuthenticated) return;
    const cleanBody = sanitizeInput(body).trim().slice(0, 5000);
    if (!cleanBody && !images.length) { setError("Write a post or select an image."); return; }
    if (visibility === "private" && images.length) { setError("Image posts use public media storage. Remove the images to publish a private text post."); return; }
    setBusy(true); setError("");
    const uploaded: string[] = [];
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw new Error("Your session expired. Sign in again.");
      const urls: string[] = [];
      for (const original of images) {
        const image = await filteredImage(original, filter);
        const path = data.user.id + "/posts/" + crypto.randomUUID() + ".jpg";
        const { error: uploadError } = await supabase.storage.from("thumbnails").upload(path, image, { contentType: image.type, upsert: false, cacheControl: "31536000" });
        if (uploadError) throw new Error("Image upload failed: " + uploadError.message);
        uploaded.push(path);
        urls.push(supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl);
      }
      const { error: insertError } = await supabase.from("posts").insert({
        creator_id: data.user.id,
        content: cleanBody,
        media_path: urls[0] ?? null,
        media_paths: urls,
        visibility,
        status: "published",
        moderation_status: "pending",
      });
      if (insertError) throw new Error("Post could not be saved: " + insertError.message);
      if (visibility === "private") {
        toast.success("Private text post saved. It will not appear in the public feed.");
      } else {
        toast.success("Post submitted for moderation.");
        navigate("/posts");
      }
      setBody(""); setImages([]); setFilter("original");
    } catch (cause) {
      if (uploaded.length) await supabase.storage.from("thumbnails").remove(uploaded).catch(() => undefined);
      const message = cause instanceof Error ? cause.message : "Post publish failed.";
      setError(message); toast.error(message);
    } finally { setBusy(false); }
  }

  return <HkTubeShell title="Create post" subtitle="Share text and images with the HkTube community.">
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-7 lg:px-10">
      <button type="button" onClick={() => navigate("/upload")} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-slate-300"><ArrowLeft className="size-4" />Back to Upload Studio</button>
      <form onSubmit={event => void publish(event)} className="space-y-6 rounded-3xl border border-white/10 bg-[#101321] p-5 sm:p-7">
        <header><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">HKTUBE CREATION STUDIO</p><h1 className="mt-2 text-3xl font-black text-white">Create a post</h1><p className="mt-2 text-sm text-slate-400">Choose real images from your device gallery, preview a filter and publish your post.</p></header>
        <label className="block"><span className="mb-2 block text-sm font-bold text-white">Post text</span><textarea value={body} onChange={event => setBody(event.target.value.slice(0, 5000))} maxLength={5000} rows={5} placeholder="What would you like to share?" className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none focus:border-violet-300/50" /><span className="mt-1 block text-right text-xs text-slate-500">{body.length}/5000</span></label>
        <section className="rounded-2xl border border-dashed border-white/15 p-4">
          <div className="flex items-center gap-3"><ImagePlus className="size-6 text-violet-300" /><div className="flex-1"><p className="font-bold text-white">Device gallery</p><p className="text-xs text-slate-500">JPG, PNG, WebP · max 10 images · 8 MB each</p></div><label className="cursor-pointer rounded-full bg-violet-500 px-4 py-2 text-xs font-black text-white">Add images<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={event => { selectImages(event.currentTarget.files); event.currentTarget.value = ""; }} /></label></div>
          {images.length > 0 && <><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{previews.map((url, index) => <div key={url} className="relative overflow-hidden rounded-xl"><img src={url} alt={"Selected image " + (index + 1)} style={{ filter: FILTERS[filter].css }} className="aspect-square w-full object-cover" /><button type="button" onClick={() => setImages(current => current.filter((_, i) => i !== index))} aria-label={"Remove image " + (index + 1)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/80 text-white"><X className="size-4" /></button></div>)}</div><div className="mt-4"><p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-300">Filters (saved to image)</p><div className="flex flex-wrap gap-2">{(Object.keys(FILTERS) as ImageFilter[]).map(id => <button type="button" key={id} onClick={() => setFilter(id)} aria-pressed={filter === id} className={"rounded-full border px-4 py-2 text-xs font-bold " + (filter === id ? "border-violet-300 bg-violet-500/20 text-white" : "border-white/10 text-slate-400")}>{FILTERS[id].label}</button>)}</div></div></>}
        </section>
        <label className="block max-w-xs"><span className="mb-2 block text-sm font-bold text-white">Visibility</span><select value={visibility} onChange={event => setVisibility(event.target.value as "public" | "private")} className="w-full rounded-xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white"><option value="public">Public</option><option value="private">Private</option></select></label>
        <p className="text-xs leading-5 text-slate-500">Posts are submitted with moderation pending. Uploaded images use public storage, so private posts are text-only.</p>
        {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p>}
        <button type="submit" disabled={busy || (!body.trim() && !images.length)} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 text-sm font-black text-white disabled:opacity-50">{busy ? <><Loader2 className="mr-2 size-4 animate-spin" />Uploading and publishing…</> : "Publish post"}</button>
      </form>
    </main>
  </HkTubeShell>;
}
