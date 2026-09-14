import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { ShortsSwipeFeed } from "@/components/ShortsSwipeFeed";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function url(bucket:string,path:string|null){return path?(/^https?:\/\//i.test(path)?path:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl):null;}
export function SupabaseCollections({kind}:{kind:"shorts"|"trending"}){
  const { user } = useAuth();
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [mode,setMode]=useState<"for-you"|"following">("for-you");
  useEffect(()=>{let active=true;setLoading(true);const run=async()=>{try{
    let query=supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,likes_count,published_at,tags").eq("visibility","public").eq("status","published").eq("moderation_status","approved");
    if(kind==="shorts") query=query.contains("tags",["shorts"]).order("published_at",{ascending:false}).limit(40); else query=query.order("views",{ascending:false}).limit(40);
    let result=await query;
    if(kind==="shorts" && mode==="following" && user?.id){
      const subs=await supabase.from("subscriptions").select("channel_id").eq("subscriber_id",user.id);
      const ids=(subs.data??[]).map(x=>x.channel_id).filter(Boolean);
      result=ids.length?await supabase.from("videos").select("id,creator_id,channel_id,title,description,video_path,thumbnail_path,duration_seconds,views,likes_count,published_at,tags").eq("visibility","public").eq("status","published").eq("moderation_status","approved").contains("tags",["shorts"]).in("channel_id",ids).order("published_at",{ascending:false}).limit(40):{data:[],error:null} as any;
    }
    if(active)setItems(result.data??[]);
  }finally{if(active)setLoading(false);}};void run();return()=>{active=false;};},[kind,mode,user?.id]);
  return <HkTubeShell title={kind==="shorts"?"Shorts":"Trending"} immersive={kind==="shorts"}>
    <main className={kind==="shorts"?"w-full":"mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10"}>
      {kind==="shorts" ? <div className="px-2 pb-3 pt-2 sm:px-4"><div className="mx-auto flex max-w-[720px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[.04] p-1"><button type="button" onClick={()=>setMode("for-you")} className={`flex-1 rounded-full px-4 py-2 text-xs font-bold ${mode==="for-you"?"bg-white text-black":"text-slate-400"}`}>For You</button><button type="button" onClick={()=>setMode("following")} className={`flex-1 rounded-full px-4 py-2 text-xs font-bold ${mode==="following"?"bg-white text-black":"text-slate-400"}`}>Following</button></div></div> : <div className="mb-7 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">HkTube discovery</p><h1 className="mt-1 text-3xl font-black text-white">Trending now</h1></div><Link href="/upload?category=shorts" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black">Create</Link></div>}
      {loading?<div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-8 animate-spin"/></div>:items.length?(kind==="shorts"?<ShortsSwipeFeed items={items}/>:<div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map(v=><SupabaseVideoCard key={v.id} video={{id:String(v.id),title:v.title,thumbnailUrl:url("thumbnails",v.thumbnail_path),durationSeconds:v.duration_seconds,views:v.views,publishedAt:v.published_at,isShort:false}}/>)}</div>):<div className="mx-auto max-w-xl rounded-3xl border border-dashed border-white/10 p-12 text-center text-slate-500">{kind==="shorts"&&mode==="following"?"No Shorts from channels you follow yet.":"No approved content yet."}</div>}
    </main>
  </HkTubeShell>;
}
