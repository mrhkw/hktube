import { useRef, useState, type ChangeEvent } from "react";
import { FileVideo2, ImagePlus, Film, X, UploadCloud, ShieldCheck } from "lucide-react";

export type CreateMediaMode = "video" | "clip" | "post";
type Props = {
  onCancel: () => void;
  onSelect: (mode: CreateMediaMode, file: File) => void;
  initialMode?: CreateMediaMode;
};

export function HkTubeCreateGallery({ onCancel, onSelect, initialMode = "video" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CreateMediaMode>(initialMode);
  const [error, setError] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (mode === "post" ? !isImage : !isVideo) {
      setError(mode === "post" ? "Post ke liye photo select karein." : "Video select karein. Photos ko video upload nahi kiya ja sakta.");
      return;
    }
    setError("");
    onSelect(mode, file);
  }

  const modes = [
    { id: "video" as const, title: "Upload video", detail: "Share a video with everyone", Icon: FileVideo2 },
    { id: "clip" as const, title: "Create a Clip", detail: "Vertical short-form video", Icon: Film },
    { id: "post" as const, title: "Create a post", detail: "Share a photo with your audience", Icon: ImagePlus },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="hktube-create-title">
      <button className="absolute inset-0 cursor-default" aria-label="Close upload menu" onClick={onCancel} />
      <section className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-[#11141c] text-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-violet-300">HKTUBE CREATE</p>
            <h2 id="hktube-create-title" className="mt-1 text-xl font-black">Create something new</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-white/5 hover:bg-white/10"><X className="size-5" /></button>
        </header>
        <div className="space-y-2 p-3 sm:p-4">
          {modes.map(({ id, title, detail, Icon }) => (
            <button key={id} type="button" onClick={() => { setMode(id); setError(""); }} aria-pressed={mode === id}
              className={"flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition " + (mode === id ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-white/[.025] hover:bg-white/[.06]")}>
              <span className={"grid size-12 shrink-0 place-items-center rounded-2xl " + (mode === id ? "bg-violet-500/20 text-violet-200" : "bg-white/5 text-slate-300")}><Icon className="size-6" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs text-slate-400">{detail}</span></span>
              <span className={"size-4 rounded-full border-2 " + (mode === id ? "border-violet-300 bg-violet-300 ring-2 ring-violet-300/20" : "border-slate-500")} />
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mx-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        <div className="px-4 pb-5 pt-1 sm:px-5">
          <input ref={inputRef} type="file" accept={mode === "post" ? "image/*" : "video/*"} capture={undefined} className="hidden" onChange={chooseFile} />
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-4 text-sm font-extrabold text-white transition hover:bg-violet-400 active:scale-[.99]">
            <UploadCloud className="size-5" /> {mode === "post" ? "Select photo" : "Select video"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500"><ShieldCheck className="size-3.5" /> Opens your device's original Photos / Albums picker</p>
        </div>
      </section>
    </div>
  );
}
