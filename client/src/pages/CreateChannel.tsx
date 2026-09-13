import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { uploadProfileImage } from "@/lib/profileMedia";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function friendlyChannelError(message: string) {
  if (/taken|unique|duplicate/i.test(message)) return "That handle is already taken. Choose another handle.";
  if (/login|unauthorized|forbidden|session/i.test(message)) return "Your session expired. Sign in again, then retry.";
  return message || "Channel could not be created. Please try again.";
}

export default function CreateChannel() {
  const [, navigate] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  // Do not run protected channel queries against the temporary Supabase
  // fallback user (id=0). That fallback keeps the UI visible while the backend
  // profile sync recovers, but it cannot authorize protected tRPC procedures.
  const channels = trpc.channels.mine.useQuery(undefined, {
    enabled: Boolean(user?.id && user.id > 0),
    retry: 2,
    staleTime: 15_000,
  });
  const utils = trpc.useUtils();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  const updateChannel = trpc.channels.update.useMutation();
  const create = trpc.channels.create.useMutation({
    onSuccess: async (created) => {
      try {
        if (logoFile) {
          const uploaded = await uploadProfileImage(logoFile);
          await updateChannel.mutateAsync({
            id: created.id,
            displayName: created.displayName,
            description: created.description,
            avatarUrl: uploaded.url,
            bannerUrl: created.bannerUrl,
          });
        }
        await channels.refetch();
        await utils.channels.mine.invalidate();
        toast.success("Channel created successfully.");
        navigate("/profile");
      } catch (error) {
        toast.error(error instanceof Error ? `Channel created, but logo upload failed: ${error.message}` : "Channel created, but logo upload failed.");
        await utils.channels.mine.invalidate();
        navigate("/profile");
      }
    },
  });

  useEffect(() => {
    if (user?.name && !displayName) setDisplayName(user.name);
  }, [user?.name, displayName]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Channel logo must be 12 MB or smaller.");
      return;
    }
    setLogoFile(file);
  }

  async function submit() {
    const cleanName = displayName.trim();
    const cleanHandle = handle.trim().replace(/^@+/, "");
    const cleanDescription = description.trim();
    if (!cleanName || !cleanHandle || create.isPending) return;

    try {
      // Make sure a persisted mobile session is refreshed before the protected
      // mutation. This avoids sending an expired access token to the API.
      const current = await supabase.auth.getSession();
      if (!current.data.session) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.data.session) {
          toast.error("Your session expired. Please sign in again.");
          navigate("/auth");
          return;
        }
      }

      await create.mutateAsync({ handle: cleanHandle, displayName: cleanName, description: cleanDescription });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/login|unauthorized|forbidden|session/i.test(message)) {
        try {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data.session) {
            await create.mutateAsync({ handle: cleanHandle, displayName: cleanName, description: cleanDescription });
            return;
          }
        } catch {
          // Fall through to the normal friendly error below.
        }
        toast.error("Your session expired. Please sign in again.");
        navigate("/auth");
        return;
      }
      toast.error(`Channel create failed: ${friendlyChannelError(message)}`);
    }
  }

  if (loading) return <HkTubeShell><div className="mx-auto max-w-xl p-8 text-sm text-slate-500">Loading account…</div></HkTubeShell>;
  if (!user) return <HkTubeShell><div className="mx-auto max-w-xl p-8"><Link href="/" className="inline-flex items-center text-sm font-semibold"><ArrowLeft className="mr-1.5 size-4" />Back to Home</Link><div className="mt-8 rounded-3xl border p-8 text-center"><h1 className="text-2xl font-bold">{isAuthenticated ? "Session sync required" : "Sign in to create a channel"}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{isAuthenticated ? "Your browser session is present, but the secure profile service did not respond. Open auth again to refresh the session, then retry." : "Your channel must belong to an authenticated HkTube account."}</p><Link href="/auth" className="mt-6 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">{isAuthenticated ? "Refresh sign-in" : "Sign in / Sign up"}</Link></div></div></HkTubeShell>;

  return <HkTubeShell>
    <div className="mx-auto max-w-xl pb-12 pt-2">
      <Link href="/profile" className="inline-flex items-center text-sm font-semibold"><ArrowLeft className="mr-1.5 size-4" />Back to profile</Link>
      <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-black/50">CREATOR SETUP</p>
        <h1 className="mt-2 text-3xl font-bold">Create your channel</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Choose a unique handle and add your channel identity. You can change the logo later from Edit profile.</p>

        <form className="mt-7 space-y-5" onSubmit={e => { e.preventDefault(); void submit(); }}>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="flex items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-sm">
                {logoPreview ? <img src={logoPreview} alt="Channel logo preview" className="size-full object-cover" /> : <ImagePlus className="size-7 text-slate-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Channel logo</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">JPG, PNG, WebP, AVIF or GIF · up to 12 MB.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-full bg-black px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                    {logoFile ? "Change logo" : "Choose logo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={e => chooseLogo(e.target.files?.[0])} />
                  </label>
                  {logoFile && <button type="button" onClick={() => setLogoFile(null)} className="inline-flex items-center rounded-full border px-3 py-2 text-xs font-bold text-slate-700"><X className="mr-1 size-3.5" />Remove</button>}
                </div>
              </div>
            </div>
          </div>

          {channels.isError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><p className="font-semibold">We could not load your existing channels yet.</p><p className="mt-1">The secure session may need a refresh. Use the retry button, or sign in again if it continues.</p><button type="button" className="mt-3 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold" onClick={() => void channels.refetch()}>Retry channel check</button></div>}

          <label className="block"><span className="text-sm font-semibold">Channel name</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={255} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="Your public channel name" /></label>
          <label className="block"><span className="text-sm font-semibold">Handle</span><input value={handle} onChange={e => setHandle(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))} required minLength={3} maxLength={64} autoCapitalize="none" autoCorrect="off" className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="your_channel_handle" /><span className="mt-1 block text-xs text-slate-500">3–64 letters, numbers, or underscores.</span></label>
          <label className="block"><span className="text-sm font-semibold">Description</span><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="Tell viewers what your channel publishes." /></label>
          {create.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><strong>Channel create failed:</strong> {friendlyChannelError(create.error.message)}</div>}
          <button type="submit" disabled={create.isPending || updateChannel.isPending || !handle.trim() || handle.trim().length < 3 || !displayName.trim()} className="inline-flex items-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{create.isPending || updateChannel.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}{create.isPending || updateChannel.isPending ? "Creating channel…" : "Create channel"}</button>
        </form>
      </div>
      {channels.data && channels.data.length > 0 && <div className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">Your channels</h2><div className="mt-3 space-y-2">{channels.data.map(channel => <div key={channel.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><div><p className="font-semibold">{channel.displayName}</p><p className="text-xs text-slate-500">@{channel.handle}</p></div><span className="text-xs">{channel.verificationStatus}</span></div>)}</div></div>}
    </div>
  </HkTubeShell>;
}
