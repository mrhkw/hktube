import { useEffect, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { listPublicSupabaseVideos } from "@/lib/supabaseVideos";
import { Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SupabaseHome() {
  const [videos,setVideos]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  async function load(){setLoading(true);setError(null);try{setVideos(await listPublicSupabaseVideos(40));}catch(e){setError(e instanceof Error?e.message:"Could not load HkTube feed.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  return <HkTubeShell><main className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10"><section className="mb-7 rounded-[28px] border border-white/10 bg-[#101522] p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">HkTube</p><h1 className="mt-2 text-4xl font-black text-white sm:text-6xl">Watch what matters.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Real creator uploads, long videos and Shorts — served directly from the HkTube catalog.</p><div className="mt-6 flex gap-3"><Link href="/shorts" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">Watch Shorts</Link><Link href="/upload" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white">Upload</Link></div></section>{loading?<div className="grid min-h-[35vh] place-items-center"><Loader2 className="size-8 animate-spin text-violet-300"/></div>:error?<div className="rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center"><p className="text-white">{error}</p><Button onClick={()=>void load()} className="mt-4"><RefreshCw className="mr-2 size-4"/>Retry</Button></div>:videos.length?<div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{videos.map(v=><SupabaseVideoCard key={v.id} video={{id:String(v.id),title:v.title,thumbnailUrl:v.thumbnailUrl,durationSeconds:v.durationSeconds,views:v.viewCount,publishedAt:v.publishedAt}}/>)}</div>:<div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><UploadCloud className="mx-auto size-10 text-violet-300"/><h2 className="mt-4 text-xl font-bold text-white">No approved videos yet</h2><p className="mt-2 text-sm text-slate-500">Upload original content to start the catalog.</p></div>}</main></HkTubeShell>;
}
