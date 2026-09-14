import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listMySupabaseChannels, updateSupabaseChannel, type SupabaseChannel } from "@/lib/supabaseChannels";
import { listMySupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { Link, useLocation } from "wouter";
import { Bookmark, CircleUserRound, Edit3, Eye, FileText, ImageOff, Loader2, Menu, MoreVertical, PenLine, Play, Settings2, Share2, ShieldCheck, Trash2, UsersRound, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, type ReactNode } from "react";

type ProfileTab = "videos" | "clips" | "posts" | "write" | "favorites";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [channel, setChannel] = useState<SupabaseChannel | null>(null);
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("videos");

  async function loadProfile() {
    if (!user) return;
    setDataLoading(true);
    try {
      const [channels, ownVideos] = await Promise.all([listMySupabaseChannels(), listMySupabaseVideos(user.openId?.replace(/^supabase:/, "") || "")]);
      setChannel(channels[0] ?? null); setVideos(ownVideos);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load your profile."); }
    finally { setDataLoading(false); }
  }
  useEffect(() => { if (user) void loadProfile(); else setDataLoading(false); }, [user?.openId]);
  useEffect(() => { if (channel) { setDisplayName(channel.displayName); setDescription(channel.description || ""); } }, [channel?.id, channel?.displayName, channel?.description]);

  if (loading) return <HkTubeShell title="Profile"><div className="grid min-h-[55vh] place-items-center"><CircleUserRound className="size-8 animate-pulse text-violet-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Profile"><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-200" /><h1 className="mt-4 text-2xl font-black text-white">Sign in to view your profile</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your profile, channel and published content are available after signing in.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-500 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); if (!channel) return;
    try { setSaving(true); setChannel(await updateSupabaseChannel(channel.id, { displayName: displayName.trim(), description: description.trim() })); setEditOpen(false); toast.success("Profile updated."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update channel profile."); }
    finally { setSaving(false); }
  }
  async function shareChannel() {
    const url = channel ? `${window.location.origin}/channel/${channel.handle}` : window.location.href;
    try { if (navigator.share) await navigator.share({ title: channel?.displayName || "HkTube profile", url }); else { await navigator.clipboard.writeText(url); toast.success("Profile link copied."); } }
    catch (error) { if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this profile."); }
  }
  function openMenuLink(href: string) { setMenuOpen(false); navigate(href); }
  function openCreate(kind: "video" | "clip" | "post" | "write") {
    if (kind === "video") navigate("/upload?category=regular");
    else if (kind === "clip") navigate("/upload?category=shorts");
    else if (kind === "post") navigate("/posts");
    else navigate("/posts");
  }

  const visibleVideos = tab === "clips" ? videos.filter(video => video.durationSeconds > 0 && video.durationSeconds <= 180) : tab === "videos" ? videos.filter(video => video.durationSeconds === 0 || video.durationSeconds > 180) : videos;
  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof Video }> = [{ id: "videos", label: "Long videos", icon: Video }, { id: "clips", label: "Clips", icon: Play }, { id: "posts", label: "Posts", icon: FileText }, { id: "write", label: "Write", icon: PenLine }, { id: "favorites", label: "Favorites", icon: Bookmark }];

  return <HkTubeShell title="Profile" subtitle="Your creator profile and published HkTube content.">
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 pb-28 sm:px-6 sm:py-7">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111624] shadow-xl shadow-black/10">
        <div className="relative h-32 bg-gradient-to-r from-violet-600/45 via-fuchsia-500/20 to-cyan-300/25 sm:h-48">{channel?.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover" />}<span className="absolute bottom-3 left-4 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white/80">Banner · 1500 × 500</span><button type="button" onClick={() => channel && navigate(`/channel/${channel.handle}`)} disabled={!channel} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65" aria-label="View public profile"><Eye className="size-5" /></button></div>
        <div className="px-4 pb-5 sm:px-7">
          <div className="-mt-11 flex items-end justify-between gap-3 sm:-mt-14"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#111624] bg-violet-500/40 text-3xl font-black text-white sm:size-28">{channel?.avatarUrl || user.avatarUrl ? <img src={channel?.avatarUrl || user.avatarUrl || ""} alt="" className="size-full object-cover" /> : (channel?.displayName || user.name || "H").slice(0, 1).toUpperCase()}</div><div className="relative mb-1"><button type="button" aria-label="Open profile menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid size-10 place-items-center rounded-full border border-white/10 bg-black/35 text-white hover:bg-white/10"><MoreVertical className="size-5" /></button>{menuOpen && <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#080b12] p-2 text-white shadow-2xl"><p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Profile menu</p><ProfileMenuItem icon={Settings2} title="Settings" description="App and account preferences" onClick={() => openMenuLink("/settings")} /><ProfileMenuItem icon={ShieldCheck} title="Privacy & safety" description="Privacy controls and policy" onClick={() => openMenuLink("/privacy")} /><ProfileMenuItem icon={Trash2} title="Data & account" description="Account data and deletion" onClick={() => openMenuLink("/delete-account")} /></div>}</div></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black text-white">{channel?.displayName || user.name || "HkTube Creator"}</h1><p className="mt-0.5 text-sm text-slate-400">@{channel?.handle || "creator"}</p></div><Button type="button" onClick={() => setEditOpen(true)} disabled={!channel} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950"><Edit3 className="mr-1.5 size-4" />Edit</Button><Button type="button" onClick={() => void shareChannel()} variant="outline" className="rounded-full border-white/15 px-4 text-white"><Share2 className="mr-1.5 size-4" />Share</Button></div>
          <div className="mt-4 grid max-w-md grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[.025] py-3 text-center"><Metric label="Following" value="0" /><Metric label="Followers" value={channel?.subscriberCount.toLocaleString() || "0"} /><Metric label="Likes" value="0" /></div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">{channel?.description || "Add a bio to tell viewers what your channel creates."}</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Logo · 512 × 512 · Banner · 1500 × 500</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4"><CreateAction icon={Video} label="Long video" tone="violet" onClick={() => openCreate("video")} /><CreateAction icon={Play} label="Clip" tone="fuchsia" onClick={() => openCreate("clip")} /><CreateAction icon={FileText} label="Post" tone="cyan" onClick={() => openCreate("post")} /><CreateAction icon={PenLine} label="Write" tone="emerald" onClick={() => openCreate("write")} /></section>

      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[.025]"><div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 pt-2 [scrollbar-width:none]">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 py-3 text-xs font-bold transition ${tab === item.id ? "border-b-2 border-violet-400 text-white" : "text-slate-500 hover:text-slate-200"}`}><Icon className="size-4" />{item.label}</button>; })}</div><div className="p-4 sm:p-6">{dataLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="size-7 animate-spin text-violet-300" /></div> : tab === "favorites" ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><Bookmark className="mx-auto size-8 text-violet-300" /><h2 className="mt-3 font-bold text-white">Your Favorites</h2><p className="mt-2 text-sm text-slate-500">Saved videos and clips will appear here.</p><Link href="/library" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950">Open Library</Link></div> : tab === "posts" || tab === "write" ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><FileText className="mx-auto size-8 text-cyan-300" /><h2 className="mt-3 font-bold text-white">{tab === "write" ? "Write a post" : "Published posts"}</h2><p className="mt-2 text-sm text-slate-500">Share an update with your HkTube audience.</p><Button onClick={() => navigate("/posts")} className="mt-4 rounded-full bg-violet-500 text-white">Open Posts</Button></div> : visibleVideos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleVideos.map(video => <Link key={video.id} href={`/watch/${video.id}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-black/15"><div className="aspect-[9/12] bg-white/[.04] sm:aspect-video">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-600"><ImageOff /></div>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views</p></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><Play className="mx-auto size-7 text-slate-600" /><p className="mt-3 text-sm text-slate-500">No {tab === "clips" ? "clips" : "long videos"} published yet.</p></div>}</div></section>
      {dataLoading && <p className="text-center text-xs text-slate-500">Loading your channel data…</p>}
    </div>
    <DialogShell open={editOpen} onClose={() => setEditOpen(false)}><form onSubmit={saveProfile} className="space-y-4"><div><label className="text-xs font-bold text-slate-300">Display name</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={255} className="mt-1 border-white/10 bg-black/20 text-white" required /></div><div><label className="text-xs font-bold text-slate-300">Bio</label><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} className="mt-1 border-white/10 bg-black/20 text-white" placeholder="Tell viewers about your channel" /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-white/10 text-white"><X className="mr-2 size-4" />Cancel</Button><Button type="submit" disabled={saving} className="bg-violet-500 text-white">{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save changes</Button></div></form></DialogShell>
  </HkTubeShell>;
}

function CreateAction({ icon: Icon, label, tone, onClick }: { icon: typeof Video; label: string; tone: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-2xl border border-${tone}-300/20 bg-${tone}-400/[.07] px-3 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-${tone}-400/[.14]`}><Icon className="size-4" />{label}</button>; }
function ProfileMenuItem({ icon: Icon, title, description, onClick }: { icon: typeof Settings2; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-white/[.07]"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[.06] text-slate-200"><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span></span></button>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-lg font-black text-white">{value}</p><p className="mt-0.5 text-[11px] text-slate-500">{label}</p></div>; }
function DialogShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) { if (!open) return null; return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true"><button type="button" aria-label="Close dialog" className="absolute inset-0" onClick={onClose} /><div className="relative z-10 max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#141925] p-6 text-white shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">Edit profile</h2><p className="mt-1 text-xs text-slate-400">Update your HkTube identity.</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-white/10 text-slate-300" aria-label="Close"><X className="size-4" /></button></div>{children}</div></div>; }
