import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listMySupabaseChannels, updateSupabaseChannel, type SupabaseChannel } from "@/lib/supabaseChannels";
import { listMySupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { Bookmark, CircleUserRound, Edit3, FileText, ImageOff, Loader2, MoreVertical, Play, Settings2, ShieldCheck, Share2, Trash2, X, MessageCircle, ListVideo, History, Bell, Eye } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type ProfileTab = "videos" | "clips" | "posts" | "favorites";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [channel, setChannel] = useState<SupabaseChannel | null>(null);
  const [videos, setVideos] = useState<SupabaseVideo[]>([]);
  const [favorites, setFavorites] = useState<SupabaseVideo[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("videos");

  async function loadProfile() {
    if (!user) return;
    setDataLoading(true);
    try {
      const [channels, ownVideos] = await Promise.all([listMySupabaseChannels(), listMySupabaseVideos(user.id)]);
      setChannel(channels[0] ?? null);
      setVideos(ownVideos);
      const { data: saves } = await supabase.from("saves").select("video_id,created_at").eq("user_id", user.id).not("video_id", "is", null).order("created_at", { ascending: false }).limit(100);
      const ids = (saves ?? []).map(row => String(row.video_id));
      if (ids.length) {
        const { data: savedRows } = await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,published_at,created_at,status,moderation_status").in("id", ids).eq("visibility", "public").eq("status", "published").eq("moderation_status", "approved");
        const byId = new Map((savedRows ?? []).map(row => [String(row.id), row]));
        setFavorites(ids.map(id => byId.get(id)).filter(Boolean).map(row => ({ id: String(row!.id), creatorId: String(row!.creator_id), channelId: String(row!.channel_id), title: String(row!.title), description: row!.description ?? null, videoUrl: row!.video_path ? supabase.storage.from("videos").getPublicUrl(row!.video_path).data.publicUrl : "", thumbnailUrl: row!.thumbnail_path ? supabase.storage.from("thumbnails").getPublicUrl(row!.thumbnail_path).data.publicUrl : null, durationSeconds: Number(row!.duration_seconds ?? 0), viewCount: Number(row!.views ?? 0), publishedAt: row!.published_at ?? null, createdAt: row!.created_at, status: row!.status, moderationStatus: row!.moderation_status })) as SupabaseVideo[]);
      } else setFavorites([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your profile.");
    } finally { setDataLoading(false); }
  }
  useEffect(() => { if (user) void loadProfile(); else setDataLoading(false); }, [user?.id]);
  useEffect(() => { if (channel) { setDisplayName(channel.displayName); setDescription(channel.description || ""); setBannerUrl(channel.bannerUrl || ""); } }, [channel?.id, channel?.displayName, channel?.description, channel?.bannerUrl]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    try { setSaving(true); setChannel(await updateSupabaseChannel(channel.id, { displayName: displayName.trim(), description: description.trim(), bannerUrl: bannerUrl.trim() || null })); setEditOpen(false); toast.success("Profile updated."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update profile."); }
    finally { setSaving(false); }
  }
  async function shareChannel() {
    const url = channel ? `${window.location.origin}/channel/${channel.handle}` : window.location.href;
    try { if (navigator.share) await navigator.share({ title: channel?.displayName || "HkTube profile", url }); else { await navigator.clipboard.writeText(url); toast.success("Profile link copied."); } } catch { /* cancelled */ }
  }
  function openMenu(href: string) { setMenuOpen(false); navigate(href); }

  const visibleVideos = tab === "clips" ? videos.filter(video => video.durationSeconds > 0 && video.durationSeconds <= 180) : tab === "videos" ? videos.filter(video => video.durationSeconds === 0 || video.durationSeconds > 180) : tab === "favorites" ? favorites : videos;

  if (loading) return <HkTubeShell minimalHeader headerAvatarUrl={channel?.avatarUrl || user?.avatarUrl}><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-400" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell minimalHeader headerAvatarUrl={channel?.avatarUrl || user?.avatarUrl}><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-400" /><h1 className="mt-4 text-2xl font-black text-white">Sign in to view your profile</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your channel, videos, favorites and settings live here.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-600 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;

  return <HkTubeShell minimalHeader headerAvatarUrl={channel?.avatarUrl || user?.avatarUrl}>
    <div className="mx-auto max-w-6xl px-3 py-3 pb-28 sm:px-6 sm:py-7">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111522] shadow-xl shadow-black/10">
        <div className="relative h-36 overflow-hidden bg-gradient-to-r from-violet-900 via-[#252b4b] to-fuchsia-900 sm:h-52">
          {channel?.bannerUrl ? <img src={channel.bannerUrl} alt="" className="size-full object-cover" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.65),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(217,70,239,.4),transparent_38%)]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111522]/80 to-transparent" />
          <div className="absolute right-3 top-3"><button type="button" aria-label="Open profile settings" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid size-11 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-xl hover:bg-black/65"><MoreVertical className="size-5" /></button>
            {menuOpen && <div className="absolute right-0 top-13 z-50 w-[min(340px,calc(100vw-28px))] overflow-hidden rounded-2xl border border-white/10 bg-[#080b12] p-2 text-white shadow-2xl">
              <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Account & app</p>
              <ProfileMenuItem icon={Settings2} title="Settings" description="Playback, notifications, language, theme and app controls" onClick={() => openMenu("/settings")} />
              <ProfileMenuItem icon={Bell} title="Notifications" description="Manage activity and creator notifications" onClick={() => openMenu("/notifications")} />
              <ProfileMenuItem icon={ShieldCheck} title="Privacy & safety" description="Privacy, blocking, family mode and safety" onClick={() => openMenu("/privacy")} />
              <ProfileMenuItem icon={Eye} title="Ads & privacy" description="Advertising consent and privacy choices" onClick={() => openMenu("/settings/ads")} />
              <ProfileMenuItem icon={History} title="History & old data" description="Watch history and saved activity" onClick={() => openMenu("/history")} />
              <ProfileMenuItem icon={MessageCircle} title="Contact" description="Support and platform requests" onClick={() => openMenu("/contact")} />
              <ProfileMenuItem icon={Trash2} title="Data & account" description="Account data and deletion" onClick={() => openMenu("/delete-account")} />
            </div>}
          </div>
        </div>
        <div className="px-4 pb-6 sm:px-8">
          <div className="relative -mt-10 flex flex-wrap items-end gap-4 sm:-mt-14">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-[#111522] bg-violet-600 text-3xl font-black text-white shadow-xl sm:size-32">{channel?.avatarUrl || user?.avatarUrl ? <img src={channel?.avatarUrl || user?.avatarUrl || ""} alt="" className="size-full object-cover" /> : (channel?.displayName || user.name || "H").slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1 pb-1"><h1 className="truncate text-2xl font-black text-white sm:text-3xl">{channel?.displayName || user.name || "HkTube Creator"}</h1><p className="mt-0.5 text-sm text-slate-400">@{channel?.handle || "creator"}</p><p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">{channel?.description || "Add a channel description to tell viewers what you create."}</p></div>
            <div className="flex gap-2 pb-1"><Button type="button" onClick={() => setEditOpen(true)} disabled={!channel} className="rounded-full bg-white px-4 font-bold text-black"><Edit3 className="mr-1.5 size-4" />Edit</Button><Button type="button" onClick={() => void shareChannel()} variant="outline" className="rounded-full border-white/10 bg-white/[.04] text-white"><Share2 className="mr-1.5 size-4" />Share</Button></div>
          </div>
          <div className="mt-5 grid max-w-xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[.03] py-3 text-center"><Metric label="Followers" value={channel?.subscriberCount.toLocaleString() || "0"} /><Metric label="Videos" value={String(videos.filter(v => !v.tags?.includes("shorts")).length)} /><Metric label="Clips" value={String(videos.filter(v => v.tags?.includes("shorts")).length)} /></div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-[#111522]">
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 pt-2 [scrollbar-width:none]">
          {([["videos", "Long Videos", Play], ["clips", "Clips", ClapperboardIcon], ["posts", "Posts", FileText], ["favorites", "Favorites", Bookmark]] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className={cnTab(tab === id)}><Icon className="size-4" />{label}</button>)}
        </div>
        <div className="p-4 sm:p-6">
          {dataLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="size-7 animate-spin text-violet-500" /></div> : tab === "posts" ? <EmptyState icon={FileText} title="Your posts" text="Published community posts will appear here." href="/posts" button="Open Posts" /> : tab === "favorites" && !favorites.length ? <EmptyState icon={Bookmark} title="No favorites yet" text="Use Save on a video or Short to keep it here." href="/library" button="Open Library" /> : visibleVideos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleVideos.map(video => <ProfileVideoCard key={video.id} video={video} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><ListVideo className="mx-auto size-8 text-slate-500" /><p className="mt-3 text-sm text-slate-500">No {tab === "clips" ? "clips" : tab === "favorites" ? "favorites" : "long videos"} yet.</p></div>}
        </div>
      </section>
    </div>

    {editOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true"><form onSubmit={saveProfile} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111522] p-5 text-white shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Edit channel</h2><button type="button" onClick={() => setEditOpen(false)} className="grid size-9 place-items-center rounded-full bg-white/[.06] text-slate-300" aria-label="Close"><X className="size-4" /></button></div><div className="mt-5 space-y-4"><div><label className="text-xs font-bold text-slate-300">Channel name</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={255} className="mt-1 border-white/10 bg-black/20 text-white" required /></div><div><label className="text-xs font-bold text-slate-300">Banner image URL</label><Input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://..." className="mt-1 border-white/10 bg-black/20 text-white" /></div><div><label className="text-xs font-bold text-slate-300">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} className="mt-1 border-white/10 bg-black/20 text-white" placeholder="Tell viewers about your channel" /></div></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-white/10 text-white">Cancel</Button><Button type="submit" disabled={saving} className="bg-violet-600 text-white">{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save changes</Button></div></form></div>}
  </HkTubeShell>;
}

function ProfileVideoCard({ video }: { video: SupabaseVideo }) { const approved = video.status === "published" && video.moderationStatus === "approved"; const card = <div className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.03]"><div className="relative aspect-video bg-slate-950">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-500"><ImageOff /></div>}{!approved && <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-black">Pending review</span>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views · {approved ? "Published" : "Not public yet"}</p></div></div>; return approved ? <Link href={`/watch/${video.id}`}>{card}</Link> : card; }
function ProfileMenuItem({ icon: Icon, title, description, onClick }: { icon: typeof Settings2; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-white/[.07]"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[.06] text-slate-200"><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span></span></button>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-lg font-black text-white">{value}</p><p className="mt-0.5 text-[11px] text-slate-500">{label}</p></div>; }
function EmptyState({ icon: Icon, title, text, href, button }: { icon: typeof Bookmark; title: string; text: string; href: string; button: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center"><Icon className="mx-auto size-8 text-violet-500" /><h2 className="mt-3 font-bold text-white">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p><Link href={href} className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-black">{button}</Link></div>; }
function ClapperboardIcon({ className }: { className?: string }) { return <Play className={className} />; }
function cnTab(active: boolean) { return `flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-3 text-xs font-bold transition ${active ? "border-b-2 border-violet-400 text-white" : "text-slate-500 hover:text-slate-200"}`; }
