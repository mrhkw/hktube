import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Bot, Copy, Loader2, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
const STORAGE_KEY = "hktube-ai-chat-v1";
const suggestions = [
  "HkTube par apna channel grow karne ka plan banao.",
  "Mere video ke liye title, description aur tags suggest karo.",
  "Mujhe YouTube-style Shorts ke liye 5 ideas do.",
  "Mujhe simple Roman Urdu mein AI samjhao.",
];

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch { return []; }
}

export default function AIChat() {
  const { isAuthenticated, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chat = trpc.ai.chat.useMutation();

  useEffect(() => { if (isAuthenticated) setMessages(loadMessages()); }, [isAuthenticated]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending]);

  const canSend = useMemo(() => input.trim().length > 0 && !pending, [input, pending]);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || pending) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const next = [...messages, userMessage].slice(-20);
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const result = await chat.mutateAsync({
        messages: next.map(({ role, content: value }) => ({ role, content: value })),
      });
      setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant", content: result.content }].slice(-40));
    } catch (error) {
      setMessages(current => current.filter(message => message.id !== userMessage.id));
      toast.error(error instanceof Error ? error.message : "AI response nahi aa saki.");
    } finally { setPending(false); }
  }

  function clearChat() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
    catch { toast.error("Copy nahi ho saka."); }
  }

  if (loading) return <HkTubeShell title="HkTube AI"><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-500" /></div></HkTubeShell>;
  if (!isAuthenticated) return <HkTubeShell title="HkTube AI"><div className="mx-auto max-w-lg px-5 py-16 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-black text-white"><Bot className="size-8" /></span><h1 className="mt-6 text-3xl font-black">HkTube AI</h1><p className="mt-3 text-sm leading-6 text-slate-500">ChatGPT-style conversational AI for HkTube. Sign in to start a private conversation.</p><Button onClick={startLogin} className="mt-6 rounded-full bg-black px-6 text-white hover:bg-zinc-800">Sign in</Button></div></HkTubeShell>;

  return <HkTubeShell title="HkTube AI" subtitle="Ask questions, brainstorm, write and learn.">
    <div className="mx-auto flex min-h-[calc(100vh-150px)] max-w-6xl flex-col px-3 pb-4 sm:px-5">
      <header className="flex items-center justify-between border-b border-white/8 py-3">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500 text-white"><Sparkles className="size-5" /></span><div><h1 className="font-black text-white">HkTube AI</h1><p className="text-[11px] text-slate-500">Conversational assistant</p></div></div>
        <div className="flex gap-2"><Link href="/studio/ai" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[.06] sm:inline-flex">Creator AI</Link><Button variant="outline" onClick={clearChat} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/[.06]"><Trash2 className="mr-2 size-4" />New chat</Button></div>
      </header>
      <div className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? <div className="mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center text-center"><span className="grid size-16 place-items-center rounded-2xl bg-white/[.06] text-violet-300"><Bot className="size-8" /></span><h2 className="mt-5 text-3xl font-black text-white">How can I help?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">HkTube AI se general questions, content ideas, writing, summaries aur creator help pooch sakte ho.</p><div className="mt-7 grid w-full gap-2 sm:grid-cols-2">{suggestions.map(item => <button key={item} type="button" onClick={() => void sendMessage(item)} className="rounded-2xl border border-white/8 bg-white/[.025] p-4 text-left text-sm text-slate-300 transition hover:bg-white/[.06] hover:text-white">{item}</button>)}</div></div> :
          <div className="mx-auto max-w-3xl space-y-7">{messages.map(message => <article key={message.id} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${message.role === "user" ? "bg-white/[.08] text-white" : "bg-violet-500 text-white"}`}>{message.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span><div className="min-w-0 flex-1"><div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-200">{message.content}</div>{message.role === "assistant" && <button type="button" onClick={() => void copy(message.content)} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white/[.05] hover:text-white"><Copy className="size-3.5" />Copy</button>}</div></article>)}</div>}
        {pending && <div className="mx-auto mt-6 flex max-w-3xl items-center gap-3 text-sm text-slate-500"><span className="grid size-8 place-items-center rounded-lg bg-violet-500 text-white"><Bot className="size-4" /></span><span className="flex items-center gap-1">HkTube AI is thinking<Loader2 className="ml-1 size-3.5 animate-spin" /></span></div>}
        <div ref={bottomRef} />
      </div>
      <div className="mx-auto w-full max-w-3xl"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-2 shadow-2xl"><Textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message HkTube AI..." maxLength={6000} disabled={pending} className="min-h-12 resize-none border-0 bg-transparent px-3 py-2 text-white shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[11px] text-slate-600">Enter to send · Shift+Enter for new line</span><Button type="button" size="icon" onClick={() => void sendMessage()} disabled={!canSend} className="size-10 rounded-full bg-violet-500 text-white hover:bg-violet-400"><Send className="size-4" /></Button></div></div><p className="mt-2 text-center text-[10px] text-slate-600">AI responses can be inaccurate. Verify important information.</p></div>
    </div>
  </HkTubeShell>;
}
