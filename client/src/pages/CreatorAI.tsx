import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clapperboard, Film, Info, Loader2, LockKeyhole, Sparkles, WandSparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const styles = ["Cinematic", "Creator vlog", "Product showcase", "Anime", "Documentary", "Minimal"] as const;
const ratios = [{ value: "9:16", label: "9:16 Clip", copy: "TikTok / Shorts style" }, { value: "16:9", label: "16:9 Video", copy: "YouTube style" }, { value: "1:1", label: "1:1 Square", copy: "Social post" }] as const;

type Draft = { prompt: string; title: string; mode: "clip" | "video"; ratio: string; duration: number; style: string };

export default function CreatorAI() {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"clip" | "video">("clip");
  const [ratio, setRatio] = useState("9:16");
  const [duration, setDuration] = useState(10);
  const [style, setStyle] = useState<(typeof styles)[number]>("Cinematic");
  const [draft, setDraft] = useState<Draft | null>(null);
  const suggest = trpc.creator_studio.suggestMetadata.useMutation();
  const selectedRatio = useMemo(() => ratios.find(item => item.value === ratio) ?? ratios[0], [ratio]);

  function prepareDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (prompt.trim().length < 12) { toast.error("Prompt thora detail mein likhein, kam az kam 12 characters."); return; }
    setDraft({ prompt: prompt.trim(), title: title.trim() || "Untitled HkTube AI draft", mode, ratio, duration, style });
    toast.success("AI draft ready. Rendering provider connect hone par video generate hoga.");
  }

  function useMetadataAssistant() {
    if (!title.trim()) { toast.error("Pehle draft title add karein."); return; }
    suggest.mutate({ title: title.trim(), description: prompt.trim(), link: "", category: mode === "clip" ? "shorts" : "regular" });
  }

  return <HkTubeShell title="AI Studio" subtitle="Prompt se Clip ya long-video draft prepare karein — signup ke baghair.">
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={prepareDraft} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-black text-white"><WandSparkles className="size-5" /></span><div><h2 className="text-xl font-black text-neutral-950">Create an AI video brief</h2><p className="mt-1 text-sm leading-6 text-neutral-500">Guest mode: aap planning aur draft setup bina account ke kar sakte hain.</p></div></div>
        <div className="mt-7 space-y-5">
          <div className="space-y-2"><Label htmlFor="ai-prompt">What should happen in the video?</Label><Textarea id="ai-prompt" required value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1200} placeholder="Example: A calm sunrise over Lahore rooftops, slow camera push-in, warm light, authentic documentary mood..." className="min-h-32 border-neutral-200" /><p className="text-right text-xs text-neutral-400">{prompt.length}/1200</p></div>
          <div className="space-y-2"><Label htmlFor="ai-title">Draft title</Label><Input id="ai-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="My HkTube AI draft" /></div>
          <div><Label>Content type</Label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setMode("clip"); setRatio("9:16"); }} className={`rounded-2xl border p-4 text-left transition ${mode === "clip" ? "border-black bg-black text-white" : "border-neutral-200 hover:border-neutral-400"}`}><Clapperboard className="size-5" /><strong className="mt-2 block">Clip</strong><span className={`mt-1 block text-xs ${mode === "clip" ? "text-white/65" : "text-neutral-500"}`}>9:16, social-first</span></button><button type="button" onClick={() => { setMode("video"); setRatio("16:9"); }} className={`rounded-2xl border p-4 text-left transition ${mode === "video" ? "border-black bg-black text-white" : "border-neutral-200 hover:border-neutral-400"}`}><Film className="size-5" /><strong className="mt-2 block">Long video</strong><span className={`mt-1 block text-xs ${mode === "video" ? "text-white/65" : "text-neutral-500"}`}>16:9, YouTube-first</span></button></div></div>
          <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2 sm:col-span-2"><Label htmlFor="ai-ratio">Aspect ratio</Label><select id="ai-ratio" value={ratio} onChange={event => setRatio(event.target.value)} className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm">{ratios.map(item => <option key={item.value} value={item.value}>{item.label} — {item.copy}</option>)}</select></div><div className="space-y-2"><Label htmlFor="ai-duration">Seconds</Label><Input id="ai-duration" type="number" min={5} max={60} value={duration} onChange={event => setDuration(Math.max(5, Math.min(60, Number(event.target.value) || 5)))} /></div></div>
          <div className="space-y-2"><Label htmlFor="ai-style">Visual style</Label><select id="ai-style" value={style} onChange={event => setStyle(event.target.value as typeof style)} className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm">{styles.map(item => <option key={item}>{item}</option>)}</select></div>
        </div>
        <Button type="submit" className="mt-7 w-full rounded-xl bg-black text-white hover:bg-neutral-800"><Sparkles className="mr-2 size-4" />Prepare AI draft</Button>
      </form>
      <aside className="space-y-4"><section className="rounded-3xl border border-violet-200 bg-violet-50 p-5"><div className="flex gap-3"><Info className="mt-0.5 size-5 shrink-0 text-violet-700" /><div><h2 className="font-bold text-violet-950">No signup for planning</h2><p className="mt-2 text-sm leading-6 text-violet-900/70">Prompt, format aur draft settings browser mein temporary rehti hain. Kuch bhi publish nahin hota jab tak aap real provider aur account flow configure na karein.</p></div></div></section><section className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"><h2 className="flex items-center gap-2 font-bold"><LockKeyhole className="size-4" />Real rendering status</h2><p className="mt-2 text-sm leading-6 text-neutral-600">AI video provider abhi connected nahin hai. Isliye HkTube fake video file ya fake progress show nahin karega.</p><div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white p-3 text-xs leading-5 text-neutral-500">Provider connect hone ke baad: generate → preview → download → Clip/Video upload.</div></section></aside>
      {draft && <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 lg:col-span-2"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-700">Draft prepared</p><h2 className="mt-1 text-2xl font-black text-cyan-950">{draft.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-900/75">{draft.prompt}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-cyan-800">{selectedRatio.label} · {draft.duration}s</span></div><div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800">{draft.style}</span><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-cyan-800">{draft.mode === "clip" ? "Clip ready" : "Long video ready"}</span><Button type="button" variant="outline" onClick={useMetadataAssistant} disabled={suggest.isPending} className="border-cyan-300 bg-white">{suggest.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}Suggest metadata</Button></div>{suggest.data && <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-neutral-400">Suggested title</p><p className="mt-1 text-sm font-bold">{suggest.data.title}</p></div><div><p className="text-xs font-bold uppercase text-neutral-400">Tags</p><p className="mt-1 text-sm">{suggest.data.tags.join(" · ")}</p></div></div>}</section>}
    </div>
  </HkTubeShell>;
}
