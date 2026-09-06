import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Bot, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { startLogin } from "@/const";

export default function CreatorAI() {
  const { user, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [category, setCategory] = useState<"regular" | "shorts">("regular");
  const suggest = trpc.creator_studio.suggestMetadata.useMutation();

  if (loading) return <HkTubeShell><div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" /></div></HkTubeShell>;
  if (!user) return <HkTubeShell title="Creator AI Assistant"><div className="mx-auto max-w-lg rounded-2xl border border-fuchsia-400/18 bg-fuchsia-500/[.055] p-7 text-center"><Bot className="mx-auto size-8 text-fuchsia-200" /><h2 className="mt-3 font-bold text-white">Sign in to use Creator AI</h2><p className="mt-2 text-sm leading-6 text-slate-400">The assistant uses your authenticated creator workspace and never invents performance data.</p><Button onClick={startLogin} className="mt-5 bg-fuchsia-500 text-white hover:bg-fuchsia-400">Sign in</Button></div></HkTubeShell>;

  return <HkTubeShell title="Creator AI Assistant" subtitle="Generate accurate metadata from the context you provide. Real API responses only; no fabricated analytics.">
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <form onSubmit={event => { event.preventDefault(); suggest.mutate({ title, description, link, category }); }} className="rounded-2xl border border-white/9 bg-[#11111c]/90 p-5 shadow-[0_0_40px_rgba(168,85,247,.07)] sm:p-7">
        <div className="mb-6 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-200"><Sparkles className="size-5" /></span><div><h2 className="font-bold text-white">Metadata assistant</h2><p className="text-xs text-slate-500">Give the assistant real context; it will return title, description, tags and checks.</p></div></div>
        <div className="space-y-5"><div className="space-y-2"><Label htmlFor="ai-title">Working title</Label><Input id="ai-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} placeholder="What is this content about?" className="border-white/10 bg-white/[.045]" /></div><div className="space-y-2"><Label htmlFor="ai-description">Current description or notes</Label><Textarea id="ai-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} placeholder="Add only facts you want the assistant to use." className="min-h-32 border-white/10 bg-white/[.045]" /></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ai-category">Content type</Label><select id="ai-category" value={category} onChange={event => setCategory(event.target.value as "regular" | "shorts")} className="h-10 w-full rounded-md border border-white/10 bg-[#171724] px-3 text-sm text-white outline-none"><option value="regular">Video</option><option value="shorts">Short</option></select></div><div className="space-y-2"><Label htmlFor="ai-link">Reference link (optional)</Label><Input id="ai-link" value={link} onChange={event => setLink(event.target.value)} maxLength={2000} placeholder="https://..." className="border-white/10 bg-white/[.045]" /></div></div></div>
        {suggest.error && <p className="mt-5 rounded-xl border border-red-300/20 bg-red-500/[.06] p-3 text-sm leading-6 text-red-200">Creator AI could not respond right now. Check your context and try again; the raw server error is hidden.</p>}
        <Button disabled={suggest.isPending || !title.trim()} className="mt-7 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white hover:from-violet-400 hover:to-fuchsia-400">{suggest.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Bot className="mr-2 size-4" />}{suggest.isPending ? "Generating…" : "Generate metadata"}</Button>
      </form>
      <section className="rounded-2xl border border-cyan-300/12 bg-cyan-300/[.035] p-5 sm:p-6"><h2 className="flex items-center gap-2 font-bold text-cyan-100"><CheckCircle2 className="size-5" />Assistant result</h2>{suggest.data ? <div className="mt-5 space-y-5"><Result label="Title" value={suggest.data.title} /><Result label="Description" value={suggest.data.description} /><div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Tags</p><div className="mt-2 flex flex-wrap gap-2">{suggest.data.tags.map(tag => <span key={tag} className="rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-2.5 py-1 text-xs text-cyan-100">{tag}</span>)}</div></div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Checks</p><ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">{suggest.data.checks.map(check => <li key={check}>• {check}</li>)}</ul></div></div> : <div className="mt-8 text-sm leading-6 text-slate-400">Your real API result will appear here. Nothing is prefilled or fabricated.</div>}</section>
    </div>
  </HkTubeShell>;
}

function Result({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value}</p></div>; }
