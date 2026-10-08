import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, Check, PlugZap, ShieldCheck, UserRound } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";

const PROFILE_KEY = "hktube-admin-agent-profile-v1";

export default function AdminAgentSettings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [education, setEducation] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") as { displayName?: string; education?: string; note?: string };
      setDisplayName(value.displayName || user?.name || "");
      setEducation(value.education || "");
      setNote(value.note || "");
    } catch {}
  }, [user?.name]);
  function save() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ displayName: displayName.trim(), education: education.trim(), note: note.trim() }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }
  return <HkTubeShell title="Agent Settings" subtitle="Control the private AI workspace, profile context and connected tools.">
    <main className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <header className="flex items-center gap-3 border-b border-white/10 py-5"><Link href="/admin-agent" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 hover:text-white" aria-label="Back to chat"><ArrowLeft className="size-5" /></Link><span className="grid size-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-200"><Bot className="size-5" /></span><div><h1 className="font-black text-white">AI workspace settings</h1><p className="text-xs text-slate-500">Connected tools, profile context and privacy controls.</p></div></header>
      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/admin-agent" className="rounded-2xl border border-violet-300/20 bg-violet-500/[.05] p-4"><Bot className="size-5 text-violet-200" /><p className="mt-3 font-bold text-white">Chat</p><p className="text-xs text-slate-500">Open your agent workspace</p></Link>
        <Link href="/admin-agent/history" className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><UserRound className="size-5 text-slate-300" /><p className="mt-3 font-bold text-white">History</p><p className="text-xs text-slate-500">Review saved conversations</p></Link>
        <Link href="/admin-agent/apps" className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><PlugZap className="size-5 text-slate-300" /><p className="mt-3 font-bold text-white">Plugins</p><p className="text-xs text-slate-500">Manage connected services</p></Link>
      </section>
      <section className="mt-5 rounded-3xl border border-white/10 bg-[#0b0d16]/75 p-5">
        <div className="flex items-start gap-3"><UserRound className="mt-1 size-5 text-violet-200" /><div><h2 className="font-bold text-white">Agent profile context</h2><p className="mt-1 text-xs leading-5 text-slate-500">Optional local context for this device. Keep secrets, passwords and API keys out of these fields.</p></div></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">Display name</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/40" placeholder="Your name" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-300">Education / role</span><input value={education} onChange={e=>setEducation(e.target.value)} maxLength={120} className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/40" placeholder="Student, creator, developer..." /></label>
        </div>
        <label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-300">Personal note</span><textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} className="min-h-24 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/40" placeholder="Preferences or non-sensitive context..." /></label>
        <div className="mt-4 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck className="size-3.5 text-emerald-300" />Stored locally on this device, not sent as credentials.</p><Button onClick={save} className="bg-violet-500 text-white hover:bg-violet-400">{saved ? <Check className="mr-2 size-4" /> : null}{saved ? "Saved" : "Save profile"}</Button></div>
      </section>
      <section className="mt-5 rounded-2xl border border-amber-300/10 bg-amber-400/[.04] p-4 text-xs leading-5 text-amber-100/70">Profile notes are user-entered context, not verified claims. Keep identity-sensitive or health/mental-health information out of the agent profile.</section>
    </main>
  </HkTubeShell>;
}
