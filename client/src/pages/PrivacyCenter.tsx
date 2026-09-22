import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, History, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

const controls = [
  ["privateAccount","Private account","Require approval before new people can follow you."],
  ["activityStatus","Activity status","Show when you are active to eligible social features."],
  ["profileViews","Profile view history","Remember profile visits on this device."],
  ["comments","Comments","Allow comments on your published videos by default."],
  ["mentions","Mentions","Allow other users to mention your account."],
  ["tags","Tags","Allow other users to tag your account."],
  ["dm","Direct messages","Allow eligible users to send you messages."],
  ["downloads","Video downloads","Allow downloads where a creator explicitly enables them."],
  ["embeds","External embeds","Allow your public videos to be embedded on other sites."],
  ["remix","Remix","Allow eligible creators to remix your videos."],
  ["duet","Duet","Allow eligible creators to use your videos in Duet-style creation."],
  ["stitch","Stitch","Allow eligible creators to use portions of your videos."],
  ["personalizedRecommendations","Personalized recommendations","Use your HkTube activity to personalize discovery."],
] as const;

export default function PrivacyCenter() {
  const [values,setValues]=useState<Record<string,boolean>>({});
  useEffect(()=>{ const next:Record<string,boolean>={}; controls.forEach(([key])=>next[key]=localStorage.getItem("hktube-privacy-"+key)!=="disabled"); setValues(next); },[]);
  const set=(key:string,value:boolean)=>{ setValues(v=>({...v,[key]:value})); localStorage.setItem("hktube-privacy-"+key,value?"enabled":"disabled"); };
  const clear=(prefix:string)=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k));
  return <HkTubeShell title="Privacy Center" subtitle="Control discovery, social visibility and device-level privacy preferences.">
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 sm:px-0">
      <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5"><div className="flex gap-3"><ShieldCheck className="size-6 shrink-0 text-cyan-200"/><div><h2 className="font-bold text-white">Privacy controls</h2><p className="mt-1 text-sm leading-6 text-slate-400">These preferences are stored on this device. Account-level enforcement must also be applied by the server before a setting can be treated as a security boundary.</p></div></div></section>
      <section className="space-y-2">{controls.map(([key,title,description])=><div key={key} className="flex min-h-16 items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[.025] p-4"><div><h2 className="text-sm font-bold text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{description}</p></div><Switch checked={values[key]??true} onCheckedChange={v=>set(key,v)} aria-label={title}/></div>)}</section>
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><div className="flex items-center gap-3"><History className="size-5 text-violet-200"/><div><h2 className="font-bold text-white">History controls</h2><p className="text-xs text-slate-400">Clear locally stored discovery history and privacy preferences from this browser.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" onClick={()=>clear("hktube-watch-")} className="border border-white/10 text-slate-200">Clear watch data</Button><Button variant="ghost" onClick={()=>clear("hktube-search-")} className="border border-white/10 text-slate-200">Clear search data</Button><Button variant="ghost" onClick={()=>{clear("hktube-privacy-"); location.reload();}} className="border border-white/10 text-slate-200"><RotateCcw className="mr-2 size-4"/>Reset privacy</Button></div></section>
    </div>
  </HkTubeShell>;
}
