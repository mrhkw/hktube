import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { uploadProfileImage } from "@/lib/profileMedia";

export default function CreateChannel() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(me.data), retry: 2 });
  const create = trpc.channels.create.useMutation();
  const update = trpc.channels.update.useMutation();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => { if (me.data && !displayName) setDisplayName(me.data.name || me.data.email?.split("@")[0] || "HkTube Creator"); }, [me.data, displayName]);
  useEffect(() => { if (!logoFile) { setLogoPreview(""); return; } const url = URL.createObjectURL(logoFile); setLogoPreview(url); return () => URL.revokeObjectURL(url); }, [logoFile]);

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image file.");
    if (file.size > 12 * 1024 * 1024) return void toast.error("Channel logo must be 12 MB or smaller.");
    setLogoFile(file);
  }

  async function submit() {
    const cleanName = displayName.trim();
    const cleanHandle = handle.trim().replace(/^@+/, "");
    if (!me.data) return void toast.error("Please sign in first.");
    if (!cleanName || !/^[A-Za-z0-9_]{3,64}$/.test(cleanHandle) || create.isPending) return;
    try {
      const created = await create.mutateAsync({ handle: cleanHandle, displayName: cleanName, description: description.trim() });
      let finalChannel = created;
      if (logoFile) {
        try {
          const uploaded = await uploadProfileImage(logoFile);
          finalChannel = await update.mutateAsync({ id: created.id, displayName: cleanName, description: description.trim(), avatarUrl: uploaded.url, bannerUrl: created.bannerUrl });
        } catch (logoError) { toast.error(logoError instanceof Error ? `Channel created, but logo upload failed: ${logoError.message}` : "Channel created, but logo upload failed."); }
      }
      utils.channels.mine.setData(undefined, current => [finalChannel, ...(current ?? []).filter(channel => channel.id !== finalChannel.id)]);
      await utils.channels.mine.invalidate();
      toast.success("Channel created successfully.");
      navigate("/profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Channel could not be created.";
      if (/unauthorized|invalid session|login/i.test(message)) toast.error("Your HkTube login session is missing. Please log in again.");
      else if (/taken|already|unique/i.test(message)) toast.error("That channel handle is already taken. Choose another handle.");
      else toast.error(`Channel create failed: ${message}`);
    }
  }

  if (me.isLoading) return <HkTubeShell><div className="mx-auto max-w-xl p-8 text-sm text-slate-500">Checking your HkTube account…</div></HkTubeShell>;
  if (!me.data) return <HkTubeShell><div className="mx-auto max-w-xl p-8"><Link href="/auth" className="inline-flex items-center text-sm font-semibold"><ArrowLeft className="mr-1.5 size-4" />Sign in</Link><div className="mt-8 rounded-3xl border p-8 text-center"><h1 className="text-2xl font-bold">Sign in to create a channel</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your HkTube account session is not available. Sign in once and then create your channel.</p><Link href="/auth" className="mt-6 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">Sign in / Sign up</Link></div></div></HkTubeShell>;

  return <HkTubeShell><div className="mx-auto max-w-xl pb-12 pt-2"><Link href="/profile" className="inline-flex items-center text-sm font-semibold"><ArrowLeft className="mr-1.5 size-4" />Back to profile</Link><div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-black/50">CREATOR SETUP</p><h1 className="mt-2 text-3xl font-bold">Create your channel</h1><p className="mt-3 text-sm leading-6 text-slate-500">Choose a unique handle and add your channel identity.</p><form className="mt-7 space-y-5" onSubmit={e => { e.preventDefault(); void submit(); }}><div className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-center gap-4"><div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-sm">{logoPreview ? <img src={logoPreview} alt="Channel logo preview" className="size-full object-cover" /> : <ImagePlus className="size-7 text-slate-400" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-bold">Channel logo</p><p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG, WebP, AVIF or GIF · up to 12 MB.</p><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center rounded-full bg-black px-4 py-2 text-xs font-bold text-white">{logoFile ? "Change logo" : "Choose logo"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={e => chooseLogo(e.target.files?.[0])} /></label>{logoFile && <button type="button" onClick={() => setLogoFile(null)} className="inline-flex items-center rounded-full border px-3 py-2 text-xs font-bold text-slate-700"><X className="mr-1 size-3.5" />Remove</button>}</div></div></div></div>{channels.data && channels.data.length > 0 && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p className="font-semibold">You already have {channels.data.length} channel{channels.data.length === 1 ? "" : "s"}.</p><p className="mt-1">You can create another one with a different handle.</p></div>}<label className="block"><span className="text-sm font-semibold">Channel name</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={255} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="Your public channel name" /></label><label className="block"><span className="text-sm font-semibold">Handle</span><input value={handle} onChange={e => setHandle(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))} required minLength={3} maxLength={64} autoCapitalize="none" autoCorrect="off" className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="your_channel_handle" /><span className="mt-1 block text-xs text-slate-500">3–64 letters, numbers, or underscores.</span></label><label className="block"><span className="text-sm font-semibold">Description</span><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="Tell viewers what your channel publishes." /></label><button type="submit" disabled={create.isPending || update.isPending || !handle.trim() || handle.trim().length < 3 || !displayName.trim()} className="inline-flex items-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{create.isPending || update.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}{create.isPending || update.isPending ? "Creating channel…" : "Create channel"}</button></form></div></div></HkTubeShell>;
}
