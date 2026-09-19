import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

type Channel = { id:string; name:string; handle:string; verification_status:string };

export default function Verification() {
  const { user, isAuthenticated } = useAuth();
  const [channels,setChannels]=useState<Channel[]>([]);
  const [requests,setRequests]=useState<any[]>([]);
  const [channelId,setChannelId]=useState("");
  const [statement,setStatement]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    const [c,r]=await Promise.all([
      supabase.from("channels").select("id,name,handle,verification_status").eq("owner_id",user.id).order("created_at",{ascending:false}),
      supabase.from("verification_requests").select("id,channel_id,status,statement,reviewer_notes,created_at,reviewed_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20)
    ]);
    if(c.error) toast.error(c.error.message); else {setChannels(c.data??[]); if(!channelId && c.data?.[0]) setChannelId(c.data[0].id);}
    if(r.error) toast.error(r.error.message); else setRequests(r.data??[]);
    setLoading(false);
  }
  useEffect(()=>{if(isAuthenticated) void load(); else setLoading(false)},[isAuthenticated,user?.id]);

  async function apply() {
    if(!channelId || statement.trim().length<20){toast.error("Select a channel and write at least 20 characters explaining why it should be verified.");return;}
    setSaving(true);
    const {error}=await supabase.from("verification_requests").insert({user_id:user!.id,channel_id:channelId,statement:statement.trim(),status:"pending"});
    if(error) toast.error(error.message);
    else {await supabase.from("channels").update({verification_status:"pending"}).eq("id",channelId).eq("owner_id",user!.id); toast.success("Verification request submitted for review."); setStatement(""); await load();}
    setSaving(false);
  }

  if(!isAuthenticated) return <HkTubeShell title="Verification" subtitle="Creator identity and trust"><div className="mx-auto max-w-xl p-8 text-center"><ShieldCheck className="mx-auto size-10 text-violet-300"/><h1 className="mt-4 text-2xl font-black text-white">Sign in to apply</h1></div></HkTubeShell>;

  return <HkTubeShell title="Verification" subtitle="Creator identity and trust"><main className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-7">
    <section className="rounded-3xl border border-white/10 bg-white/[.03] p-6 sm:p-8">
      <div className="flex gap-4"><ShieldCheck className="size-8 shrink-0 text-violet-300"/><div><h1 className="text-2xl font-black text-white">Creator verification</h1><p className="mt-2 text-sm leading-6 text-slate-400">Submit a real request. Approval is decided by an authorized HkTube reviewer; the badge is never granted automatically.</p></div></div>
      {loading ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : <>
        <label className="mt-7 block text-sm font-semibold text-white">Channel<select value={channelId} onChange={e=>setChannelId(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white">{channels.map(c=><option key={c.id} value={c.id}>{c.name} · @{c.handle} · {c.verification_status}</option>)}</select></label>
        <label className="mt-5 block text-sm font-semibold text-white">Why should this channel be verified?<textarea value={statement} onChange={e=>setStatement(e.target.value)} maxLength={2000} rows={6} placeholder="Describe the public identity/organization this channel represents and provide useful context for review." className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-slate-600"/></label>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>20–2,000 characters</span><span>{statement.length}/2000</span></div>
        <Button onClick={()=>void apply()} disabled={saving||!channels.length} className="mt-5 min-h-11 bg-violet-500 hover:bg-violet-400">{saving?"Submitting…":"Submit verification request"}</Button>
      </>}
    </section>
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.025] p-6"><h2 className="font-black text-white">Request history</h2><div className="mt-4 space-y-3">{requests.length?requests.map(r=><div key={r.id} className="rounded-2xl border border-white/8 p-4"><div className="flex items-center gap-2">{r.status==="approved"?<CheckCircle2 className="size-4 text-emerald-300"/>:r.status==="rejected"?<XCircle className="size-4 text-rose-300"/>:<Clock3 className="size-4 text-amber-300"/>}<span className="text-sm font-bold text-white capitalize">{r.status}</span><span className="ml-auto text-xs text-slate-600">{new Date(r.created_at).toLocaleDateString()}</span></div><p className="mt-2 text-sm text-slate-400">{r.statement}</p>{r.reviewer_notes&&<p className="mt-2 rounded-xl bg-white/[.03] p-3 text-xs text-slate-500">Reviewer note: {r.reviewer_notes}</p>}</div>):<p className="py-5 text-sm text-slate-500">No verification requests yet.</p>}</div></section>
    <Link href="/studio" className="mt-5 inline-block text-sm font-bold text-violet-200">← Back to Creator Studio</Link>
  </main></HkTubeShell>;
}
