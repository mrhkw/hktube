import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, CheckCircle2, CircleAlert, Trash2, WifiOff, Play, HardDriveDownload } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";

type OfflineItem = { id: string; title: string; mime: string; size: number; savedAt: number; blob: Blob };
const DB = "hktube-offline-videos";
const STORE = "videos";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open offline storage"));
  });
}
async function allItems(): Promise<OfflineItem[]> {
  const db = await openDb();
  try { return await new Promise((resolve, reject) => { const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll(); req.onsuccess = () => resolve((req.result as OfflineItem[]).sort((a,b)=>b.savedAt-a.savedAt)); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
async function putItem(item: OfflineItem) {
  const db = await openDb();
  try { await new Promise<void>((resolve,reject) => { const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).put(item); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error); }); }
  finally { db.close(); }
}
async function removeItem(id: string) {
  const db=await openDb();
  try { await new Promise<void>((resolve,reject)=>{ const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).delete(id); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); }
  finally { db.close(); }
}
const bytes = (n:number) => n < 1024*1024 ? (n/1024).toFixed(0)+" KB" : (n/1024/1024).toFixed(1)+" MB";
export default function OfflineVideos() {
  const [items,setItems]=useState<OfflineItem[]>([]);
  const [url,setUrl]=useState("");
  const [title,setTitle]=useState("");
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const objectUrls=useRef<Map<string,string>>(new Map());
  async function refresh(){ try { setItems(await allItems()); } catch { setError("Is browser mein offline storage available nahi hai."); } }
  useEffect(()=>{ void refresh(); return ()=>{ for (const src of objectUrls.current.values()) URL.revokeObjectURL(src); objectUrls.current.clear(); }; },[]);
  async function saveVideo(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setError(""); setNotice("");
    let parsed:URL;
    try { parsed=new URL(url); if(parsed.protocol!=="https:" && parsed.hostname!=="localhost") throw new Error(); }
    catch { setError("Valid HTTPS video URL paste karein."); return; }
    setBusy(true);setProgress(10);
    try {
      const response=await fetch(parsed.toString(),{mode:"cors"});
      if(!response.ok) throw new Error("Server ne video download allow nahi kiya.");
      const type=response.headers.get("content-type")||"";
      if(!type.startsWith("video/") && !/\.mp4(?:$|\?)/i.test(parsed.pathname)) throw new Error("URL se direct video file nahi mili. Video ka direct MP4/WebM URL use karein.");
      const blob=await response.blob();
      if(!blob.size) throw new Error("Downloaded file empty hai.");
      if(blob.size>750*1024*1024) throw new Error("File 750 MB se bari hai; browser storage limit ke liye chhoti file use karein.");
      setProgress(85);
      const item:OfflineItem={id:crypto.randomUUID(),title:title.trim()||parsed.pathname.split("/").pop()||"Offline video",mime:blob.type||"video/mp4",size:blob.size,savedAt:Date.now(),blob};
      await putItem(item);setItems(await allItems());setUrl("");setTitle("");setProgress(100);setNotice("Video is device ke browser storage mein save ho gayi.");
    } catch(err) { setError(err instanceof Error ? err.message+" CORS ya server permissions ki wajah se kuch links save nahi ho sakte." : "Download fail ho gaya."); }
    finally { setBusy(false);window.setTimeout(()=>setProgress(0),900); }
  }
  async function deleteSaved(id:string){ await removeItem(id); const src=objectUrls.current.get(id); if(src){URL.revokeObjectURL(src);objectUrls.current.delete(id);} setItems(await allItems()); }
  return <HkTubeShell title="Offline Videos" subtitle="Saved on this device">
    <main className="mx-auto w-full max-w-5xl px-4 py-6 text-white sm:px-6">
      <Link href="/library" className="text-sm text-violet-300 hover:text-violet-200">← Back to Library</Link>
      <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-950/70 via-[#111522] to-[#090c14] p-5 sm:p-8">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500/20 text-violet-200"><WifiOff className="size-6"/></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">HKTUBE · OFFLINE</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Your Offline Videos</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Video files saved here stay in this browser and can play without internet. This is device-local storage, not cloud backup.</p></div></div>
        <form onSubmit={saveVideo} className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold text-slate-300 sm:col-span-2">Direct video file URL<input value={url} onChange={e=>setUrl(e.target.value)} type="url" required placeholder="https://example.com/video.mp4" className="h-12 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-violet-400"/></label>
          <label className="grid gap-1.5 text-xs font-bold text-slate-300">Video name (optional)<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="My offline video" className="h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-violet-400"/></label>
          <button disabled={busy} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-black text-white disabled:opacity-50"><ArrowDownToLine className="size-4"/>{busy?"Saving video…":"Download for offline"}</button>
        </form>
        {busy&&<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-violet-400 transition-all" style={{width:progress+"%"}}/></div>}
        {error&&<p role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200"><CircleAlert className="size-5 shrink-0"/>{error}</p>}
        {notice&&<p role="status" className="mt-4 flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="size-5 shrink-0"/>{notice}</p>}
        <p className="mt-3 text-xs leading-5 text-slate-500">Note: direct video URL required. Some hosts block browser downloads using CORS. HkTube watch-page downloads require a compatible media endpoint before they can be offered here.</p>
      </section>
      <div className="mt-8 flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Saved on this device</h2><p className="mt-1 text-sm text-slate-400">{items.length} video{items.length===1?"":"s"} · no internet needed after saving</p></div><HardDriveDownload className="size-6 text-violet-300"/></div>
      {items.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item=>{let src=objectUrls.current.get(item.id);if(!src){src=URL.createObjectURL(item.blob);objectUrls.current.set(item.id,src);}return <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><video controls playsInline preload="metadata" src={src} className="aspect-video w-full bg-black"/><div className="p-4"><h3 className="truncate font-bold">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{bytes(item.size)} · Saved {new Date(item.savedAt).toLocaleDateString()}</p><button onClick={()=>void deleteSaved(item.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/10"><Trash2 className="size-4"/> Remove download</button></div></article>})}</div> : <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center"><Play className="size-8 text-slate-500"/><p className="mt-3 font-bold">No offline videos yet</p><p className="mt-1 max-w-sm text-sm leading-6 text-slate-400">Save a compatible direct video file above. It will appear here for offline playback.</p></div>}
    </main>
  </HkTubeShell>;
}