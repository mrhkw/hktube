import { HkTubeShell } from "@/components/HkTubeShell";
import { supabase } from "@/lib/supabase";
import { BarChart3, Eye, Clock3, UsersRound, MousePointer2, PlayCircle, Radio, Search, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

type Video={id:string;title:string;views:number;likes_count:number;duration_seconds:number;published_at:string|null;category:string};
type Event={event_type:string;object_id:string;watch_seconds:number|null;created_at:string;context:any};

export default function CreatorAnalytics(){
 const {user}=useAuth(); const [videos,setVideos]=useState<Video[]>([]); const [events,setEvents]=useState<Event[]>([]); const [subs,setSubs]=useState(0); const [loading,setLoading]=useState(true); const [range,setRange]=useState(28);
 async function load(){
  if(!user) return; setLoading(true);
  const since=new Date(Date.now()-range*86400000).toISOString();
  const [{data:v},{data:e},{data:c}]=await Promise.all([
   supabase.from("videos").select("id,title,views,likes_count,duration_seconds,published_at,category").eq("creator_id",user.id).order("published_at",{ascending:false}),
   supabase.from("content_events").select("event_type,object_id,watch_seconds,created_at,context").eq("object_type","video").gte("created_at",since).order("created_at",{ascending:false}).limit(10000),
   supabase.from("channels").select("subscriber_count").eq("owner_id",user.id)
  ]);
  setVideos((v??[]) as Video[]); setEvents((e??[]) as Event[]); setSubs((c??[]).reduce((n,row)=>n+Number(row.subscriber_count||0),0)); setLoading(false);
 }
 useEffect(()=>{void load()},[user,range]);
 const metrics=useMemo(()=>{
  const views=videos.reduce((n,v)=>n+Number(v.views||0),0);
  const likes=videos.reduce((n,v)=>n+Number(v.likes_count||0),0);
  const watch=events.reduce((n,e)=>n+Number(e.watch_seconds||0),0);
  const starts=events.filter(e=>e.event_type==="play_start").length;
  const completed=events.filter(e=>e.event_type==="complete").length;
  const avg=starts?watch/starts:0;
  return {views,likes,watchHours:watch/3600,starts,completed,avg};
 },[videos,events]);
 const top=useMemo(()=>[...videos].sort((a,b)=>Number(b.views)-Number(a.views)).slice(0,10),[videos]);
 const traffic=useMemo(()=>{const m=new Map<string,number>(); for(const e of events){const key=String(e.context?.surface||e.context?.source||"Other");m.set(key,(m.get(key)||0)+1)} return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8)},[events]);
 return <HkTubeShell title="Creator Analytics" subtitle="Real performance reporting inspired by modern creator analytics, using HkTube's recorded events and content data.">
 <div className="mx-auto max-w-6xl space-y-5 px-4 pb-10 sm:px-0">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Analytics</p><h1 className="mt-1 text-2xl font-black text-white">Channel performance</h1></div><div className="flex gap-2"><select value={range} onChange={e=>setRange(Number(e.target.value))} className="rounded-xl border border-white/10 bg-[#151a25] px-3 py-2 text-sm font-semibold text-white"><option value={7}>Last 7 days</option><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option></select><button onClick={()=>void load()} className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-300"><RefreshCw className={loading?"size-4 animate-spin":"size-4"}/></button></div></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Eye} label="Views" value={metrics.views}/><Metric icon={Clock3} label="Watch hours" value={metrics.watchHours}/><Metric icon={UsersRound} label="Subscribers" value={subs}/><Metric icon={MousePointer2} label="Likes" value={metrics.likes}/></div>
  <div className="grid gap-5 lg:grid-cols-3"><section className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-bold text-white">Content performance</h2><p className="mt-1 text-xs text-slate-500">Views are taken from published video records. Event metrics cover the selected reporting window.</p><div className="mt-4 space-y-2">{top.map(v=><div key={v.id} className="flex items-center gap-3 rounded-2xl border border-white/8 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{v.title}</p><p className="text-xs text-slate-500">{v.category==="shorts"?"Short":"Video"} · {Number(v.likes_count||0).toLocaleString()} likes</p></div><span className="text-sm font-black text-cyan-200">{Number(v.views||0).toLocaleString()} views</span></div>)}{!top.length&&<Empty text="Publish content to populate analytics."/ >}</div></section>
  <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-bold text-white">Traffic & discovery</h2><p className="mt-1 text-xs text-slate-500">Recorded event surfaces, not invented estimates.</p><div className="mt-4 space-y-3">{traffic.map(([k,n])=><div key={k}><div className="flex justify-between text-xs"><span className="text-slate-300">{k}</span><span className="text-slate-500">{n}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-violet-400" style={{width:`${Math.min(100,(n/Math.max(1,traffic[0]?.[1] as number))*100)}%`}}/></div></div>)}{!traffic.length&&<Empty text="Traffic-source events will appear as viewers interact."/>}</div></section></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Mini icon={PlayCircle} label="Play starts" value={metrics.starts}/><Mini icon={Radio} label="Completed plays" value={metrics.completed}/><Mini icon={Clock3} label="Avg watch/start" value={`${Math.round(metrics.avg)}s`}/><Mini icon={Search} label="Published items" value={videos.length}/></div>
  <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5"><h2 className="font-bold text-white">Important metric rule</h2><p className="mt-1 text-sm leading-6 text-slate-400">HkTube does not fabricate impressions, CTR, unique viewers, revenue or demographics. Those metrics need actual impression, identity and monetization events. This dashboard exposes real data now and leaves unsupported metrics clearly absent instead of doing the usual startup trick of making up numbers.</p></section>
 </div></HkTubeShell>
}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><Icon className="size-5 text-cyan-300"/><p className="mt-3 text-2xl font-black text-white">{value>=1000?(value/1000).toFixed(1)+"K":value.toFixed(value%1?1:0)}</p><p className="text-xs text-slate-500">{label}</p></div>}
function Mini({icon:Icon,label,value}:{icon:any;label:string;value:number|string}){return <div className="rounded-2xl border border-white/10 p-4"><Icon className="size-4 text-violet-300"/><p className="mt-2 font-black text-white">{value}</p><p className="text-xs text-slate-500">{label}</p></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">{text}</div>}
