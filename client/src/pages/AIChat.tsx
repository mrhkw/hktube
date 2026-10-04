import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestAIChat, supabase } from "@/lib/supabase";
import { buildAndroidChromeIntent, rememberPostLoginPath } from "@/lib/authFlow";
import { isAllowlistedAdminUser } from "@/lib/adminAccess";
import { Bot, Code2, Copy, Loader2, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type AISource = { title: string; url: string; snippet: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; sources?: AISource[] };
const suggestions = [
  "HkTube par apna channel grow karne ka plan banao.",
  "Mere video ke liye title, description aur tags suggest karo.",
  "Mujhe YouTube-style Shorts ke liye 5 ideas do.",
  "Mujhe simple Roman Urdu mein AI samjhao.",
];

function loadMessages(storageKey: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChatMessage => !!item && typeof item === "object" && typeof item.id === "string" && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map(item => ({ id: item.id, role: item.role, content: item.content.slice(0, 6_000), ...(Array.isArray(item.sources) ? { sources: item.sources.filter(source => source && typeof source.title === "string" && typeof source.url === "string" && typeof source.snippet === "string") } : {}) }))
      .slice(-40);
  } catch { return []; }
}

function isAndroidWebView() {
  const userAgent = navigator.userAgent;
  return new URLSearchParams(window.location.search).get("app") === "android" || (/android/i.test(userAgent) && /;\s*wv\)|version\/4\.0/i.test(userAgent));
}

export default function AIChat() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [reauthRequired, setReauthRequired] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<{ prompt: string; message: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const chatEpochRef = useRef(0);
  const isAndroid = isAndroidWebView();
  const storageKey = session?.user.id ? `hktube-ai-chat-v2:${session.user.id}` : null;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let current = (await supabase.auth.getSession()).data.session;
        if (current?.expires_at && current.expires_at * 1000 < Date.now() + 60_000) {
          const refreshed = await supabase.auth.refreshSession();
          current = refreshed.error ? null : refreshed.data.session;
        }
        if (active) { setSession(current); setAuthReady(true); }
      } catch { if (active) { setSession(null); setAuthReady(true); } }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession) setReauthRequired(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    chatEpochRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    pendingRef.current = false;
    setPending(false);
    setMessages(storageKey ? loadMessages(storageKey) : []);
    setFailedPrompt(null);
    setReauthRequired(false);
  }, [storageKey]);
  useEffect(() => { if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40))); } catch (error) { console.warn("[AIChat] Could not persist this chat in browser storage.", error); } } }, [messages, storageKey]);
  useEffect(() => () => requestControllerRef.current?.abort(), []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pending]);

  const canSend = useMemo(() => input.trim().length > 0 && !pending && !reauthRequired, [input, pending, reauthRequired]);

  async function continueWithGoogle() {
    setGooglePending(true);
    try {
      if (isAndroid) {
        const browserLogin = new URL("/auth", window.location.origin);
        browserLogin.searchParams.set("next", "/ai");
        browserLogin.searchParams.set("reauth", "1");
        window.location.href = buildAndroidChromeIntent(browserLogin);
        return;
      }
      rememberPostLoginPath("/ai");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in could not start.");
      setGooglePending(false);
    }
  }

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || pendingRef.current || !session || reauthRequired) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const next = [...messages, userMessage].slice(-20);
    const epoch = chatEpochRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    pendingRef.current = true;
    setMessages(next);
    setInput("");
    setPending(true);
    setFailedPrompt(null);
    try {
      const requestMessages = [...next];
      while (requestMessages.length > 20 || requestMessages.reduce((total, message) => total + message.content.length, 0) > 24_000) {
        if (requestMessages.length <= 1) break;
        requestMessages.shift();
      }
      const result = await requestAIChat(requestMessages.map(({ role, content: value }) => ({ role, content: value })), controller.signal);
      if (epoch !== chatEpochRef.current || controller.signal.aborted) return;
      setMessages(current => [...current, { id: crypto.randomUUID(), role: "assistant" as const, content: result.content, sources: result.sources }].slice(-40));
    } catch (error) {
      if (controller.signal.aborted || epoch !== chatEpochRef.current) return;
      setMessages(current => current.filter(message => message.id !== userMessage.id));
      const message = error instanceof Error ? error.message : "AI response nahi aa saki. Dobara try karein.";
      const status = (error as Error & { status?: number }).status;
      if (status === 401 || status === 403 || /10001|unauthorized|sign in with google|session.*(expired|unavailable|reconnect)/i.test(message)) {
        setReauthRequired(true);
        toast.error("Gmail session dobara connect karein; aapki chat history is browser mein mehfooz rahegi.");
      } else {
        setFailedPrompt({ prompt: content, message });
        toast.error(message);
      }
    } finally {
      if (epoch === chatEpochRef.current) {
        pendingRef.current = false;
        requestControllerRef.current = null;
        setPending(false);
      }
    }
  }

  function clearChat() {
    chatEpochRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    pendingRef.current = false;
    setPending(false);
    setMessages([]);
    setInput("");
    setFailedPrompt(null);
    if (storageKey) { try { localStorage.removeItem(storageKey); } catch (error) { console.warn("[AIChat] Could not clear browser chat storage.", error); } }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
    catch { toast.error("Copy nahi ho saka."); }
  }

  if (!authReady) return <HkTubeShell title="HkTube AI"><div className="grid min-h-[60vh] place-items-center"><Loader2 className="size-7 animate-spin text-violet-500" /></div></HkTubeShell>;
  if (!session) return <HkTubeShell title="HkTube AI"><div className="mx-auto max-w-lg px-5 py-16 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-black text-white"><Bot className="size-8" /></span><h1 className="mt-6 text-3xl font-black">HkTube AI</h1><p className="mt-3 text-sm leading-6 text-slate-500">ChatGPT-style conversational AI for HkTube. Google sign-in creates the session this AI endpoint securely verifies.</p><Button disabled={googlePending} onClick={() => void continueWithGoogle()} className="mt-6 rounded-full bg-black px-6 text-white hover:bg-zinc-800">{googlePending ? "Opening Google…" : isAndroid ? "Continue with Google in Chrome" : "Continue with Google"}</Button>{isAndroid && <p className="mt-3 text-xs leading-5 text-amber-700">Use HkTube in Chrome after sign-in unless verified Android App Links are configured; WebView and Chrome sessions are separate.</p>}<Link href="/auth?next=%2Fai" className="mt-4 block text-sm text-slate-500 underline">Use email and password</Link></div></HkTubeShell>;

  return <HkTubeShell title="HkTube AI" subtitle="Ask questions, brainstorm, write and learn.">
    <div className="mx-auto flex min-h-[calc(100vh-150px)] max-w-6xl flex-col px-3 pb-4 sm:px-5">
      <header className="flex items-center justify-between border-b border-white/8 py-3">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500 text-white"><Sparkles className="size-5" /></span><div><h1 className="font-black text-white">HkTube AI</h1><p className="text-[11px] text-slate-500">Conversational assistant · Gmail session connected</p></div></div>
        <div className="flex gap-2">{isAllowlistedAdminUser(session.user) && <Link href="/admin-agent" className="inline-flex items-center rounded-lg border border-violet-300/20 bg-violet-400/[.08] px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-400/15"><Code2 className="mr-2 size-4" />Private Admin Agent</Link>}<Link href="/studio/ai" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/[.06] sm:inline-flex">Creator AI</Link><Button variant="outline" onClick={clearChat} className="border-white/10 bg-transparent text-slate-300 hover:bg-white/[.06]"><Trash2 className="mr-2 size-4" />New chat</Button></div>
      </header>
      {reauthRequired && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[.07] p-3 text-sm text-amber-100"><span>Gmail session needs reconnecting. On Android, Google opens securely in Chrome.</span><Button type="button" disabled={googlePending} onClick={() => void continueWithGoogle()} className="rounded-full bg-amber-200 px-4 text-xs font-bold text-amber-950 hover:bg-amber-100">{googlePending ? "Opening…" : "Reconnect Gmail"}</Button></div>}
      <div className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? <div className="mx-auto flex min-h-[55vh] max-w-3xl flex-col items-center justify-center text-center"><span className="grid size-16 place-items-center rounded-2xl bg-white/[.06] text-violet-300"><Bot className="size-8" /></span><h2 className="mt-5 text-3xl font-black text-white">How can I help?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">HkTube AI se general questions, content ideas, writing, summaries aur creator help pooch sakte ho.</p><div className="mt-7 grid w-full gap-2 sm:grid-cols-2">{suggestions.map(item => <button key={item} type="button" disabled={pending || reauthRequired} onClick={() => void sendMessage(item)} className="rounded-2xl border border-white/8 bg-white/[.025] p-4 text-left text-sm text-slate-300 transition hover:bg-white/[.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50">{item}</button>)}</div></div> :
          <div className="mx-auto max-w-3xl space-y-7">{messages.map(message => <article key={message.id} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${message.role === "user" ? "bg-white/[.08] text-white" : "bg-violet-500 text-white"}`}>{message.role === "user" ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span><div className="min-w-0 flex-1"><div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-200">{message.content}</div>{message.role === "assistant" && <button type="button" onClick={() => void copy(message.content)} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white/[.05] hover:text-white"><Copy className="size-3.5" />Copy</button>}</div></article>)}</div>}
        {pending && <div className="mx-auto mt-6 flex max-w-3xl items-center gap-3 text-sm text-slate-500"><span className="grid size-8 place-items-center rounded-lg bg-violet-500 text-white"><Bot className="size-4" /></span><span className="flex items-center gap-1">HkTube AI is thinking<Loader2 className="ml-1 size-3.5 animate-spin" /></span></div>}
        {failedPrompt && !pending && <div className="mx-auto mt-6 flex max-w-3xl items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[.06] px-4 py-3 text-xs text-amber-100/80"><span>{failedPrompt.message}</span><Button type="button" size="sm" variant="outline" onClick={() => void sendMessage(failedPrompt.prompt)} className="shrink-0 border-amber-200/30 bg-transparent text-amber-100 hover:bg-amber-200/10">Retry</Button></div>}
        <div ref={bottomRef} />
      </div>
      <div className="mx-auto w-full max-w-3xl"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-2 shadow-2xl"><Textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Message HkTube AI..." maxLength={6000} disabled={pending || reauthRequired} className="min-h-12 resize-none border-0 bg-transparent px-3 py-2 text-white shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between px-2 pb-1"><span className="text-[11px] text-slate-600">Enter to send · Shift+Enter for new line</span><Button type="button" size="icon" onClick={() => void sendMessage()} disabled={!canSend} className="size-10 rounded-full bg-violet-500 text-white hover:bg-violet-400"><Send className="size-4" /></Button></div></div><p className="mt-2 text-center text-[10px] text-slate-600">AI responses can be inaccurate. Verify important information.</p></div>
    </div>
  </HkTubeShell>;
}
