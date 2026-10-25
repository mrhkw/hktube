import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Album, Check, FileImage, Film, Heart, ImagePlus, Search, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreateMediaMode = "video" | "clip" | "post";
type GalleryItem = { id: string; file: File; url: string; kind: "video" | "image"; favorite: boolean; addedAt: number };
type Props = { onCancel: () => void; onSelect: (mode: CreateMediaMode, file: File) => void; initialMode?: CreateMediaMode };
type Filter = "all" | "videos" | "photos" | "recent" | "favorites";
type StoredGalleryItem = { id: string; file: File; kind: "video" | "image"; favorite: boolean; addedAt: number };
const GALLERY_DB = "hktube-media-library";
const GALLERY_STORE = "media";

function openGalleryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Local media storage is not supported in this browser."));
    const request = indexedDB.open(GALLERY_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(GALLERY_STORE)) request.result.createObjectStore(GALLERY_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local media library."));
  });
}

async function saveGalleryItems(items: StoredGalleryItem[]) {
  const db = await openGalleryDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(GALLERY_STORE, "readwrite");
      const store = tx.objectStore(GALLERY_STORE);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Could not save selected media."));
      tx.onabort = () => reject(tx.error ?? new Error("Saving selected media was cancelled."));
    });
  } finally { db.close(); }
}

async function loadGalleryItems(): Promise<StoredGalleryItem[]> {
  const db = await openGalleryDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(GALLERY_STORE, "readonly").objectStore(GALLERY_STORE).getAll();
      request.onsuccess = () => resolve((request.result as StoredGalleryItem[]).sort((a, b) => b.addedAt - a.addedAt));
      request.onerror = () => reject(request.error ?? new Error("Could not load the local media library."));
    });
  } finally { db.close(); }
}

async function deleteGalleryItem(id: string) {
  const db = await openGalleryDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(GALLERY_STORE, "readwrite").objectStore(GALLERY_STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Could not remove media from the library."));
    });
  } finally { db.close(); }
}

async function updateStoredFavorite(item: StoredGalleryItem) {
  await saveGalleryItems([item]);
}

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";
const durationFor = (file: File) => new Promise<string>(resolve => {
  if (!file.type.startsWith("video/")) return resolve("");
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  const done = () => { const value = Number.isFinite(video.duration) ? video.duration : 0; URL.revokeObjectURL(url); resolve(Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0")); };
  video.onloadedmetadata = done; video.onerror = () => { URL.revokeObjectURL(url); resolve(""); }; video.src = url;
});
export function HkTubeCreateGallery({ onCancel, onSelect, initialMode = "video" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    void loadGalleryItems().then(saved => {
      if (!active) return;
      const restored = saved.map(item => {
        const url = URL.createObjectURL(item.file);
        objectUrlsRef.current.add(url);
        return { ...item, url };
      });
      setItems(restored);
    }).catch(() => {
      if (active) setError("Saved media could not be loaded. You can still add media again.");
    });
    return () => { active = false; };
  }, []);
  useEffect(() => () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
  }, []);
  const [mode, setMode] = useState<CreateMediaMode>(initialMode);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = useMemo(() => items.filter(item => {
    const typeOk = filter === "all" || filter === "recent" || (filter === "videos" ? item.kind === "video" : filter === "photos" ? item.kind === "image" : item.favorite);
    const modeOk = mode === "post" ? item.kind === "image" : item.kind === "video";
    return typeOk && modeOk && item.file.name.toLowerCase().includes(query.toLowerCase());
  }).sort((a,b) => b.addedAt - a.addedAt), [items, filter, mode, query]);
  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    setError("");
    const accepted = files.filter(file => file.size > 0 && (file.type.startsWith("video/") || file.type.startsWith("image/")));
    if (!accepted.length) { setError("Select a supported video or photo from your device gallery."); return; }
    const modeAccepted = accepted.filter(file => mode === "post" ? file.type.startsWith("image/") : file.type.startsWith("video/"));
    if (!modeAccepted.length) {
      setError(mode === "post" ? "Choose photos for a Post." : "Choose videos for Long Video or Clips.");
      return;
    }
    setBusy(true);
    try {
      const now = Date.now();
      const stored: StoredGalleryItem[] = modeAccepted.map(file => ({
        id: crypto.randomUUID(),
        file,
        kind: file.type.startsWith("video/") ? "video" : "image",
        favorite: false,
        addedAt: now,
      }));
      await saveGalleryItems(stored);
      const next: GalleryItem[] = stored.map(item => {
        const url = URL.createObjectURL(item.file);
        objectUrlsRef.current.add(url);
        return { ...item, url };
      });
      setItems(current => [...next, ...current]);
      setSelected(next[0].id);
      setFilter("all");
    } catch {
      setError("HkTube could not save these files in local storage. Try fewer or smaller files, or free some device storage.");
    } finally { setBusy(false); }
  }
  function toggleFavorite(id: string) {
    const current = items.find(item => item.id === id);
    if (!current) return;
    const updated = { ...current, favorite: !current.favorite };
    setItems(list => list.map(item => item.id === id ? updated : item));
    void updateStoredFavorite({ id: updated.id, file: updated.file, kind: updated.kind, favorite: updated.favorite, addedAt: updated.addedAt }).catch(() => setError("Favorite could not be saved."));
  }
  function removeItem(id: string) {
    const item = items.find(x => x.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
      objectUrlsRef.current.delete(item.url);
      void deleteGalleryItem(id).catch(() => setError("Media was hidden from this view but could not be removed from local storage."));
    }
    setItems(current => current.filter(x => x.id !== id));
    setSelected(current => current === id ? "" : current);
  }
  const chosen = items.find(item => item.id === selected);
  const accept = mode === "post" ? "image/*" : "video/*,image/*";
  return <div className="hktube-own-gallery fixed inset-0 z-[100] flex h-[100dvh] min-h-0 w-screen flex-col overflow-hidden rounded-none bg-[#080a12] text-white sm:inset-3 sm:h-[calc(100dvh-24px)] sm:w-auto sm:rounded-2xl">
    <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
      <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">HKTUBE GALLERY</p><h2 className="mt-1 text-xl font-black">Create on HkTube</h2><p className="mt-1 text-xs text-slate-400">Your private HkTube library. Imported media stays available in this browser after you reopen the gallery.</p></div>
      <button type="button" onClick={onCancel} aria-label="Close gallery" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/5 hover:bg-white/10"><X className="size-5"/></button>
    </header>
    <div className="grid grid-cols-3 gap-2 border-b border-white/10 p-3 sm:p-4">
      {([{id:"video",title:"Long Video",desc:"Landscape video",icon:Video},{id:"clip",title:"Clips",desc:"Vertical video",icon:Film},{id:"post",title:"Post",desc:"Photos",icon:FileImage}] as const).map(option => <button key={option.id} type="button" onClick={() => {setMode(option.id);setSelected("");setFilter("all");setError("");}} aria-pressed={mode===option.id} className={"rounded-xl border p-3 text-left transition " +(mode===option.id?"border-violet-400 bg-violet-500/15":"border-white/10 bg-white/[.025] hover:bg-white/[.06]")}><option.icon className={"mb-2 size-5 "+(mode===option.id?"text-violet-300":"text-slate-400")}/><span className="block text-sm font-black">{option.title}</span><span className="mt-1 block text-[10px] text-slate-400">{option.desc}</span></button>)}
    </div>
    <div className="flex flex-wrap items-center gap-2 px-3 pt-3 sm:px-4">
      <div className="relative min-w-[150px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your gallery" aria-label="Search gallery" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm outline-none focus:border-violet-400"/></div>
      <button type="button" onClick={()=>inputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-500 px-3 text-xs font-black hover:bg-violet-400"><ImagePlus className="size-4"/>{busy ? "Saving…" : "Open Device Gallery"}</button>
      <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={importFiles}/>
    </div>
    <div className="flex gap-1 overflow-x-auto px-3 py-3 sm:px-4">
      {([{id:"all",label:"All media"},{id:"videos",label:"Videos"},{id:"photos",label:"Photos"},{id:"recent",label:"Recent"},{id:"favorites",label:"Favorites"}] as const).map(tab=><button key={tab.id} type="button" onClick={()=>setFilter(tab.id)} className={"shrink-0 rounded-full px-3 py-2 text-xs font-bold "+(filter===tab.id?"bg-white text-black":"bg-white/[.06] text-slate-300 hover:bg-white/10")}>{tab.label}</button>)}
    </div>
    {error && <p role="alert" className="mx-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4">
      {visible.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{visible.map(item=><div key={item.id} className={"relative overflow-hidden rounded-xl border "+(selected===item.id?"border-violet-400 ring-2 ring-violet-400/40":"border-white/10")}><button type="button" onClick={()=>setSelected(item.id)} aria-label={"Select "+item.file.name} aria-pressed={selected===item.id} className="block w-full text-left"><div className="relative aspect-[9/16] bg-black/50">{item.kind==="video"?<video src={item.url} muted playsInline preload="metadata" className="size-full object-cover"/>:<img src={item.url} alt={item.file.name} className="size-full object-cover"/>}<span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-1 text-[9px] font-bold">{item.kind==="video"?"VIDEO":"PHOTO"}</span>{selected===item.id&&<span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-violet-500"><Check className="size-4"/></span>}</div><div className="p-2"><p className="truncate text-[11px] font-bold">{item.file.name}</p><p className="mt-1 text-[10px] text-slate-400">{formatBytes(item.file.size)}</p></div></button><button type="button" onClick={()=>toggleFavorite(item.id)} aria-label={item.favorite?"Remove favorite":"Add favorite"} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/65"><Heart className={"size-3.5 "+(item.favorite?"fill-rose-500 text-rose-500":"text-white")}/></button><button type="button" onClick={()=>removeItem(item.id)} aria-label="Remove media from HkTube gallery" className="absolute right-1 bottom-[50px] grid size-6 place-items-center rounded-full bg-black/75 text-white"><X className="size-3.5"/></button></div>)}</div> : <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/15 px-6 text-center"><div><Album className="mx-auto size-8 text-violet-300"/><p className="mt-3 font-bold">Your {mode==="post"?"photos":"videos"} will appear here</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Open your device gallery, choose a video or photo, and it will appear in your private HkTube library. Saved items stay in this browser until you remove them or clear site data.</p><button type="button" onClick={()=>inputRef.current?.click()} className="mt-4 rounded-full border border-white/15 px-4 py-2 text-xs font-bold">Open device gallery</button></div></div>}
    </div>
    <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#111522] px-3 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-xs font-bold">{chosen?chosen.file.name:"No media selected"}</p><p className="mt-1 text-[10px] text-slate-400">{chosen?formatBytes(chosen.file.size):visible.length+" items"}</p></div><Button type="button" disabled={!chosen||busy} onClick={()=>chosen&&onSelect(mode,chosen.file)} className="shrink-0 rounded-full bg-violet-500 px-5 font-black text-white hover:bg-violet-400">Use media →</Button></footer>
  </div>;
}
