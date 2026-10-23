import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Film,
  ImagePlus,
  MoreHorizontal,
  Play,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreatorGalleryMode = "video" | "clip" | "post";

type GalleryAsset = {
  id: string;
  file: File;
  url: string;
  type: "video" | "image";
};

type CreatorGalleryProps = {
  onClose: () => void;
  onContinue: (mode: CreatorGalleryMode, file: File) => void;
  initialMode?: CreatorGalleryMode;
};

const MODES: Array<[CreatorGalleryMode, string, string]> = [
  ["video", "Video", "Full-length"],
  ["clip", "Clips", "Vertical short"],
  ["post", "Post", "Photo update"],
];

export function HkTubeCreatorGallery({
  onClose,
  onContinue,
  initialMode = "video",
}: CreatorGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const [mode, setMode] = useState<CreatorGalleryMode>(initialMode);
  const [source, setSource] = useState<"device" | "library">("device");
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      urls.current.forEach(url => URL.revokeObjectURL(url));
    },
    []
  );

  const visibleAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return assets.filter(asset => {
      const allowed =
        mode === "post" ? asset.type === "image" : asset.type === "video";
      return allowed && asset.file.name.toLowerCase().includes(term);
    });
  }, [assets, mode, query]);

  const selected = assets.find(asset => asset.id === selectedId);
  const accept = mode === "post" ? "image/*" : "video/*";

  function switchMode(next: CreatorGalleryMode) {
    setMode(next);
    setSelectedId("");
    setError("");
  }

  function importMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    const accepted = files.filter(file =>
      mode === "post"
        ? file.type.startsWith("image/")
        : file.type.startsWith("video/")
    );
    if (!accepted.length) {
      setError(
        mode === "post"
          ? "Select an image for your post."
          : "Select a video for this upload."
      );
      return;
    }
    const next = accepted.map(file => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return {
        id: crypto.randomUUID(),
        file,
        url,
        type: file.type.startsWith("video/")
          ? ("video" as const)
          : ("image" as const),
      };
    });
    setAssets(current => [...next, ...current]);
    setSelectedId(next[0]?.id ?? "");
    setError("");
  }

  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#08090d] text-white sm:min-h-0 sm:max-h-[94dvh] sm:rounded-[30px]">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 size-72 rounded-full bg-red-600/10 blur-3xl" />

      <header className="relative z-10 border-b border-white/10 bg-[#08090d]/80 px-5 pb-4 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-xl sm:px-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close creator gallery"
            className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[.04] transition hover:bg-white/10"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.24em] text-violet-300">
              <Sparkles className="size-3" /> HkTube Creator
            </p>
            <h1 className="mt-0.5 truncate text-2xl font-black tracking-tight">
              Create something people remember
            </h1>
          </div>
          <button
            type="button"
            aria-label="More options"
            className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[.04] transition hover:bg-white/10"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] p-1">
          {(["device", "library"] as const).map(value => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black transition ${source === value ? "bg-white text-black" : "text-slate-400 hover:text-white"}`}
            >
              {value === "device" ? "Device media" : "HkTube library"}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-4 sm:px-7">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">
              {source === "device" ? "Your device" : "Your private library"}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-300">
              Choose a starting point for your next upload
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-black shadow-lg shadow-violet-600/20"
          >
            <ImagePlus className="size-4" /> Import
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={importMedia}
          />
        </div>

        <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative grid h-28 w-44 shrink-0 place-items-center overflow-hidden rounded-3xl border border-violet-300/30 bg-gradient-to-br from-violet-600/30 to-fuchsia-600/10 text-center shadow-lg shadow-violet-950/30 transition hover:-translate-y-0.5"
          >
            <div>
              <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-white/10">
                <ImagePlus className="size-5 text-violet-200" />
              </div>
              <p className="mt-2 text-xs font-black">Import new media</p>
            </div>
          </button>
          {visibleAssets.slice(0, 5).map(asset => (
            <button
              type="button"
              key={`rail-${asset.id}`}
              onClick={() => setSelectedId(asset.id)}
              className={`relative h-28 w-44 shrink-0 overflow-hidden rounded-3xl border transition ${selectedId === asset.id ? "border-violet-300 ring-2 ring-violet-400/60" : "border-white/10"}`}
            >
              {asset.type === "video" ? (
                <video
                  src={asset.url}
                  muted
                  playsInline
                  className="size-full object-cover"
                />
              ) : (
                <img
                  src={asset.url}
                  alt=""
                  className="size-full object-cover"
                />
              )}
              <span className="absolute inset-x-2 bottom-2 flex items-center justify-between text-[10px] font-black text-white">
                <span className="rounded-full bg-black/60 px-2 py-1">
                  {asset.type === "video" ? "Video" : "Photo"}
                </span>
                <Play className="size-4 fill-white" />
              </span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search your media"
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[.045] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400"
            />
          </div>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[.045] text-slate-300"
          >
            <ChevronDown className="size-5" />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200"
          >
            {error}
          </p>
        )}

        {visibleAssets.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {visibleAssets.map(asset => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedId(asset.id)}
                aria-pressed={selectedId === asset.id}
                className={`group relative aspect-square overflow-hidden rounded-2xl border bg-white/[.04] text-left transition hover:-translate-y-0.5 ${selectedId === asset.id ? "border-violet-300 ring-2 ring-violet-400/70" : "border-white/10"}`}
              >
                {asset.type === "video" ? (
                  <video
                    src={asset.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  <img
                    src={asset.url}
                    alt={asset.file.name}
                    className="size-full object-cover"
                  />
                )}
                <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-white">
                  {asset.type === "video" ? "Video" : "Photo"}
                </span>
                {selectedId === asset.id && (
                  <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-violet-500 text-white shadow-lg">
                    <Check className="size-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid min-h-[36dvh] place-items-center rounded-[30px] border border-dashed border-white/15 bg-white/[.035] px-6 text-center shadow-2xl shadow-violet-950/20">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/10">
                <Film className="size-7 text-violet-200" />
              </div>
              <h2 className="mt-5 text-xl font-black">
                Your creator canvas is empty
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                Import a video or photo to start editing with HkTube’s creator
                tools.
              </p>
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-5 rounded-full bg-white px-6 font-black text-black hover:bg-slate-200"
              >
                Import media
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0d0f16]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:absolute sm:px-7">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {MODES.map(([key, label, caption]) => {
              const Icon =
                key === "video" ? Video : key === "clip" ? Film : ImagePlus;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchMode(key)}
                  className={`rounded-2xl border px-2 py-2 text-left transition ${mode === key ? "border-violet-300 bg-violet-500/20" : "border-white/10 bg-white/[.035]"}`}
                >
                  <Icon
                    className={`size-4 ${mode === key ? "text-violet-200" : "text-slate-500"}`}
                  />
                  <span className="mt-1 block text-xs font-black">{label}</span>
                  <span className="block text-[10px] text-slate-500">
                    {caption}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">
                {selected ? selected.file.name : "Select media to continue"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {selected
                  ? "Ready for HkTube editor"
                  : "Your media stays private"}
              </p>
            </div>
            <Button
              type="button"
              disabled={!selected}
              onClick={() => selected && onContinue(mode, selected.file)}
              className="h-12 rounded-full bg-gradient-to-r from-red-600 to-fuchsia-600 px-6 font-black text-white shadow-lg shadow-red-600/20 hover:from-red-500 hover:to-fuchsia-500"
            >
              Continue <ArrowLeft className="ml-2 size-4 rotate-180" />
            </Button>
          </div>
        </div>
      </footer>
    </section>
  );
}
