import { useEffect, useState, type ChangeEvent } from "react";
import {
  ArrowLeft, ChevronRight, Crop, Eye, FileVideo2, ImagePlus, RotateCw,
  Save, Settings2, ShieldCheck, Sparkles, UploadCloud, Users, Video, X
} from "lucide-react";
import { useLocation } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import VideoUploadEditor from "@/components/VideoUploadEditor";
import { useAuth } from "@/_core/hooks/useAuth";
import { listMySupabaseChannels, type SupabaseChannel } from "@/lib/supabaseChannels";
import { createSupabaseVideo } from "@/lib/supabaseVideos";
import { supabase } from "@/lib/supabase";
import { sanitizeInput } from "@shared/security";
import { startLogin } from "@/const";
import { toast } from "sonner";

type Mode = "choose" | "video" | "clip" | "post" | "story";
type Visibility = "public" | "unlisted" | "private";
type Media = { file: File; url: string; kind: "image" | "video" };

const DRAFT_KEY = "hktube-upload-center-v4";
const MAX_VIDEO = 900 * 1024 * 1024;
const MAX_IMAGE = 20 * 1024 * 1024;
const ACCEPT_VIDEO = new Set(["video/mp4", "video/webm"]);
const ACCEPT_IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

function bytes(n:number){const u=["B","KB","MB","GB"];const i=Math.min(Math.floor(Math.log(Math.max(n,1))/Math.log(1024)),3);return `${(n/1024**i).toFixed(i?1:0)} ${u[i]}`}
function cleanTags(v:string){return Array.from(new Set(v.split(/[,#\s]+/).map(x=>sanitizeInput(x).trim().toLowerCase()).filter(Boolean))).slice(0,30)}
function videoMeta(file:File){return new Promise<{width:number;height:number;duration:number}>((resolve,reject)=>{const v=document.createElement("video"),u=URL.createObjectURL(file);const t=window.setTimeout(()=>{URL.revokeObjectURL(u);reject(new Error("Video metadata could not be read."))},12000);v.preload="metadata";v.onloadedmetadata=()=>{window.clearTimeout(t);const x={width:v.videoWidth,height:v.videoHeight,duration:Number.isFinite(v.duration)?v.duration:0};URL.revokeObjectURL(u);resolve(x)};v.onerror=()=>{window.clearTimeout(t);URL.revokeObjectURL(u);reject(new Error("This video cannot be decoded by the browser."))};v.src=u})}
function makeThumb(file:File){return new Promise<File|null>(resolve=>{const v=document.createElement("video"),c=document.createElement("canvas"),u=URL.createObjectURL(file);const done=(f:File|null)=>{URL.revokeObjectURL(u);resolve(f)};v.muted=true;v.preload="auto";v.onloadedmetadata=()=>{v.currentTime=Math.min(Math.max(v.duration*.12,.1),Math.max(v.duration-.1,.1))};v.onseeked=()=>{const w=Math.min(v.videoWidth||1280,1280);c.width=w;c.height=Math.max(1,Math.round(w*(v.videoHeight||720)/(v.videoWidth||720)));const ctx=c.getContext("2d");if(!ctx)return done(null);ctx.drawImage(v,0,0,c.width,c.height);c.toBlob(b=>done(b?new File([b],"thumbnail.jpg",{type:"image/jpeg"}):null),"image/jpeg",.86)};v.onerror=()=>done(null);v.src=u})}
async function uploadMedia(bucket:string,userId:string,file:File){const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";const path=`${userId}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false,cacheControl:"31536000"});if(error)throw new Error(error.message);return path}
function publicMedia(bucket:string,path:string){return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl}

export default function UploadPage(){
 const {isAuthenticated,loading:authLoading}=useAuth(); const [,navigate]=useLocation();
 const [mode,setMode]=useState<Mode>("choose"); const [channels,setChannels]=useState<SupabaseChannel[]>([]);
 const [channelId,setChannelId]=useState(""); const [media,setMedia]=useState<Media[]>([]);
 const [thumbnail,setThumbnail]=useState<File|null>(null); const [thumbnailUrl,setThumbnailUrl]=useState("");
 const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [tags,setTags]=useState("");
 const [category,setCategory]=useState("Entertainment"); const [language,setLanguage]=useState("English");
 const [visibility,setVisibility]=useState<Visibility>("public"); const [schedule,setSchedule]=useState("");
 const [comments,setComments]=useState(true); const [downloads,setDownloads]=useState(false);
 const [kids,setKids]=useState(false); const [embed,setEmbed]=useState(true); const [remix,setRemix]=useState(true);
 const [notify,setNotify]=useState(true); const [caption,setCaption]=useState(true); const [location,setLocation]=useState("");
 const [allowReplies,setAllowReplies]=useState(true); const [storyAudience,setStoryAudience]=useState<"followers"|"public"|"private">("followers");
 const [postBackground,setPostBackground]=useState("plain"); const [postSticker,setPostSticker]=useState("");
 const [crop,setCrop]=useState("fit"); const [rotation,setRotation]=useState(0); const [altText,setAltText]=useState("");
 const [advanced,setAdvanced]=useState(false); const [saving,setSaving]=useState(false); const [progress,setProgress]=useState(0);

 useEffect(()=>{if(!authLoading&&!isAuthenticated){startLogin();return} if(isAuthenticated)void listMySupabaseChannels().then(v=>{setChannels(v);setChannelId(v[0]?.id||"")}).catch(e=>toast.error(e instanceof Error?e.message:"Channels could not load"))},[isAuthenticated,authLoading]);
 useEffect(()=>{if(!thumbnail){setThumbnailUrl("");return}const u=URL.createObjectURL(thumbnail);setThumbnailUrl(u);return()=>URL.revokeObjectURL(u)},[thumbnail]);
 useEffect(()=>{try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");if(!d)return;setTitle(typeof d.title==="string"?d.title:"");setDescription(typeof d.description==="string"?d.description:"");setTags(typeof d.tags==="string"?d.tags:"");setCategory(typeof d.category==="string"?d.category:"Entertainment");setLanguage(typeof d.language==="string"?d.language:"English");}catch{localStorage.removeItem(DRAFT_KEY)}},[]);
 useEffect(()=>{localStorage.setItem(DRAFT_KEY,JSON.stringify({title,description,tags,category,language}))},[title,description,tags,category,language]);

 const selected=channels.find(c=>c.id===channelId); const primary=media[0]; const isVideo=mode==="video"||mode==="clip";
 const canPublish=Boolean(channelId&&!saving&&(mode==="post"||mode==="story"?media.length>0||description.trim():primary&&title.trim()));

 function chooseFiles(e:ChangeEvent<HTMLInputElement>){
   const files=Array.from(e.target.files||[]); if(!files.length)return;
   if(mode==="post"||mode==="story"){
     const accepted=files.filter(f=>ACCEPT_IMAGE.has(f.type)||f.type.startsWith("video/")).slice(0,10);
     if(!accepted.length)return toast.error("Choose an image or video.");
     const next=accepted.map(file=>({file,url:URL.createObjectURL(file),kind:file.type.startsWith("video/")?"video":"image"} as Media));
     setMedia(next);
     return;
   }
   const file=files[0]; if(!ACCEPT_VIDEO.has(file.type))return toast.error("Use MP4/H.264 or WebM.");
   if(file.size>MAX_VIDEO)return toast.error(`Video must be 900 MB or smaller. This file is ${bytes(file.size)}.`);
   void videoMeta(file).then(async info=>{
     if(mode==="clip"&&info.duration>180)throw new Error("Clips can be up to 180 seconds. Trim the video in the editor.");
     
     const url=URL.createObjectURL(file);setMedia([{file,url,kind:"video"}]);
     const t=await makeThumb(file);if(t)setThumbnail(t);
     if(!title)setTitle(file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").slice(0,180));
   }).catch(e=>toast.error(e instanceof Error?e.message:"Video could not be inspected"));
 }
 function clearMedia(){media.forEach(m=>URL.revokeObjectURL(m.url));setMedia([]);setThumbnail(null)}
 function back(){if(mode==="choose")navigate("/");else setMode("choose")}
 function saveDraft(){localStorage.setItem(DRAFT_KEY,JSON.stringify({title,description,tags,category,language,mode}));toast.success("Draft saved locally.");}
 function addSticker(s:string){setPostSticker(s);toast.success(`${s} sticker added`)}
 async function publishVideo(){
   if(!primary||!channelId)return; setSaving(true);setProgress(0);
   try{await createSupabaseVideo({channelId,title:title.trim(),description:description.trim(),file:primary.file,thumbnail,isShort:mode==="clip",durationSeconds:Math.floor((await videoMeta(primary.file)).duration),category:mode==="clip"?"clips":category,language,visibility,allowComments:comments,madeForKids:kids,tags:cleanTags(tags),allowDownload:downloads,onProgress:setProgress});localStorage.removeItem(DRAFT_KEY);toast.success(mode==="clip"?"Clip published":"Video published");navigate(mode==="clip"?"/clips":"/")}
   catch(e){toast.error(e instanceof Error?e.message:"Upload failed.")}finally{setSaving(false)}
 }
 async function publishPost(){
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Please sign in again.");
   const paths:string[]=[];
   try{for(const m of media){paths.push(await uploadMedia("stories",user.id,m.file))}
   }catch(e){throw e}
   const {error}=await supabase.from("posts").insert({creator_id:user.id,content:sanitizeInput(description).slice(0,10000),media_path:paths[0]||null,media_paths:paths,visibility,status:"published",moderation_status:"approved"});
   if(error){await supabase.storage.from("stories").remove(paths);throw new Error(error.message)}
 }
 async function publishStory(){
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Please sign in again.");
   const m=primary;if(!m&&!description.trim())throw new Error("Add a photo, video, or story text.");
   let path:string|null=null;try{if(m)path=await uploadMedia("stories",user.id,m.file);const {error}=await supabase.from("stories").insert({user_id:user.id,media_path:path,text_content:sanitizeInput(description).slice(0,3000),media_type:m?.kind||"text",visibility:storyAudience,reply_allowed:allowReplies,music_name:postSticker||null});if(error)throw new Error(error.message)}catch(e){if(path)await supabase.storage.from("stories").remove([path]);throw e}
 }
 async function publish(){
   if(!canPublish)return;setSaving(true);setProgress(0);
   try{if(isVideo)await publishVideo();else if(mode==="post")await publishPost();else await publishStory();localStorage.removeItem(DRAFT_KEY);if(mode==="post")toast.success("Post published");if(mode==="story")toast.success("Story shared");if(mode==="post"||mode==="story")navigate("/")}catch(e){toast.error(e instanceof Error?e.message:"Publish failed")}finally{setSaving(false)}
 }
 if(authLoading)return <HkTubeShell title="Upload Center"><div className="grid min-h-[50vh] place-items-center text-slate-400">Loading secure creator studio…</div></HkTubeShell>;

 return <HkTubeShell title="Upload Center" subtitle="One creator flow for Long Video, Clips, Posts and Stories.">
  <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-10">
   {mode==="choose"?<Choose onPick={setMode} onDraft={saveDraft}/>:<Editor mode={mode} back={back} title={title} setTitle={setTitle} description={description} setDescription={setDescription} tags={tags} setTags={setTags} category={category} setCategory={setCategory} language={language} setLanguage={setLanguage} visibility={visibility} setVisibility={setVisibility} schedule={schedule} setSchedule={setSchedule} comments={comments} setComments={setComments} downloads={downloads} setDownloads={setDownloads} kids={kids} setKids={setKids} embed={embed} setEmbed={setEmbed} remix={remix} setRemix={setRemix} notify={notify} setNotify={setNotify} caption={caption} setCaption={setCaption} location={location} setLocation={setLocation} allowReplies={allowReplies} setAllowReplies={setAllowReplies} storyAudience={storyAudience} setStoryAudience={setStoryAudience} postBackground={postBackground} setPostBackground={setPostBackground} postSticker={postSticker} setPostSticker={setPostSticker} crop={crop} setCrop={setCrop} rotation={rotation} setRotation={setRotation} altText={altText} setAltText={setAltText} advanced={advanced} setAdvanced={setAdvanced} media={media} setMedia={setMedia} thumbnail={thumbnail} thumbnailUrl={thumbnailUrl} setThumbnail={setThumbnail} chooseFiles={chooseFiles} clearMedia={clearMedia} channelId={channelId} setChannelId={setChannelId} channels={channels} selected={selected} saving={saving} progress={progress} publish={publish} saveDraft={saveDraft} addSticker={addSticker} navigate={navigate}/>}
  </main>
 </HkTubeShell>
}

function Choose({onPick,onDraft}:{onPick:(m:Mode)=>void;onDraft:()=>void}){
 const cards:[Mode,string,string,string,React.ReactNode][]=[
  ["video","Long Video","YouTube-style professional upload","Landscape • custom thumbnail • chapters • captions",<FileVideo2 className="size-7"/>],
  ["clip","Clips","TikTok-style vertical publishing","Portrait • up to 180s • cover • remix controls",<Video className="size-7"/>],
  ["post","Post","Facebook-style photo/social post","Multiple photos • crop • stickers • caption",<ImagePlus className="size-7"/>],
  ["story","Story","24-hour story composer","Photo/video • text • stickers • audience",<Sparkles className="size-7"/>]
 ];
 return <section className="mx-auto max-w-5xl">
  <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[.06] to-white/[.025] p-5 sm:p-8">
   <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Creator Upload Center</p><h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">What are you creating?</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Choose once, then HkTube switches the editor to the correct publishing model. Humanity finally invented tabs.</p></div><button onClick={()=>onDraft()} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300"><Save className="mr-2 inline size-4"/>Draft</button></div>
   <div className="mt-7 grid gap-4 md:grid-cols-2">{cards.map(([m,t,d,s,i])=><button key={m} onClick={()=>onPick(m)} className="group rounded-3xl border border-white/10 bg-black/20 p-5 text-left transition hover:-translate-y-1 hover:border-violet-300/40 hover:bg-violet-500/[.06]"><span className="grid size-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">{i}</span><div className="mt-5 flex items-center justify-between"><div><h2 className="text-lg font-black text-white">{t}</h2><p className="mt-1 text-sm text-slate-400">{d}</p><p className="mt-3 text-xs text-slate-500">{s}</p></div><ChevronRight className="size-5 text-slate-600 transition group-hover:translate-x-1 group-hover:text-violet-300"/></div></button>)}</div>
  </div>
  <div className="mt-5 grid gap-3 sm:grid-cols-3"><Info icon={<ShieldCheck/>} title="Rights & safety" text="Ownership reminder, privacy controls and moderation-ready publishing."/><Info icon={<UploadCloud/>} title="Reliable uploads" text="Long videos use the existing resumable upload pipeline."/><Info icon={<Settings2/>} title="Advanced but simple" text="Core controls stay visible; deeper options stay behind Advanced." /></div>
 </section>
}

type EditorProps={mode:Exclude<Mode,"choose">;back:()=>void;title:string;setTitle:(v:string)=>void;description:string;setDescription:(v:string)=>void;tags:string;setTags:(v:string)=>void;category:string;setCategory:(v:string)=>void;language:string;setLanguage:(v:string)=>void;visibility:Visibility;setVisibility:(v:Visibility)=>void;schedule:string;setSchedule:(v:string)=>void;comments:boolean;setComments:(v:boolean)=>void;downloads:boolean;setDownloads:(v:boolean)=>void;kids:boolean;setKids:(v:boolean)=>void;embed:boolean;setEmbed:(v:boolean)=>void;remix:boolean;setRemix:(v:boolean)=>void;notify:boolean;setNotify:(v:boolean)=>void;caption:boolean;setCaption:(v:boolean)=>void;location:string;setLocation:(v:string)=>void;allowReplies:boolean;setAllowReplies:(v:boolean)=>void;storyAudience:"followers"|"public"|"private";setStoryAudience:(v:"followers"|"public"|"private")=>void;postBackground:string;setPostBackground:(v:string)=>void;postSticker:string;setPostSticker:(v:string)=>void;crop:string;setCrop:(v:string)=>void;rotation:number;setRotation:(v:number)=>void;altText:string;setAltText:(v:string)=>void;advanced:boolean;setAdvanced:(v:boolean)=>void;media:Media[];setMedia:React.Dispatch<React.SetStateAction<Media[]>>;thumbnail:File|null;thumbnailUrl:string;setThumbnail:(v:File|null)=>void;chooseFiles:(e:ChangeEvent<HTMLInputElement>)=>void;clearMedia:()=>void;channelId:string;setChannelId:(v:string)=>void;channels:SupabaseChannel[];selected:SupabaseChannel|undefined;saving:boolean;progress:number;publish:()=>void;saveDraft:()=>void;addSticker:(v:string)=>void;navigate:(v:string)=>void};

function Editor(p:EditorProps){
 const [stage,setStage]=useState<"select"|"edit"|"details">("select");
 const isPost=p.mode==="post",isStory=p.mode==="story",isClip=p.mode==="clip";
 const title=isPost?"Create Post":isStory?"Create Story":isClip?"Create Clip":"Upload Long Video";
 const sub=isPost?"Social post composer":isStory?"24-hour story composer":isClip?"Vertical short-video studio":"Professional video publishing";
 if((p.mode==="video"||p.mode==="clip")&&p.media[0]&&stage==="edit") return <VideoUploadEditor file={p.media[0].file} mode={p.mode} onBack={()=>setStage("select")} onNext={(file)=>{const url=URL.createObjectURL(file);p.setMedia([{file,url,kind:"video"}]);setStage("details");void makeThumb(file).then(t=>{if(t)p.setThumbnail(t)});}}/>;
 return <section>
  <div className="flex items-center justify-between gap-3"><button onClick={p.back} className="inline-flex items-center gap-2 text-sm font-black text-slate-300"><ArrowLeft className="size-4"/>Back</button><span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-200">{title}</span></div>
  <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_390px]">
   <section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-5 sm:p-7">
    <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">{isPost?<ImagePlus className="size-5"/>:isStory?<Sparkles className="size-5"/>:isClip?<Video className="size-5"/>:<FileVideo2 className="size-5"/>}</span><div><h1 className="text-xl font-black text-white">{title}</h1><p className="text-xs text-slate-500">{sub}</p></div></div>

    {(isPost||isStory||isVideo)&&<label className="mt-6 grid min-h-40 cursor-pointer place-items-center rounded-3xl border border-dashed border-white/15 bg-black/20 p-6 text-center hover:border-violet-300/40"><UploadCloud className="size-8 text-violet-300"/><b className="mt-2 text-sm text-white">{isPost?"Add photos or video":isStory?"Add story media":isClip?"Choose vertical Clip":"Choose Long Video"}</b><span className="mt-1 text-xs text-slate-500">{isPost?"Up to 10 media items":isStory?"Photo or video":"MP4/WebM"}</span><input type="file" multiple={isPost} accept={isPost||isStory?"image/*,video/*":"video/mp4,video/webm"} className="sr-only" onChange={p.chooseFiles}/></label>}

    {p.media.length>0&&<div className={`mt-4 grid gap-2 ${isPost?"grid-cols-2 sm:grid-cols-3":"grid-cols-1"}`}>{p.media.map((m,i)=><div key={m.url} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black"><div className={`overflow-hidden ${isPost?"aspect-square":"aspect-video"}`}><Preview m={m} crop={p.crop} rotation={p.rotation}/></div>{isPost&&<button onClick={()=>{const next=p.media.filter((_,x)=>x!==i);p.clearMedia();next.forEach(x=>{const e={target:{files:[x.file]}} as unknown as ChangeEvent<HTMLInputElement>;p.chooseFiles(e)})}} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white"><X className="size-4"/></button>}</div>)}</div>}

    {(isVideo&&p.media.length>0&&stage==="select")&&<button onClick={()=>setStage("edit")} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/10 text-sm font-black text-violet-200">Edit video • Trim / Cut / Preview <ChevronRight className="ml-2 size-4"/></button>}

    {(isPost||isStory)&&<div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between"><b className="text-sm text-white">Media tools</b><span className="text-xs text-slate-500">Edit before publishing</span></div><div className="mt-3 flex flex-wrap gap-2">{["fit","fill","square"].map(x=><button key={x} onClick={()=>p.setCrop(x)} className={`rounded-full border px-3 py-2 text-xs font-black ${p.crop===x?"border-violet-300/40 bg-violet-500/10 text-violet-200":"border-white/10 text-slate-400"}`}><Crop className="mr-1 inline size-3"/> {x}</button>)}<button onClick={()=>p.setRotation((p.rotation+90)%360)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-slate-400"><RotateCw className="mr-1 inline size-3"/>Rotate</button><button onClick={()=>p.setAdvanced(!p.advanced)} className="rounded-full border border-white/10 px-3 py-2 text-xs font-black text-slate-400"><Settings2 className="mr-1 inline size-3"/>Adjust</button></div>{p.advanced&&<div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Alt text" value={p.altText} set={p.setAltText} placeholder="Describe the image for accessibility"/><Field label="Location" value={p.location} set={p.setLocation} placeholder="Optional location"/></div>}</div>}

    {isPost&&<div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-4"><b className="text-sm text-white">Stickers & style</b><div className="mt-3 flex flex-wrap gap-2">{["🔥","😂","❤️","⭐","🎉","👍"].map(s=><button key={s} onClick={()=>p.addSticker(s)} className="grid size-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-lg hover:bg-white/10">{s}</button>)}<select value={p.postBackground} onChange={e=>p.setPostBackground(e.target.value)} className="rounded-xl border border-white/10 bg-[#151a25] px-3 text-xs text-white"><option value="plain">Plain</option><option value="soft">Soft</option><option value="midnight">Midnight</option></select></div>{p.postSticker&&<p className="mt-3 text-xs text-violet-200">Sticker: {p.postSticker}</p>}</div>}

    {!isStory&&<Field label={isPost?"Caption":isClip?"Clip title":"Video title"} value={p.title} set={p.setTitle} placeholder={isPost?"Write something…":"Give your content a clear title"}/>}
    <label className="mt-4 block"><span className="text-sm font-black text-white">{isPost||isStory?"Text":"Description / caption"}</span><textarea value={p.description} onChange={e=>p.setDescription(e.target.value.slice(0,10000))} rows={isPost||isStory?5:6} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/40" placeholder={isPost?"Share something with your audience…":isStory?"Add story text…":"Tell viewers what they are watching…"}/></label>

    {(isVideo||isPost)&&<div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Hashtags" value={p.tags} set={p.setTags} placeholder="#gaming #music #fun"/><Field label="Location" value={p.location} set={p.setLocation} placeholder="Optional location"/></div>}
    {isVideo&&<div className="mt-4 grid gap-3 sm:grid-cols-2"><Select label="Category" value={p.category} set={p.setCategory} options={["Entertainment","Gaming","Music","Education","News","Sports","Technology","Lifestyle","Comedy","How-to","Film & Animation","Travel"]}/><Select label="Language" value={p.language} set={p.setLanguage} options={["English","Urdu","Hindi","Arabic","Other"]}/></div>}

    {isVideo&&!isClip&&<div className="mt-5 rounded-3xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between"><b className="text-sm text-white">Thumbnail</b><span className="text-xs text-slate-500">YouTube-style cover selection</span></div><div className="mt-3 flex items-center gap-3"><label className="cursor-pointer rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-slate-300"><ImagePlus className="mr-2 inline size-4"/>Custom thumbnail<input type="file" accept="image/*" className="sr-only" onChange={e=>p.setThumbnail(e.target.files?.[0]||null)}/></label>{p.thumbnailUrl&&<img src={p.thumbnailUrl} className="h-16 w-28 rounded-xl object-cover" alt="Thumbnail preview"/>}</div></div>}

    <div className="mt-5 flex items-center justify-between rounded-3xl border border-white/10 bg-black/10 p-4"><div><b className="text-sm text-white">Advanced settings</b><p className="mt-1 text-xs text-slate-500">Comments, audience, embedding, remixing, downloads and publishing rules.</p></div><button onClick={()=>p.setAdvanced(!p.advanced)} className="rounded-full border border-violet-300/20 px-4 py-2 text-xs font-black text-violet-200">{p.advanced?"Hide":"Open"}</button></div>

    {p.advanced&&<Advanced {...p} isPost={isPost} isStory={isStory} isClip={isClip}/>}
    <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={p.saveDraft} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/10 px-5 text-sm font-black text-slate-300"><Save className="mr-2 size-4"/>Save Draft</button><button disabled={!p.media.length&&!isPost&&!isStory||p.saving||(!isPost&&!isStory&&!p.title.trim())} onClick={p.publish} className="inline-flex min-h-12 flex-[1.4] items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-black text-white disabled:opacity-40">{p.saving?<><span className="mr-2 animate-pulse">●</span>Publishing {p.progress}%</>:<><UploadCloud className="mr-2 size-4"/>{isPost?"Post":isStory?"Share to Story":isClip?"Post Clip":"Publish Video"}</>}</button></div>
   </section>
   <aside className="space-y-4"><PreviewCard mode={p.mode} media={p.media} thumbnailUrl={p.thumbnailUrl} crop={p.crop} rotation={p.rotation} title={p.title} description={p.description} selected={p.selected}/>
    {isVideo&&<section className="rounded-3xl border border-emerald-300/10 bg-emerald-500/[.04] p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300"/><b className="text-sm text-white">Publish checks</b></div><ul className="mt-3 space-y-2 text-xs text-slate-500"><li>• File type and dimensions validated</li><li>• Authenticated channel ownership</li><li>• Copyright/rights reminder</li><li>• Moderation-ready metadata</li></ul></section>}
   </aside>
  </div>
 </section>
}

function Advanced(p:EditorProps&{isPost:boolean;isStory:boolean;isClip:boolean}){
 return <div className="mt-4 grid gap-3 sm:grid-cols-2">
  {(p.mode==="video"||p.mode==="clip")&&<Select label="Publishing channel" value={p.channelId} set={p.setChannelId} options={p.channels.map(c=>c.id)}/>}
  <Select label="Visibility" value={p.isStory?p.storyAudience:p.visibility} set={v=>p.isStory?p.setStoryAudience(v as "followers"|"public"|"private"):p.setVisibility(v as Visibility)} options={p.isStory?["followers","public","private"]:["public","unlisted","private"]}/>
  {!p.isStory&&<Select label="Audience" value={p.kids?"kids":"general"} set={v=>p.setKids(v==="kids")} options={["general","kids"]}/>}
  {!p.isStory&&<Toggle checked={p.comments} set={p.setComments} title="Comments" text="Allow viewers to comment."/>}
  {p.isStory?<Toggle checked={p.allowReplies} set={p.setAllowReplies} title="Story replies" text="Allow replies to this story."/>:<Toggle checked={p.downloads} set={p.setDownloads} title="Downloads" text="Allow viewers to download where supported."/>}
  {(p.mode==="video"||p.mode==="clip")&&!p.isStory&&<><Toggle checked={p.embed} set={p.setEmbed} title="Embedding" text="Allow external embeds."/><Toggle checked={p.remix} set={p.setRemix} title="Remix / reuse" text="Allow eligible remix features."/><Toggle checked={p.notify} set={p.setNotify} title="Notify followers" text="Send normal publish notifications."/><Toggle checked={p.caption} set={p.setCaption} title="Captions" text="Mark captions as available."/><Field label="Schedule" value={p.schedule} set={p.setSchedule} placeholder="YYYY-MM-DDTHH:mm"/></>}
  {p.isPost&&<Toggle checked={p.comments} set={p.setComments} title="Comments" text="Allow comments on this post."/>}
  <div className="sm:col-span-2 rounded-2xl border border-amber-300/10 bg-amber-500/[.04] p-4 text-xs leading-5 text-slate-400"><b className="text-amber-200">Rights declaration:</b> Upload media you created or have permission/licensing to publish. HkTube can place content under review when a rights or safety signal is raised.</div>
 </div>
}

function Preview({m,crop,rotation}:{m:Media;crop:string;rotation:number}){return m.kind==="video"?<video src={m.url} controls muted playsInline className={`size-full ${crop==="fill"?"object-cover":"object-contain"}`} style={{transform:`rotate(${rotation}deg)`}}/>:<img src={m.url} alt="" className={`size-full ${crop==="fill"?"object-cover":crop==="square"?"object-cover":"object-contain"}`} style={{transform:`rotate(${rotation}deg)`}}/>}
function PreviewCard({mode,media,thumbnailUrl,crop,rotation,title,description,selected}:{mode:Exclude<Mode,"choose">;media:Media[];thumbnailUrl:string;crop:string;rotation:number;title:string;description:string;selected:SupabaseChannel|undefined}){
 return <section className="sticky top-20 overflow-hidden rounded-[2rem] border border-white/10 bg-[#080a0f]"><div className={`relative overflow-hidden ${mode==="clip"||mode==="story"?"aspect-[9/16] max-h-[680px]":"aspect-video"}`}>{thumbnailUrl&&mode==="video"?<img src={thumbnailUrl} alt="Thumbnail" className="size-full object-cover"/>:media[0]?<Preview m={media[0]} crop={crop} rotation={rotation}/>:<div className="grid size-full place-items-center p-8 text-center text-slate-600"><Eye className="size-9"/><p className="mt-3 text-sm">Live preview</p></div>}<div className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">{mode==="video"?"Long Video":mode==="clip"?"Clip":mode==="post"?"Post":"Story"}</div></div><div className="border-t border-white/10 p-4"><div className="min-w-0"><p className="truncate text-xs font-black text-white">{title||"Your title or caption"}</p><p className="truncate text-[10px] text-slate-500">{mode==="clip"?"Clips preview":"Video preview"}</p></div>{description&&<p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{description}</p>}</div></section>
}
function Field({label,value,set,placeholder}:{label:string;value:string;set:(v:string)=>void;placeholder:string}){return <label className="block"><span className="text-sm font-black text-white">{label}</span><input value={value} onChange={e=>set(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/40"/></label>}
function Select({label,value,set,options}:{label:string;value:string;set:(v:string)=>void;options:string[]}){return <label className="block"><span className="text-sm font-black text-white">{label}</span><select value={value} onChange={e=>set(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#151a25] px-4 py-3 text-sm text-white outline-none">{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
function Toggle({checked,set,title,text}:{checked:boolean;set:(v:boolean)=>void;title:string;text:string}){return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/10 p-4"><input type="checkbox" checked={checked} onChange={e=>set(e.target.checked)} className="mt-1 size-4 accent-violet-500"/><span><b className="block text-sm text-white">{title}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span></span></label>}
function Info({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><span className="text-violet-300">{icon}</span><b className="ml-2 text-xs text-white">{title}</b><p className="mt-2 text-[11px] leading-5 text-slate-500">{text}</p></div>}
