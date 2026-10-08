import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, Clock3, MessageSquare, Trash2 } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; createdAt: string; updatedAt: string; messages: ChatMessage[] };
const STORAGE_KEY = "hktube-admin-agent-history-v1";

export default function AdminAgentHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ChatSession[];
      setSessions(Array.isArray(parsed) ? parsed : []);
    } catch { setSessions([]); }
  }, []);
  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setSessions([]);
  }
  return <HkTubeShell title="Agent History" subtitle="Your private Admin Agent conversations on this device.">
    <main className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <header className="flex items-center justify-between border-b border-white/10 py-5">
        <div className="flex items-center gap-3"><Link href="/admin-agent" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 hover:text-white" aria-label="Back to chat"><ArrowLeft className="size-5" /></Link><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Clock3 className="size-5" /></span><div><h1 className="font-black text-white">Chat history</h1><p className="text-xs text-slate-500">{sessions.length} saved conversation{sessions.length === 1 ? "" : "s"}</p></div></div>
        <Button variant="outline" onClick={clearHistory} disabled={!sessions.length} className="border-white/10 bg-transparent text-slate-300"><Trash2 className="mr-2 size-4" />Clear history</Button>
      </header>
      <section className="mt-5 space-y-3">
        {!sessions.length ? <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><Bot className="mx-auto size-8 text-violet-300" /><p className="mt-4 font-bold text-white">No saved chats yet</p><p className="mt-1 text-sm text-slate-500">New Admin Agent conversations will appear here.</p><Link href="/admin-agent" className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white">Open chat</Link></div> : sessions.map(session => <Link key={session.id} href="/admin-agent" className="block rounded-2xl border border-white/10 bg-[#0b0d16]/75 p-4 transition hover:border-violet-300/25 hover:bg-violet-500/[.04]"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-200"><MessageSquare className="size-4" /></span><div className="min-w-0 flex-1"><h2 className="truncate font-bold text-white">{session.title || "New conversation"}</h2><p className="mt-1 text-xs text-slate-500">{new Date(session.updatedAt).toLocaleString()} · {session.messages.length} messages</p><p className="mt-2 line-clamp-2 text-sm text-slate-400">{session.messages.find(message => message.role === "user")?.content || "No user message"}</p></div></div></Link>)}
      </section>
    </main>
  </HkTubeShell>;
}
