import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listMySupabaseChannels, updateSupabaseChannel, type SupabaseChannel } from "@/lib/supabaseChannels";
import { listMySupabaseVideos, type SupabaseVideo } from "@/lib/supabaseVideos";
import { Link, useLocation } from "wouter";
import { Bookmark, CircleUserRound, Edit3, Eye, FileText, ImageOff, Loader2, Mail, Menu, Play, Settings2, Share2, ShieldCheck, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

type ProfileTab = "videos" | "clips" | "posts" | "favorites";

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
      const id = user.openId?.replace(/^supabase:/, "") || "";
      const [channels, ownVideos] = await Promise.all([listMySupabaseChannels(), listMySupabaseVideos(id)]);
      setChannel(channels[0] ?? null);
      setVideos(ownVideos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your profile.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => { if (user) void loadProfile(); else setDataLoading(false); }, [user?.openId]);
  useEffect(() => {
    if (channel) {
      setDisplayName(channel.displayName);
      setDescription(channel.description || "");
    }
  }, [channel?.id, channel?.displayName, channel?.description]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!channel) return;
    try {
      setSaving(true);
      const updated = await updateSupabaseChannel(channel.id, { displayName: displayName.trim(), description: description.trim() });
      setChannel(updated);
      setEditOpen(false);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function shareChannel() {
    const url = channel ? `${window.location.origin}/channel/${channel.handle}` : window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: channel?.displayName || "HkTube profile", url });
      else { await navigator.clipboard.writeText(url); toast.success("Profile link copied."); }
    } catch (error) {
      if ((error as DOMException | undefined)?.name !== "AbortError") toast.error("Unable to share this profile.");
    }
  }

  function openMenu(href: string) { setMenuOpen(false); navigate(href); }

  const visibleVideos = tab === "clips"
    ? videos.filter(video => video.durationSeconds > 0 && video.durationSeconds <= 180)
    : tab === "videos"
      ? videos.filter(video => video.durationSeconds === 0 || video.durationSeconds > 180)
      : videos;

  if (loading) return <HkTubeShell title="Profile"><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-400" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Profile"><section className="mx-auto max-w-md px-5 pt-12 text-center"><CircleUserRound className="mx-auto size-12 text-violet-400" /><h1 className="mt-4 text-2xl font-black text-slate-900">Sign in to view your profile</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your profile, channel and published content are available after signing in.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-violet-600 px-7 font-bold text-white">Sign in / Sign up</Button></section></HkTubeShell>;

  return <HkTubeShell title="Profile">
    <div className="mx-auto max-w-5xl px-3 py-3 pb-28 sm:px-6 sm:py-7">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="relative h-28 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-cyan-50 sm:h-44">
          {channel?.bannerUrl && <img src={channel.bannerUrl} alt="" className="size-full object-cover" />}
          <button type="button" onClick={() => channel && navigate(`/channel/${channel.handle}`)} disabled={!channel} className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60" aria-label="View public profile"><Eye className="size-5" /></button>
        </div>
        <div className="px-4 pb-5 sm:px-7">
          <div className="relative -mt-10 flex items-end justify-between gap-3 sm:-mt-14">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-violet-600 text-2xl font-black text-white sm:size-28">
              {channel?.avatarUrl || user.avatarUrl ? <img src={channel?.avatarUrl || user.avatarUrl || ""} alt="" className="size-full object-cover" /> : (channel?.displayName || user.name || "H").slice(0, 1).toUpperCase()}
            </div>
            <button type="button" aria-label="Open profile settings menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50">
              <Menu className="size-5" />
            </button>
            {menuOpen && <div className="absolute right-0 top-14 z-50 w-[min(310px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/10 bg-[#080b12] p-2 text-white shadow-2xl">
              <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Profile settings</p>
              <ProfileMenuItem icon={Settings2} title="Settings" description="App and account preferences" onClick={() => openMenu("/settings")} />
              <ProfileMenuItem icon={Mail} title="Contact" description="Support, privacy and platform requests" onClick={() => openMenu("/contact")} />
              <ProfileMenuItem icon={ShieldCheck} title="Ads & privacy" description="Advertising and privacy choices" onClick={() => openMenu("/ad-settings")} />
              <ProfileMenuItem icon={ShieldCheck} title="Privacy & safety" description="Privacy controls and community safety" onClick={() => openMenu("/privacy")} />
              <ProfileMenuItem icon={FileText} title="History & old data" description="Review your activity and saved data" onClick={() => openMenu("/history")} />
              <ProfileMenuItem icon={Trash2} title="Data & account" description="Account data and deletion" onClick={() => openMenu("/delete-account")} />
            </div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1"><h1 className="truncate text-2xl font-black text-slate-900">{channel?.displayName || user.name || "HkTube Creator"}</h1><p className="mt-0.5 text-sm text-slate-500">@{channel?.handle || "creator"}</p></div>
            <Button type="button" onClick={() => setEditOpen(true)} disabled={!channel} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white"><Edit3 className="mr-1.5 size-4" />Edit profile</Button>
            <Button type="button" onClick={() => void shareChannel()} variant="outline" className="rounded-full border-slate-200 px-4 text-slate-800"><Share2 className="mr-1.5 size-4" />Share</Button>
          </div>
          <div className="mt-4 grid max-w-md grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-center"><Metric label="Following" value="0" /><Metric label="Followers" value={channel?.subscriberCount.toLocaleString() || "0"} /><Metric label="Likes" value="0" /></div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{channel?.description || "Add a bio to tell viewers what your channel creates."}</p>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 pt-2 [scrollbar-width:none]">
          {([ ["videos", "Videos", Video], ["clips", "Clips", Play], ["posts", "Posts", FileText], ["favorites", "Favorites", Bookmark] ] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 py-3 text-xs font-bold ${tab === id ? "border-b-2 border-violet-600 text-slate-900" : "text-slate-500"}`}><Icon className="size-4" />{label}</button>)}
        </div>
        <div className="p-4 sm:p-6">
          {dataLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="size-7 animate-spin text-violet-500" /></div>
            : tab === "favorites" ? <EmptyState icon={Bookmark} title="Your Favorites" text="Saved videos and clips will appear here." href="/library" button="Open Library" />
            : tab === "posts" ? <EmptyState icon={FileText} title="Published posts" text="Your community posts will appear here." href="/posts" button="Open Posts" />
            : visibleVideos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleVideos.map(video => <Link key={video.id} href={`/watch/${video.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="aspect-video bg-slate-100">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" loading="lazy" /> : <div className="grid size-full place-items-center text-slate-400"><ImageOff /></div>}</div><div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-slate-900">{video.title}</h3><p className="mt-1 text-xs text-slate-500">{video.viewCount.toLocaleString()} views</p></div></Link>)}</div>
            : <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center"><Play className="mx-auto size-7 text-slate-400" /><p className="mt-3 text-sm text-slate-500">No {tab === "clips" ? "clips" : "videos"} published yet.</p></div>}
        </div>
      </section>
    </div>

    {editOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Edit profile">
      <form onSubmit={saveProfile} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">Edit profile</h2><button type="button" onClick={() => setEditOpen(false)} className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-700" aria-label="Close"><X className="size-4" /></button></div>
        <div className="mt-5 space-y-4"><div><label className="text-xs font-bold text-slate-700">Display name</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={255} className="mt-1 border-slate-200 bg-white text-slate-900" required /></div><div><label className="text-xs font-bold text-slate-700">Bio</label><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} className="mt-1 border-slate-200 bg-white text-slate-900" placeholder="Tell viewers about your channel" /></div></div>
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="border-slate-200">Cancel</Button><Button type="submit" disabled={saving} className="bg-violet-600 text-white">{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save changes</Button></div>
      </form>
    </div>}
  </HkTubeShell>;
}

function ProfileMenuItem({ icon: Icon, title, description, onClick }: { icon: typeof Settings2; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-white/[.07]"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[.06] text-slate-200"><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-sm font-bold text-white">{title}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span></span></button>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-lg font-black text-slate-900">{value}</p><p className="mt-0.5 text-[11px] text-slate-500">{label}</p></div>; }
function EmptyState({ icon: Icon, title, text, href, button }: { icon: typeof Bookmark; title: string; text: string; href: string; button: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center"><Icon className="mx-auto size-8 text-violet-500" /><h2 className="mt-3 font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p><Link href={href} className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">{button}</Link></div>; }
