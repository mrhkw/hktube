import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import type { Session } from "@supabase/supabase-js";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { ALLOWED_ADMIN_EMAILS } from "@/lib/adminAccess";
import { ArrowLeft, Bot, Code2, Loader2, LockKeyhole, Send, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };
const suggestions = [
  "Review a secure approach for adding a feature to HkTube.",
  "Help debug a TypeScript or React error. I will paste the relevant code.",
  "Draft a small, reviewable unified diff for a code change.",
];

function isApprovedGoogleAdmin(session: Session | null) {
  const user = session?.user;
  if (!user?.email || !ALLOWED_ADMIN_EMAILS.has(user.email.trim().toLowerCase())) return false;
  const providers = user.app_metadata?.providers;
  const isGoogle = user.app_metadata?.provider === "google" || (Array.isArray(providers) && providers.includes("google"));
  return Boolean(isGoogle && user.email_confirmed_at);
}

function NotFound() {
  return <HkTubeShell title="Page not found"><main className="mx-auto max-w-xl px-5 py-24 text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-500">404</p><h1 className="mt-3 text-3xl font-black text-white">Page not found</h1><p className="mt-3 text-sm text-slate-500">The page you requested is unavailable.</p><Link href="/" className="mt-7 inline-flex rounded-full border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/[.06]">Go home</Link></main></HkTubeShell>;
}

export default function AdminAgent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setAuthReady(true); }
    }).catch(() => { if (active) setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending]);

  const authorized = isApprovedGoogleAdmin(session);
  const canSend = useMemo(() => input.trim().length > 0 && input.length <= 6_000 && !pending, [input, pending]);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || pending || !session?.access_token || !authorized) return;
    const next = [...messages, { role: "user" as const, content }].slice(-16);
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/admin-agent/chat", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next }),
      });
      const data = await response.json() as { content?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || "The AI request could not be completed.");
      if (typeof data.content !== "string" || !data.content.trim()) throw new Error("The AI service returned an empty response.");
      setMessages(current => [...current, { role: "assistant" as const, content: data.content!.trim() }].slice(-16));
    } catch (error) {
      setMessages(current => current.slice(0, -1));
      toast.error(error instanceof Error ? error.message : "The AI request could not be completed.");
    } finally { setPending(false); }
  }

  if (!authReady) return <HkTubeShell title=""><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-6 animate-spin text-violet-300" /></div></HkTubeShell>;
  if (!authorized) return <NotFound />;

  function clearChat() { setMessages([]); setInput(""); }

  return <HkTubeShell title="Admin Agent" subtitle="Private engineering copilot">
    <main className="mx-auto flex min-h-[calc(100vh-150px)] max-w-5xl flex-col px-4 pb-5 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Bot className="size-5" /></span><div><div className="flex items-center gap-2"><h1 className="text-xl font-black text-white">Admin AI Agent</h1><span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/[.08] px-2 py-1 text-[10px] font-bold text-emerald-200"><ShieldCheck className="size-3" /> Authorized</span></div><p className="mt-1 text-xs text-slate-500">Signed in as {session?.user.email}</p></div></div>
        <div className="flex gap-2"><Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin/ai"><ArrowLeft className="mr-2 size-4" />AI Center</Link></Button><Button type="button" variant="outline" onClick={clearChat} disabled={!messages.length} className="border-white/10 bg-transparent text-slate-300"><Trash2 className="mr-2 size-4" />Clear chat</Button></div>
      </header>

      <section className="my-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[.045] p-4 text-xs leading-5 text-amber-100/80"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-amber-200" /><p><strong className="text-amber-100">Review before applying.</strong> This copilot can draft code and diffs, but it cannot access or write repository files, run commands, or deploy. Chat is kept only in this page session.</p></section>

      <section className="flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0d16]/70 p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 ? <div className="mx-auto flex min-h-[45vh] max-w-2xl flex-col items-center justify-center text-center"><span className="grid size-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/[.08] text-violet-200"><Code2 className="size-6" /></span><h2 className="mt-5 text-2xl font-black text-white">What should we work on?</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Ask for coding guidance, debugging help, architecture feedback, or a proposed patch. Do not include credentials or API keys.</p><div className="mt-6 grid w-full gap-2 sm:grid-cols-3">{suggestions.map(item => <button key={item} type="button" onClick={() => void sendMessage(item)} className="rounded-2xl border border-white/10 bg-white/[.025] p-3 text-left text-xs leading-5 text-slate-300 transition hover:bg-white/[.06]">{item}</button>)}</div></div> : <div className="mx-auto max-w-3xl space-y-6">{messages.map((message, index) => <article key={`${index}-${message.role}`} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${message.role === "user" ? "bg-white/[.08] text-white" : "bg-violet-500 text-white"}`}>{message.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span><div className="min-w-0 flex-1"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{message.role === "user" ? "You" : "Copilot"}</p><div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{message.content}</div></div></article>)}</div>}
        {pending && <div className="mx-auto mt-6 flex max-w-3xl items-center gap-3 text-sm text-slate-500"><span className="grid size-8 place-items-center rounded-lg bg-violet-500 text-white"><Bot className="size-4" /></span><span className="flex items-center gap-2">Thinking<Loader2 className="size-3.5 animate-spin" /></span></div>}
        <div ref={bottomRef} />
      </section>

      <div className="mx-auto mt-4 w-full max-w-3xl"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-2"><Textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Describe the code task…" maxLength={6_000} disabled={pending} className="min-h-12 resize-none border-0 bg-transparent px-3 py-2 text-white shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[10px] text-slate-600">Enter to send · Shift+Enter for a new line · {input.length}/6,000</span><Button type="button" size="icon" onClick={() => void sendMessage()} disabled={!canSend} aria-label="Send message" className="size-10 rounded-full bg-violet-500 text-white hover:bg-violet-400"><Send className="size-4" /></Button></div></div><p className="mt-2 text-center text-[10px] text-slate-600">AI output can be incorrect. Review all suggested code before applying.</p></div>
    </main>
  </HkTubeShell>;
}
