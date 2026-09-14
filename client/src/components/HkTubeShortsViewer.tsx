import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Bookmark, ChevronDown, Heart, MessageCircle, MoreVertical, Play, Share2, UserRound, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { recordVideoView, toggleChannelSubscription, toggleVideoLike, toggleVideoSave } from "@/lib/supabaseEngagement";
import { toast } from "sonner";

type Item = { id:string; title:string; description:string|null; video_path:string|null; thumbnail_path:string|null; views:number; likes_count:number; channel_id:string|null; tags:string[]|null };
type Channel = { id:string; handle:string; name:string; avatar_url:string|null; subscriber_count:number };
const media=(bucket:string,path:string|null)=>path?( /^https?:\/\//i.test(path)?path:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl):null;

export function HkTubeShortsViewer({ items, mode, onModeChange }:{items:Item[];mode:"for-you"|"following";onModeChange:(m:"for-you"|"following")=>void}){
  const { user }=useAuth();
  // Mobile browsers block autoplay with sound. Shorts therefore start muted, just like YouTube/TikTok.
  const [muted,setMuted]=useState(true); const [paused,setPaused]=useState(false);
  const [liked,setLiked]=useState<Record<string,boolean>>({}); const [saved,setSaved]=useState<Record<string,boolean>>({});
  const [counts,setCounts]=useState<Record<string,number>>(()=>Object.fromEntries(items.map(x=>[x.id,Number(x.likes_count||0)])));
  const [channels,setChannels]=useState<Record<string,Channel>>({}); const [following,setFollowing]=useState<Record<string,boolean>>({});
  const [ready,setReady]=useState<Record<string,boolean>>({}); const [mediaError,setMediaError]=useState<Record<string,boolean>>({});
  const refs=useRef<Record<string,HTMLVideoElement|null>>({}); const viewed=useRef<Set<string>>(new Set());

  useEffect(()=>{const ids=[...new Set(items.map(x=>x.channel_id).filter(Boolean))] as string[]; if(!ids.length)return; let dead=false; void supabase.from("channels").select("id,handle,name,avatar_url,subscriber_count").in("id",ids).then(({data})=>{if(!dead)setChannels(Object.fromEntries((data??[]).map(x=>[String(x.id),x as Channel])))}); return()=>{dead=true}},[items]);
  useEffect(()=>{if(!user)return; const ids=[...new Set(items.map(x=>x.channel_id).filter(Boolean))] as string[]; if(!ids.length)return; let dead=false; void supabase.from("subscriptions").select("channel_id").eq("subscriber_id",user.id).in("channel_id",ids).then(({data})=>{if(!dead)setFollowing(Object.fromEntries((data??[]).map(x=>[String(x.channel_id),true])))}); return()=>{dead=true}},[items,user?.id]);

  useEffect(()=>{
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      const id=(entry.target as HTMLElement).dataset.shortId; const video=refs.current[id||""]; if(!video)return;
      if(entry.isIntersecting&&entry.intersectionRatio>.65){
        video.muted=muted;
        video.currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        void video.play().then(()=>setPaused(false)).catch(()=>setPaused(true));
        if(id&&!viewed.current.has(id)){viewed.current.add(id); void recordVideoView(id).catch(()=>undefined)}
      } else { video.pause(); }
    }),{threshold:[.2,.65,.9]});
    Object.entries(refs.current).forEach(([id])=>{const el=document.querySelector(`[data-short-id="${id}"]`);if(el)observer.observe(el)});
    return()=>observer.disconnect();
  },[items,muted]);

  async function like(id:string){if(!user)return startLogin();try{const r=await toggleVideoLike(id);setLiked(s=>({...s,[id]:r.liked}));setCounts(s=>({...s,[id]:Number(r.count)}))}catch(e){toast.error(e instanceof Error?e.message:"Unable to like this Short.")}}
  async function save(id:string){if(!user)return startLogin();try{const r=await toggleVideoSave(id);setSaved(s=>({...s,[id]:r}));toast.success(r?"Saved to Library":"Removed from Library")}catch(e){toast.error(e instanceof Error?e.message:"Unable to save this Short.")}}
  async function follow(channelId:string){if(!user)return startLogin();try{const r=await toggleChannelSubscription(channelId);setFollowing(s=>({...s,[channelId]:r.subscribed}));setChannels(s=>({...s,[channelId]:s[channelId]?{...s[channelId],subscriber_count:Number(r.count)}:s[channelId]}));toast.success(r.subscribed?"Following creator":"Unfollowed creator")}catch(e){toast.error(e instanceof Error?e.message:"Unable to update follow.")}}
  async function share(item:Item){const url=`${window.location.origin}/watch/${item.id}`;try{if(navigator.share)await navigator.share({title:item.title,url});else{await navigator.clipboard.writeText(url);toast.success("Short link copied")}}catch{}}
  function togglePlay(id:string){const v=refs.current[id];if(!v)return;if(v.paused){void v.play().then(()=>setPaused(false)).catch(()=>setPaused(true))}else{v.pause();setPaused(true)}}

  return <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
    <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-5"><Link href="/" className="grid size-10 place-items-center rounded-full bg-black/50 backdrop-blur" aria-label="Close Shorts"><ArrowLeft className="size-5"/></Link><div className="flex rounded-full bg-black/50 p-1 text-xs font-bold backdrop-blur"><button onClick={()=>onModeChange("for-you")} className={`rounded-full px-4 py-2 ${mode==="for-you"?"bg-white text-black":"text-white"}`}>For You</button><button onClick={()=>onModeChange("following")} className={`rounded-full px-4 py-2 ${mode==="following"?"bg-white text-black":"text-white"}`}>Following</button></div><button className="grid size-10 place-items-center rounded-full bg-black/50 backdrop-blur" aria-label="More options"><MoreVertical className="size-5"/></button></div>
    <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none]">
      {items.map((item,index)=>{const video=media("videos",item.video_path);const thumb=media("thumbnails",item.thumbnail_path);const channel=item.channel_id?channels[item.channel_id]:undefined;const hasReady=ready[item.id];const failed=mediaError[item.id];return <section key={item.id} data-short-id={item.id} className="relative flex h-[100dvh] snap-start items-center justify-center overflow-hidden bg-black">
        {thumb?<img src={thumb} alt="" aria-hidden="true" className={`absolute inset-0 h-full w-full object-contain ${hasReady?"opacity-0":"opacity-100"}`} />:null}
        {video?<video
          ref={el=>{refs.current[item.id]=el}}
          src={video}
          poster={thumb||undefined}
          playsInline
          autoPlay={index===0}
          muted={muted}
          defaultMuted
          loop
          preload="auto"
          controls={false}
          className="relative z-10 h-full w-full object-contain sm:max-w-[620px]"
          onLoadedMetadata={e=>{const el=e.currentTarget;setReady(s=>({...s,[item.id]:el.videoWidth>0&&el.videoHeight>0}));setMediaError(s=>({...s,[item.id]:false}));if(el.videoWidth>0&&el.videoHeight>0&&index===0){el.muted=true;void el.play().catch(()=>undefined)}}}
          onCanPlay={e=>{const el=e.currentTarget;setReady(s=>({...s,[item.id]:el.videoWidth>0&&el.videoHeight>0}));if(index===0){el.muted=muted;void el.play().then(()=>setPaused(false)).catch(()=>setPaused(true))}}}
          onError={()=>setMediaError(s=>({...s,[item.id]:true}))}
          onClick={()=>togglePlay(item.id)}
          onDoubleClick={()=>void like(item.id)}
        />:null}
        {!video&&<div className="absolute inset-0 grid place-items-center text-sm text-white/60">Video unavailable</div>}
        {failed&&<div className="absolute left-1/2 top-1/2 z-20 w-[min(86vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/75 p-4 text-center backdrop-blur"><p className="text-sm font-bold">This video cannot be played here</p><p className="mt-1 text-xs text-white/65">Please upload an MP4/H.264 video. The original file is still saved, but this browser cannot decode its video track.</p></div>}
        {!hasReady&&!failed&&video&&<div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur">Loading…</div>}
        <div className="pointer-events-none absolute inset-0 z-15 bg-gradient-to-t from-black/80 via-transparent to-black/20"/>
        <div className="absolute left-3 right-20 bottom-[max(20px,env(safe-area-inset-bottom))] z-20 max-w-[620px] sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-[620px] sm:pr-16"><div className="flex items-center gap-2"><Link href={channel?`/channel/${channel.handle}`:`/watch/${item.id}`} className="pointer-events-auto flex min-w-0 items-center gap-2 font-bold"><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/30 bg-white/15">{channel?.avatar_url?<img src={channel.avatar_url} alt="" className="size-full object-cover"/>:<UserRound className="size-4"/>}</span><span className="truncate">@{channel?.handle||"hktube"}</span></Link>{channel&&<button type="button" onClick={()=>void follow(channel.id)} className={`pointer-events-auto rounded-full px-3 py-1.5 text-[11px] font-black ${following[channel.id]?"bg-white/15 text-white":"bg-white text-black"}`}>{following[channel.id]?"Following":"Follow"}</button>}</div><h2 className="mt-2 line-clamp-2 text-base font-bold leading-6">{item.title}</h2>{item.description?<p className="mt-1 line-clamp-2 text-sm text-white/80">{item.description}</p>:null}</div>
        <div className="absolute right-2 bottom-[max(26px,env(safe-area-inset-bottom))] z-20 flex flex-col items-center gap-3 sm:right-[calc(50%-300px)]"><Action icon={liked[item.id]?<Heart className="size-6 fill-current"/>:<Heart className="size-6"/>} label={String(counts[item.id]||0)} onClick={()=>void like(item.id)}/><Action icon={<MessageCircle className="size-6"/>} label="Comment" href={`/watch/${item.id}#comments`}/><Action icon={saved[item.id]?<Bookmark className="size-6 fill-current"/>:<Bookmark className="size-6"/>} label="Save" onClick={()=>void save(item.id)}/><Action icon={<Share2 className="size-6"/>} label="Share" onClick={()=>void share(item)}/><Action icon={muted?<VolumeX className="size-6"/>:<Volume2 className="size-6"/>} label={muted?"Unmute":"Mute"} onClick={()=>{setMuted(x=>!x);Object.values(refs.current).forEach(v=>{if(v)v.muted=!v.muted})}}/></div>
        {paused&&<button onClick={()=>togglePlay(item.id)} className="absolute left-1/2 top-1/2 z-30 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 backdrop-blur" aria-label="Play"><Play className="ml-1 size-8 fill-current"/></button>}
      </section>})}
    </div>
    {items.length>1?<div className="pointer-events-none absolute bottom-3 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-1 text-[10px] font-bold text-white/50 sm:flex"><ChevronDown className="size-4 animate-bounce"/>Swipe for next</div>:null}
  </div>
}
function Action({icon,label,onClick,href}:{icon:ReactNode;label:string;onClick?:()=>void;href?:string}){const body=<span className="pointer-events-auto flex flex-col items-center gap-1"><button type="button" onClick={onClick} className="grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur transition active:scale-90 hover:bg-white/15">{icon}</button><span className="max-w-14 truncate text-[10px] font-semibold text-white/90">{label}</span></span>;return href?<Link href={href}>{body}</Link>:body}
