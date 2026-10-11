import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import type { Session } from "@supabase/supabase-js";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { connectGmailWithGoogle, getAIConversation, getAIHistory, requestAIChat, supabase } from "@/lib/supabase";
import { isAllowlistedAdminUser } from "@/lib/adminAccess";
import { ArrowLeft, Bot, Check, Code2, Copy, Expand, Loader2, LockKeyhole, Mail, MessageSquare, PanelLeft, PlugZap, Plus, Search, Send, Share2, ShieldCheck, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string; sources?: Array<{ title: string; url: string; snippet: string }>; connectorAction?: { id: string; label: string; href: string } };
type ChatConversation = { id: string; title: string; module: string; created_at: string; updated_at: string };
const suggestions = [
  "Review a secure approach for adding a feature to HkTube.",
  "Help debug a TypeScript or React error. I will paste the relevant code.",
  "Draft a small, reviewable unified diff for a code change.",
];

function isApprovedGoogleAdmin(session: Session | null) {
  return isAllowlistedAdminUser(session?.user);
}

function AdminAccessGate({ session }: { session: Session | null }) {
  const signedIn = Boolean(session?.user);
  return <HkTubeShell title="Admin Agent"><main className="mx-auto max-w-xl px-5 py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><ShieldCheck className="size-6" /></span><h1 className="mt-5 text-3xl font-black text-white">Admin access</h1><p className="mt-3 text-sm leading-6 text-slate-400">{signedIn ? "This signed-in email is not on the HkTube admin allowlist." : "Sign in once with an authorized Google account. HkTube will remember the active session automatically."}</p>{signedIn ? <p className="mt-3 text-xs text-slate-500">Signed in as {session?.user.email ?? "unknown account"}</p> : <Button asChild className="mt-7 bg-violet-500 text-white hover:bg-violet-400"><Link href="/auth">Sign in with Google</Link></Button>}<div className="mt-5"><Link href="/" className="text-xs font-bold text-slate-500 hover:text-slate-300">Go home</Link></div></main></HkTubeShell>;
}

export default function AdminAgent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState(() => localStorage.getItem("hktube-agent-memory") !== "disabled");
  const [focusMode, setFocusMode] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const epochRef = useRef(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await supabase.auth.getSession();
        let nextSession = current.data.session;
        const expiresAt = nextSession?.expires_at ?? 0;
        if (nextSession && expiresAt > 0 && expiresAt * 1000 < Date.now() + 60_000) {
          nextSession = (await supabase.auth.refreshSession()).data.session ?? null;
        }
        if (active) { setSession(nextSession); setAuthReady(true); }
      } catch { if (active) { setSession(null); setAuthReady(true); } }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending]);

  const authorized = isApprovedGoogleAdmin(session);
  useEffect(() => { if (!authorized) return; void getAIHistory().then(value => setConversations(value.conversations ?? [])).catch(() => undefined); }, [authorized]);
  const canSend = useMemo(() => input.trim().length > 0 && input.length <= 6_000 && !pending, [input, pending]);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || pendingRef.current || !authorized) return;
    const next = [...messages, { role: "user" as const, content }].slice(-16);
    const epoch = epochRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    pendingRef.current = true;
    setMessages(next);
    setInput("");
    setPending(true);
    setFailedPrompt(null);
    try {
      const data = await requestAIChat(next.map(({ role, content: text }) => ({ role, content: text })), controller.signal, [], undefined, memoryEnabled);
      if (epoch !== epochRef.current || controller.signal.aborted) return;
      setMessages(current => [...current, { role: "assistant" as const, content: data.content, sources: data.sources, connectorAction: data.connectorAction }].slice(-16));
      void getAIHistory().then(value => setConversations(value.conversations ?? [])).catch(() => undefined);
    } catch (error) {
      if (controller.signal.aborted || epoch !== epochRef.current) return;
      setMessages(current => current.slice(0, -1));
      const message = error instanceof Error ? error.message : "The AI request could not be completed. Please retry.";
      setFailedPrompt(content);
      toast.error(message);
    } finally {
      if (epoch === epochRef.current) {
        pendingRef.current = false;
        controllerRef.current = null;
        setPending(false);
      }
    }
  }

  if (!authReady) return <HkTubeShell title=""><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-6 animate-spin text-violet-300" /></div></HkTubeShell>;
  if (!authorized) return <AdminAccessGate session={session} />;

  function clearChat() {
    epochRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    pendingRef.current = false;
    setPending(false);
    setMessages([]);
    setActiveConversationId(null);
    setInput("");
    setFailedPrompt(null);
  }

  async function connectGmail() {
    const error = await connectGmailWithGoogle();
    if (error) toast.error(error.message);
  }
  async function copyAnswer(content: string, index: number) {
    try { await navigator.clipboard.writeText(content); setCopiedIndex(index); toast.success("Answer copied to clipboard."); window.setTimeout(() => setCopiedIndex(current => current === index ? null : current), 1600); }
    catch { toast.error("Clipboard access was blocked by the browser."); }
  }
  async function shareAnswer(content: string, index: number) {
    if (navigator.share) { try { await navigator.share({ title: "HkTube AI answer", text: content }); return; } catch { return; } }
    await copyAnswer(content, index);
  }
  async function reopenConversation(id: string) {
    try {
      const value = await getAIConversation(id);
      setMessages(value.messages.map(message => ({ role: message.role, content: message.content, sources: Array.isArray(message.metadata?.sources) ? message.metadata.sources as ChatMessage["sources"] : undefined })));
      setActiveConversationId(id);
      toast.success("Conversation reopened.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Conversation load nahi ho saki."); }
  }
  const visibleConversations = conversations.filter(item => !historyQuery.trim() || item.title.toLowerCase().includes(historyQuery.trim().toLowerCase()));

  return <HkTubeShell title="Admin Agent" subtitle="Private HkTube AI workspace">
    <main className={`mx-auto flex min-h-[calc(100vh-150px)] flex-col px-4 pb-5 sm:px-6 ${focusMode ? "max-w-none" : "max-w-7xl"}`}>
      <header className="flex flex-col gap-4 border-b border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Bot className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black text-white">Admin AI Agent</h1><span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/[.08] px-2 py-1 text-[10px] font-bold text-emerald-200"><ShieldCheck className="size-3" /> Session active</span><span className="rounded-full border border-cyan-300/20 bg-cyan-400/[.06] px-2 py-1 text-[10px] font-bold text-cyan-200">Memory + web context</span></div><p className="mt-1 text-xs text-slate-500">Signed in as {session?.user.email} · one login, automatic token refresh</p></div></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setFocusMode(value => !value)} className="border-white/10 bg-transparent text-slate-300">{focusMode ? <X className="mr-2 size-4" /> : <Expand className="mr-2 size-4" />}{focusMode ? "Exit focus" : "Full screen"}</Button><Button type="button" variant="outline" onClick={() => setHistoryOpen(value => !value)} className="border-white/10 bg-transparent text-slate-300"><PanelLeft className="mr-2 size-4" />History</Button><Button asChild variant="outline" className="border-violet-300/20 bg-violet-400/[.06] text-violet-100"><Link href="/admin-agent/apps"><PlugZap className="mr-2 size-4" />Connected Apps</Link></Button><Button type="button" variant="outline" onClick={() => void connectGmail()} className="border-emerald-300/20 bg-emerald-400/[.06] text-emerald-100"><Mail className="mr-2 size-4" />Connect Gmail</Button><Button type="button" variant="outline" onClick={() => { const next = !memoryEnabled; setMemoryEnabled(next); localStorage.setItem("hktube-agent-memory", next ? "enabled" : "disabled"); toast.success(`Persistent memory ${next ? "enabled" : "disabled"}.`); }} className="border-cyan-300/20 bg-cyan-400/[.06] text-cyan-100">Memory {memoryEnabled ? "ON" : "OFF"}</Button><Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin/ai"><ArrowLeft className="mr-2 size-4" />AI Center</Link></Button><Button type="button" variant="outline" onClick={clearChat} disabled={!messages.length} className="border-white/10 bg-transparent text-slate-300"><Trash2 className="mr-2 size-4" />Clear chat</Button></div>
      </header>

      <section className="my-5 grid gap-3 sm:grid-cols-2"><Link href="/admin-agent/apps" className="rounded-2xl border border-violet-300/20 bg-violet-400/[.055] p-4 transition hover:bg-violet-400/[.09]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><PlugZap className="size-5" /></span><div><p className="font-bold text-white">Connected Apps</p><p className="text-xs text-slate-400">56 app connectors with per-app authorization</p></div></div></Link><Link href="/admin-agent/apps" className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[.045] p-4 transition hover:bg-cyan-400/[.08]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-200"><Sparkles className="size-5" /></span><div><p className="font-bold text-white">Advanced AI Manager</p><p className="text-xs text-slate-400">Tools, research, permissions and verified execution</p></div></div></Link></section><section className="my-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[.045] p-4 text-xs leading-5 text-amber-100/80"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-amber-200" /><p><strong className="text-amber-100">Owner controls.</strong> Connect Gmail above to let this AI search your inbox and read matching threads. Email sending will remain a separate approval action. It still cannot silently change code, deploy, delete data, or spend money.</p></section>

      <div className="mt-5 flex min-h-0 flex-1 gap-4">
        {historyOpen && <aside className="hidden w-64 shrink-0 flex-col rounded-3xl border border-white/10 bg-[#0b0d16]/80 p-3 lg:flex"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Chat history</p><Button type="button" size="icon" variant="ghost" onClick={() => { clearChat(); setHistoryOpen(false); }} aria-label="New chat" className="size-8 text-slate-300"><Plus className="size-4" /></Button></div><div className="relative mt-3"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-600" /><input value={historyQuery} onChange={event => setHistoryQuery(event.target.value)} placeholder="Search chats" className="h-9 w-full rounded-xl border border-white/10 bg-white/[.04] pl-8 pr-2 text-xs text-white outline-none" /></div><div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">{visibleConversations.map(item => <button key={item.id} type="button" onClick={() => void reopenConversation(item.id)} className={`w-full rounded-xl border px-3 py-2 text-left transition ${activeConversationId === item.id ? "border-violet-300/30 bg-violet-400/10" : "border-transparent hover:border-white/10 hover:bg-white/[.04]"}`}><span className="flex items-start gap-2"><MessageSquare className="mt-0.5 size-3.5 shrink-0 text-violet-300" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-200">{item.title || "New conversation"}</span><span className="mt-1 block text-[10px] text-slate-600">{new Date(item.updated_at).toLocaleDateString()}</span></span></span></button>)}{!visibleConversations.length && <p className="px-2 py-8 text-center text-xs text-slate-600">No saved chats</p>}</div></aside>}
        <section className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0d16]/70 p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 ? <div className="mx-auto flex min-h-[45vh] max-w-2xl flex-col items-center justify-center text-center"><span className="grid size-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/[.08] text-violet-200"><Code2 className="size-6" /></span><h2 className="mt-5 text-2xl font-black text-white">What should we work on?</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Ask for coding guidance, debugging help, architecture feedback, or a proposed patch. Do not include credentials or API keys.</p><div className="mt-6 grid w-full gap-2 sm:grid-cols-3">{suggestions.map(item => <button key={item} type="button" disabled={pending} onClick={() => void sendMessage(item)} className="rounded-2xl border border-white/10 bg-white/[.025] p-3 text-left text-xs leading-5 text-slate-300 transition hover:bg-white/[.06] disabled:opacity-50">{item}</button>)}</div></div> : <div className={`${focusMode ? "mx-auto w-full max-w-5xl" : "mx-auto max-w-3xl"} space-y-6`}>{messages.map((message, index) => <article key={`${index}-${message.role}`} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${message.role === "user" ? "bg-white/[.08] text-white" : "bg-violet-500 text-white"}`}>{message.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span><div className="min-w-0 flex-1"><p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{message.role === "user" ? "You" : "Copilot"}</p><div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200">{message.content}</div>{message.sources?.length ? <div className="mt-3 rounded-xl border border-cyan-300/15 bg-cyan-400/[.04] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">Verified sources</p><div className="mt-2 space-y-1.5">{message.sources.slice(0, 6).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-cyan-100 underline decoration-cyan-300/30 underline-offset-2 hover:text-white">{source.title}</a>)}</div></div> : null}{message.connectorAction && <Link href={message.connectorAction.href} className="mt-3 inline-flex rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100">{message.connectorAction.label}</Link>}{message.role === "assistant" && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-2"><Button type="button" size="sm" variant="ghost" onClick={() => void copyAnswer(message.content, index)} className="h-8 px-2 text-xs text-slate-400 hover:text-white">{copiedIndex === index ? <Check className="mr-1.5 size-3.5 text-emerald-300" /> : <Copy className="mr-1.5 size-3.5" />}{copiedIndex === index ? "Copied" : "Copy"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => void shareAnswer(message.content, index)} className="h-8 px-2 text-xs text-slate-400 hover:text-white"><Share2 className="mr-1.5 size-3.5" />Share</Button></div>}</div></article>)}</div>}
        {pending && <div className="mx-auto mt-6 flex max-w-3xl items-center gap-3 text-sm text-slate-500"><span className="grid size-8 place-items-center rounded-lg bg-violet-500 text-white"><Bot className="size-4" /></span><span className="flex items-center gap-2">Thinking<Loader2 className="size-3.5 animate-spin" /></span></div>}
        {failedPrompt && !pending && <div className="mx-auto mt-6 flex max-w-3xl justify-end"><Button type="button" size="sm" variant="outline" onClick={() => void sendMessage(failedPrompt)} className="border-amber-200/30 bg-transparent text-amber-100">Retry last request</Button></div>}
        <div ref={bottomRef} />
        </section>
      </div>

      <div className="mx-auto mt-4 w-full max-w-3xl"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-2"><Textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Describe the code task…" maxLength={6_000} disabled={pending} className="min-h-12 resize-none border-0 bg-transparent px-3 py-2 text-white shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[10px] text-slate-600">Enter to send · Shift+Enter for a new line · {input.length}/6,000</span><Button type="button" size="icon" onClick={() => void sendMessage()} disabled={!canSend} aria-label="Send message" className="size-10 rounded-full bg-violet-500 text-white hover:bg-violet-400"><Send className="size-4" /></Button></div></div><p className="mt-2 text-center text-[10px] text-slate-600">AI output can be incorrect. Review all suggested code before applying.</p></div>
    </main>
  </HkTubeShell>;
}
