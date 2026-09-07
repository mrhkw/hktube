import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function friendlyChannelError(message: string) {
  if (/taken|unique|duplicate/i.test(message)) return "That handle is already taken. Choose another handle.";
  if (/login|unauthorized|forbidden|session/i.test(message)) return "Your session expired. Sign in again, then retry.";
  return message || "Channel could not be created. Please try again.";
}

export default function CreateChannel() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const channels = trpc.channels.mine.useQuery(undefined, { enabled: Boolean(user) });
  const utils = trpc.useUtils();
  const create = trpc.channels.create.useMutation({
    onSuccess: async () => {
      await channels.refetch();
      await utils.channels.mine.invalidate();
      navigate("/profile");
    },
  });
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (user?.name && !displayName) setDisplayName(user.name);
  }, [user?.name, displayName]);

  function submit() {
    const cleanName = displayName.trim();
    const cleanHandle = handle.trim().replace(/^@+/, "");
    const cleanDescription = description.trim();
    if (!cleanName || !cleanHandle) return;
    create.mutate({ handle: cleanHandle, displayName: cleanName, description: cleanDescription });
  }

  if (loading) return <HkTubeShell><div className="mx-auto max-w-xl p-8 text-sm text-slate-500">Loading account…</div></HkTubeShell>;
  if (!user) return <HkTubeShell><div className="mx-auto max-w-xl p-8"><Link href="/" className="inline-flex items-center text-sm font-semibold"><ArrowLeft className="mr-1.5 size-4" />Back to Home</Link><div className="mt-8 rounded-3xl border p-8 text-center"><h1 className="text-2xl font-bold">Sign in to create a channel</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your channel must belong to an authenticated HkTube account.</p><Link href="/auth" className="mt-6 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">Sign in / Sign up</Link></div></div></HkTubeShell>;

  return <HkTubeShell>
    <div className="mx-auto max-w-xl pb-12 pt-2">
      <Link href="/profile" className="inline-flex items-center text-sm font-semibold"><ArrowLeft className="mr-1.5 size-4" />Back to profile</Link>
      <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-black/50">CREATOR SETUP</p>
        <h1 className="mt-2 text-3xl font-bold">Create your channel</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Choose a unique handle. You can use letters, numbers and underscores.</p>
        {channels.isError && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><p className="font-semibold">Could not load your existing channels.</p><p className="mt-1">{channels.error.message || "Please retry before creating a channel."}</p><button type="button" className="mt-3 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-bold" onClick={() => void channels.refetch()}>Retry</button></div>}
        <form className="mt-7 space-y-5" onSubmit={e => { e.preventDefault(); submit(); }}>
          <label className="block"><span className="text-sm font-semibold">Channel name</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={255} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="Your public channel name" /></label>
          <label className="block"><span className="text-sm font-semibold">Handle</span><input value={handle} onChange={e => setHandle(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))} required minLength={3} maxLength={64} autoCapitalize="none" autoCorrect="off" className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="your_channel_handle" /><span className="mt-1 block text-xs text-slate-500">3–64 letters, numbers, or underscores.</span></label>
          <label className="block"><span className="text-sm font-semibold">Description</span><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-black" placeholder="Tell viewers what your channel publishes." /></label>
          {create.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><strong>Channel create failed:</strong> {friendlyChannelError(create.error.message)}</div>}
          <button type="submit" disabled={create.isPending || channels.isError || !handle.trim() || !displayName.trim()} className="inline-flex items-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}{create.isPending ? "Creating…" : "Create channel"}</button>
        </form>
      </div>
      {channels.data && channels.data.length > 0 && <div className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">Your channels</h2><div className="mt-3 space-y-2">{channels.data.map(channel => <div key={channel.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><div><p className="font-semibold">{channel.displayName}</p><p className="text-xs text-slate-500">@{channel.handle}</p></div><span className="text-xs">{channel.verificationStatus}</span></div>)}</div></div>}
    </div>
  </HkTubeShell>;
}
