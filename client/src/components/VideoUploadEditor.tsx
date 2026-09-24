import { useEffect, useRef, useState } from "react";
import { Scissors, RotateCw, Crop, Play, Pause, Check, ArrowLeft, Sparkles } from "lucide-react";

type Props = {
  file: File;
  mode: "video" | "clip";
  onBack: () => void;
  onNext: (file: File, duration: number) => void;
};

function fmt(seconds:number){const s=Math.max(0,Math.round(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`}

async function renderTrim(file:File,start:number,end:number,rotation:number):Promise<File>{
  const video=document.createElement("video");
  const url=URL.createObjectURL(file);
  video.src=url; video.muted=true; video.playsInline=true; video.preload="auto";
  await new Promise<void>((resolve,reject)=>{video.onloadedmetadata=()=>resolve();video.onerror=()=>reject(new Error("Video could not be decoded."))});
  const canvas=document.createElement("canvas");
  const w=video.videoWidth||1280,h=video.videoHeight||720;
  if(rotation%180===0){canvas.width=w;canvas.height=h}else{canvas.width=h;canvas.height=w}
  const ctx=canvas.getContext("2d"); if(!ctx){URL.revokeObjectURL(url);throw new Error("Video editor is unavailable in this browser.")}
  const stream=canvas.captureStream(30);
  const videoWithCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
  const source = typeof videoWithCapture.captureStream === "function" ? videoWithCapture.captureStream() : null;
  source?.getAudioTracks().forEach(t=>stream.addTrack(t));
  const mime=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){URL.revokeObjectURL(url);throw new Error("This browser does not support local video export.")}
  const recorder=new MediaRecorder(stream,{mimeType:mime});
  const chunks:Blob[]=[]; recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const done=new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error("Video export failed."))});
  recorder.start(250);
  video.currentTime=start;
  await new Promise<void>(resolve=>{video.onseeked=()=>resolve()});
  await video.play();
  await new Promise<void>((resolve,reject)=>{
    let raf=0;
    const draw=()=>{
      if(video.currentTime>=end || video.ended){cancelAnimationFrame(raf);video.pause();resolve();return}
      ctx.save();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(video,-w/2,-h/2,w,h);ctx.restore();raf=requestAnimationFrame(draw);
    };
    video.addEventListener("error",()=>reject(new Error("Video playback failed.")),{once:true});draw();
  });
  recorder.stop(); await done; stream.getTracks().forEach(t=>t.stop()); source?.getTracks().forEach(t=>t.stop()); URL.revokeObjectURL(url);
  return new File([new Blob(chunks,{type:mime})],"hktube-edited.webm",{type:"video/webm"});
}

export default function VideoUploadEditor({file,mode,onBack,onNext}:Props){
 const ref=useRef<HTMLVideoElement>(null);
 const [duration,setDuration]=useState(0); const [start,setStart]=useState(0); const [end,setEnd]=useState(0);
 const [playing,setPlaying]=useState(false); const [rotation,setRotation]=useState(0); const [busy,setBusy]=useState(false);
 useEffect(()=>{const v=ref.current;if(!v)return;const u=URL.createObjectURL(file);v.src=u;const loaded=()=>{setDuration(v.duration||0);setEnd(v.duration||0)};v.addEventListener("loadedmetadata",loaded);return()=>{v.removeEventListener("loadedmetadata",loaded);URL.revokeObjectURL(u)}},[file]);
 useEffect(()=>{const v=ref.current;if(!v)return;const tick=()=>{if(v.currentTime>=end&&playing){v.pause();setPlaying(false)}};v.addEventListener("timeupdate",tick);return()=>v.removeEventListener("timeupdate",tick)},[end,playing]);
 const play=async()=>{const v=ref.current;if(!v)return;if(v.currentTime<start||v.currentTime>=end)v.currentTime=start;if(v.paused){await v.play();setPlaying(true)}else{v.pause();setPlaying(false)}};
 const apply=async()=>{if(end<=start+0.25)return;setBusy(true);try{const out=await renderTrim(file,start,end,rotation);onNext(out,end-start)}catch(e){alert(e instanceof Error?e.message:"Could not export the edit.")}finally{setBusy(false)}};
 return <section className="space-y-5">
  <div className="flex items-center justify-between"><button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-black text-slate-300"><ArrowLeft className="size-4"/>Change video</button><span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-200"><Sparkles className="size-3.5"/>Edit before Next</span></div>
  <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
   <div className="rounded-[2rem] border border-white/10 bg-black p-3 sm:p-5"><div className={`overflow-hidden rounded-2xl bg-black ${mode==="clip"?"aspect-[9/16]":"aspect-video"}`}><video ref={ref} controls={false} playsInline className="size-full object-contain" onClick={()=>void play()}/></div>
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between text-xs font-bold text-slate-400"><span>{fmt(start)}</span><span>{fmt(Math.max(0,end-start))} selected</span><span>{fmt(duration)}</span></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400">Start<input aria-label="Start time" type="range" min="0" max={Math.max(duration,.01)} step=".1" value={start} onChange={e=>setStart(Math.min(Number(e.target.value),Math.max(0,end-.25)))} className="mt-2 w-full accent-violet-500"/></label><label className="text-xs text-slate-400">End<input aria-label="End time" type="range" min="0" max={Math.max(duration,.01)} step=".1" value={end} onChange={e=>setEnd(Math.max(Number(e.target.value),Math.min(duration,start+.25)))} className="mt-2 w-full accent-fuchsia-500"/></label></div>
      <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void play()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white">{playing?<Pause className="size-4"/>:<Play className="size-4"/>}{playing?"Pause":"Preview cut"}</button><button onClick={()=>setRotation((rotation+90)%360)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white"><RotateCw className="size-4"/>Rotate</button><span className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-500"><Crop className="size-4"/>Fit preview</span></div>
    </div>
   </div>
   <div className="rounded-[2rem] border border-white/10 bg-white/[.035] p-5"><div className="flex items-center gap-2"><Scissors className="size-5 text-violet-300"/><h2 className="font-black text-white">Trim & Edit</h2></div><p className="mt-2 text-sm leading-6 text-slate-400">Set the exact start and end points, preview the cut, rotate the video, then apply the edit. The next screen is where title, thumbnail, description, tags, category and publishing settings live.</p><div className="mt-5 space-y-3 text-xs text-slate-500"><p>• Original: {fmt(duration)}</p><p>• Selection: {fmt(Math.max(0,end-start))}</p><p>• Output: WebM browser export</p>{mode==="clip"&&<p>• Clips limit: 3:00 maximum</p>}</div><button disabled={busy||end<=start+.25||(mode==="clip"&&end-start>180)} onClick={()=>void apply()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-sm font-black text-white disabled:opacity-40">{busy?"Preparing edited video…":<><Check className="mr-2 size-4"/>Apply edit & Next</>}</button></div>
  </div>
 </section>
}
