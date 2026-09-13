import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listMySupabaseChannels, updateSupabaseChannel, type SupabaseChannel } from "@/lib/supabaseChannels";
import { listMySupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { uploadProfileImage } from "@/lib/profileMedia";
import { Link } from "wouter";
import { CircleUserRound, Edit3, ImageOff, Loader2, Play, Share2, Upload, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export default function Profile() {
  const { user, loading } = useAuth();
  const [channel, setChannel] = useState<SupabaseChannel | null>(null);
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"avatar" | "banner" | null>(null);

  async function loadProfile() {
    if (!user) return;
    setDataLoading(true);
    try {
      const [channels, ownVideos] = await Promise.all([listMySupabaseChannels(), listMySupabaseVideos(user.openId?.replace(/^supabase:/, "") || "")]);
      setChannel(channels[0] ?? null);
      setVideos(ownVideos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your profile.");
    } finally { setDataLoading(false); }
  }

  useEffect(() => { if (user) void loadProfile(); else setDataLoading(false); }, [user?.openId]);
  useEffect(() => { if (!channel) return; setDisplayName(channel.displayName); setDescription(channel.description || ""); setAvatarUrl(channel.avatarUrl || user?.avatarUrl || ""); setBannerUrl(channel.bannerUrl || ""); }, [channel?.id, channel?.displayName, channel?.description, channel?.avatarUrl, channel?.bannerUrl, user?.avatarUrl]);

  if (loading) return <HkTubeShell title="Profile"><div className="grid min-h-[55vh] place-items-center"><CircleUserRound className="size-8 animate-pulse text-violet-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Profile"><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-200" /><h1 className="mt-4 text-2xl font-black text-white">Sign in to view your profile</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your profile, channel and published content are available after signing in.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;

  async function chooseImage(kind: "avatar" | "banner", file?: File) {
    if (!file) return;
    try { setUploadingImage(kind); const result = await uploadProfileImage(file); if (kind === "avatar") setAvatarUrl(result.url); else setBannerUrl(result.url); toast.success(`${kind === "avatar" ? "Profile picture" : "Banner"} uploaded.`); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not upload the image."); } finally { setUploadingImage(null); }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    try { setSaving(true); const updated = await updateSupabaseChannel(channel.id, { displayName: displayName.trim(), description: description.trim(), avatarUrl: avatarUrl || null, bannerUrl: bannerUrl || null }); setChannel(updated); setEditOpen(false); toast.success("Channel profile updated."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update channel profile."); } finally { setSaving(false); }
  }

  async function shareChannel() {
    const url = channel ? `${window.location.origin}/channel/${channel.handle}` : window.location.href;
    try { if (navigator.share) await navigator.share({ title: channel?.displayName || "HkTube profile", url }); else { await navigator.clipboard.writeText(url); toast.success("Profile link copied."); } } catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this profile."); }
  }

  return <HkTubeShell title="Profile" subtitle="Your HkTube creator profile, channel identity and published videos.">
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 pb-28 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111624]">
        <div className="relative h-36 bg-gradient-to-r from-violet-500/35 via-fuchsia-400/15 to-cyan-300/20 sm:h-56">{channel?.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover" />}</div>
        <div className="px-5 pb-6 sm:px-8"><div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#111624] bg-violet-500/40 text-3xl font-black text-white">{channel?.avatarUrl || user.avatarUrl ? <img src={channel?.avatarUrl || user.avatarUrl || ""} alt="" className="size-full object-cover" /> : (channel?.displayName || user.name || "H").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black text-white">{channel?.displayName || user.name || "HkTube Creator"}</h1>{channel && <p className="mt-1 text-sm text-slate-400">@{channel.handle} · {channel.subscriberCount.toLocaleString()} subscribers</p>}<p className="mt-1 text-xs text-slate-500">{user.email || "HkTube member"}</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => setEditOpen(true)} disabled={!channel} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"><Edit3 className="mr-2 size-4" />Edit profile</Button><Button type="button" onClick={() => void shareChannel()} variant="outline" className="rounded-full border-white/15 text-white hover:bg-white/10"><Share2 className="mr-2 size-4" />Share</Button><Link href="/upload" className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white"><Upload className="mr-2 size-4" />Upload</Link></div></div><p className="mt-5 max-w-3xl text-sm leading-6 text-slate-300">{channel?.description || "Add a description to tell viewers what your channel makes."}</p></div>
      </section>

      {dataLoading && <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[.06] p-4 text-sm text-slate-300"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading your channel data…</section>}
      {!dataLoading && !channel && <section className="rounded-3xl border border-dashed border-violet-300/20 bg-violet-500/[.05] p-8 text-center"><UsersRound className="mx-auto size-8 text-violet-200" /><h2 className="mt-4 text-xl font-black text-white">Create your channel</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Your HkTube account is ready. Create the public channel identity you will use for uploads.</p><Link href="/channel/create" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950">Create channel</Link></section>}
      {channel && <section className="grid gap-3 sm:grid-cols-3"><Metric label="Subscribers" value={channel.subscriberCount.toLocaleString()} /><Metric label="Published videos" value={String(videos.length)} /><Metric label="Channel status" value={channel.verificationStatus} /></section>}

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300/70">Channel</p><h2 className="mt-1 text-xl font-black text-white">Published videos</h2></div><Link href="/upload" className="text-xs font-bold text-violet-200">Upload</Link></div>{videos.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{videos.map(video => <Link key={video.id} href={`/watch/${video.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/15"><div className="aspect-video bg-white/[.04]">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-600"><ImageOff /></div>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views</p></div></Link>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center"><Play className="mx-auto size-7 text-slate-600" /><p className="mt-3 text-sm text-slate-500">Your published videos will appear here.</p></div>}</section>
    </div>

    <DialogShell open={editOpen} onClose={() => setEditOpen(false)}>
      <form onSubmit={saveProfile} className="space-y-4"><div><label className="text-xs font-bold text-slate-300">Display name</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={255} className="mt-1 border-white/10 bg-black/20 text-white" required /></div><div><label className="text-xs font-bold text-slate-300">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={5} className="mt-1 border-white/10 bg-black/20 text-white" placeholder="Tell viewers about your channel" /></div><div><label className="text-xs font-bold text-slate-300">Profile picture</label><div className="mt-1 flex gap-2"><Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="border-white/10 bg-black/20 text-white" placeholder="Image URL (optional)" type="url" /><label className="inline-flex shrink-0 cursor-pointer items-center rounded-xl border border-white/10 px-3 text-xs font-bold text-white hover:bg-white/5">{uploadingImage === "avatar" ? <Loader2 className="size-4 animate-spin" /> : "Choose image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={e => void chooseImage("avatar", e.target.files?.[0])} /></label></div></div><div><label className="text-xs font-bold text-slate-300">Channel banner</label><div className="mt-1 flex gap-2"><Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} className="border-white/10 bg-black/20 text-white" placeholder="Image URL (optional)" type="url" /><label className="inline-flex shrink-0 cursor-pointer items-center rounded-xl border border-white/10 px-3 text-xs font-bold text-white hover:bg-white/5">{uploadingImage === "banner" ? <Loader2 className="size-4 animate-spin" /> : "Choose image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={e => void chooseImage("banner", e.target.files?.[0])} /></label></div></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-white/10 text-white"><X className="mr-2 size-4" />Cancel</Button><Button type="submit" disabled={saving || uploadingImage !== null} className="bg-violet-500 text-white">{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save changes</Button></div></form>
    </DialogShell>
  </HkTubeShell>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><p className="text-xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>; }

function DialogShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) { if (!open) return null; return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true"><button type="button" aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} /><div className="relative z-10 max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#141925] p-6 text-white shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">Edit channel profile</h2><p className="mt-1 text-xs text-slate-400">Update the identity viewers see on your HkTube channel.</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-white/10 text-slate-300 hover:bg-white/5" aria-label="Close"><X className="size-4" /></button></div>{children}</div></div>; }
