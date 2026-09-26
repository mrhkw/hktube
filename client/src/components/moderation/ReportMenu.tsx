import { useState } from "react";
import { Flag, Loader2, MoreVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const reasons = [
  ["nudity_sexual","Nudity / Sexual Content"],
  ["religious_hate","Religious Hate / Blasphemy"],
  ["violence_unlawful","Violence / Unlawful Content"],
  ["spam_fake","Spam / Fake"],
  ["child_abuse","Child Safety"],
  ["copyright","Copyright"],
  ["other","Other"],
] as const;

export function ReportMenu({ videoId, className="" }: { videoId: string; className?: string }) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);

  async function report(reason:string){
    setBusy(true);
    try {
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){ toast.error("Sign in to report content."); return; }
      const {error}=await supabase.from("reports").insert({reporter_id:user.id,video_id:videoId,reason,details:null});
      if(error) throw error;
      toast.success("Report submitted for review.");
      setOpen(false);
    } catch(e) {
      toast.error(e instanceof Error ? e.message : "Report could not be submitted.");
    } finally { setBusy(false); }
  }

  return <div className={`relative ${className}`}>
    <button type="button" aria-label="Report video" onClick={()=>setOpen(v=>!v)} className="grid size-10 place-items-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md hover:bg-white/10">
      <MoreVertical className="size-5"/>
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-white/10 bg-[#111624] p-2 shadow-2xl">
      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Flag className="mr-1 inline size-3"/>Report</div>
      {reasons.map(([value,label])=><button key={value} disabled={busy} type="button" onClick={()=>void report(value)} className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50">{busy?<Loader2 className="mr-2 size-4 animate-spin"/>:null}{label}</button>)}
    </div>}
  </div>;
}
