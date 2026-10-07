import { Bot, CheckCircle2, Clock3, ExternalLink, History, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { AI_MANAGER_CONNECTORS } from "@/lib/aiManagerConnectors";

const managerCapabilities = [
  { name: "AI chat + persistent history", state: "Active", href: "/admin-agent", icon: History },
  { name: "Connected Apps", state: `${AI_MANAGER_CONNECTORS.length} connector definitions`, href: "/admin-agent/apps", icon: PlugZap },
  { name: "Web research", state: "Active", href: "/admin-agent", icon: ExternalLink },
  { name: "Owner approval controls", state: "Active", href: "/admin-agent", icon: ShieldCheck },
];

export default function AdminAgentManager() {
  return (
    <HkTubeShell title="Advanced AI Manager" subtitle="Agent tools, connections, approvals and verified task execution">
      <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200"><Sparkles className="size-6" /></span>
            <div>
              <h1 className="text-2xl font-black text-white">Advanced AI Manager</h1>
              <p className="text-sm text-slate-500">One existing HkTube Agent, with its tools and app connections managed from here.</p>
            </div>
          </div>
          <Button asChild className="bg-violet-500 text-white hover:bg-violet-400"><Link href="/admin-agent"><Bot className="mr-2 size-4" />Open Agent</Link></Button>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {managerCapabilities.map(item => {
            const Icon = item.icon;
            return <Link key={item.name} href={item.href} className="rounded-2xl border border-white/10 bg-[#0b0d16]/80 p-4 transition hover:border-violet-300/20 hover:bg-white/[.04]">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-white/[.04] text-violet-200"><Icon className="size-5" /></span>
                <div className="min-w-0"><p className="font-bold text-white">{item.name}</p><p className="text-xs text-slate-500">{item.state}</p></div>
                <CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-300" />
              </div>
            </Link>;
          })}
        </section>

        <section className="mt-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-200" />
            <div>
              <h2 className="font-bold text-white">No fake execution</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">The manager must only report a task as completed after an actual tool action and verification. Provider connections that have not completed authorization remain unavailable to the agent.</p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-[#0b0d16]/80 p-5">
          <div className="flex items-center gap-3"><Clock3 className="size-5 text-cyan-200" /><div><h2 className="font-bold text-white">Connector architecture</h2><p className="text-xs text-slate-500">Each provider has its own connection, permissions and approval boundary.</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {AI_MANAGER_CONNECTORS.slice(0, 18).map(item => <span key={item.id} className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-slate-400">{item.name}</span>)}
            <Link href="/admin-agent/apps" className="rounded-full border border-violet-300/20 bg-violet-400/[.08] px-3 py-1.5 text-xs font-bold text-violet-200">View all {AI_MANAGER_CONNECTORS.length}</Link>
          </div>
        </section>
      </main>
    </HkTubeShell>
  );
}
