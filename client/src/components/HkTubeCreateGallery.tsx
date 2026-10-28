import { useRef, useState, type ChangeEvent } from "react";
import { FileVideo2, ImagePlus, Film, X } from "lucide-react";

export type CreateMediaMode = "video" | "clip" | "post";
type Props = {
  onCancel: () => void;
  onSelect: (mode: CreateMediaMode, file: File) => void;
  initialMode?: CreateMediaMode;
};

export function HkTubeCreateGallery({ onCancel, onSelect }: Props) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  function chooseFile(event: ChangeEvent<HTMLInputElement>, mode: CreateMediaMode) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const valid = mode === "post" ? file.type.startsWith("image/") : file.type.startsWith("video/");
    if (!valid) {
      setError(mode === "post" ? "Post ke liye photo select karein." : "Video select karein.");
      return;
    }
    setError("");
    onSelect(mode, file);
  }

  const modes = [
    { id: "video" as const, title: "Upload video", detail: "Choose a video from Photos / Albums", Icon: FileVideo2 },
    { id: "clip" as const, title: "Create a Clip", detail: "Choose a vertical video from your device", Icon: Film },
    { id: "post" as const, title: "Create a post", detail: "Choose a photo from your device", Icon: ImagePlus },
  ];

  function openPicker(mode: CreateMediaMode) {
    setError("");
    if (mode === "post") photoInputRef.current?.click();
    else if (mode === "clip") clipInputRef.current?.click();
    else videoInputRef.current?.click();
  }

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
            <button key={id} type="button" onClick={() => openPicker(id)} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 text-left transition hover:bg-white/[.08] active:scale-[.99]">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-200"><Icon className="size-6" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs text-slate-400">{detail}</span></span>
            </button>
          ))}
        </div>
        {error && <p role="alert" className="mx-4 mb-3 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={event => chooseFile(event, "video")} />
        <input ref={clipInputRef} type="file" accept="video/*" className="hidden" onChange={event => chooseFile(event, "clip")} />
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={event => chooseFile(event, "post")} />
        <p className="px-5 pb-5 text-center text-[11px] text-slate-500">Aapke device ka original Photos / Albums picker khulega. HkTube apni gallery grid nahi banata.</p>
      </section>
    </div>
  );
}
