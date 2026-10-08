import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, ExternalLink, KeyRound, Loader2, Search, ShieldCheck, Unplug } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { connectOAuthProvider, supabase } from "@/lib/supabase";
import { AI_MANAGER_CONNECTORS, CONNECTOR_CATEGORIES, type ConnectorCategory } from "@/lib/aiManagerConnectors";

const categoryLabels: Record<ConnectorCategory, string> = { AI: "AI & Agent", Communication: "Communication", Content: "Content & Social", Commerce: "Commerce", Data: "Data", Developer: "Developer", Finance: "Finance", Marketing: "Marketing", Productivity: "Productivity", Storage: "Storage", Infrastructure: "Infrastructure", Automation: "Automation" };
const googleScopes: Record<string, string> = {
  gmail: "https://www.googleapis.com/auth/gmail.modify",
  "google-drive": "https://www.googleapis.com/auth/drive",
  "google-docs": "https://www.googleapis.com/auth/documents",
  "google-sheets": "https://www.googleapis.com/auth/spreadsheets",
  "google-calendar": "https://www.googleapis.com/auth/calendar",
  youtube: "https://www.googleapis.com/auth/youtube.readonly",
  "google-analytics": "https://www.googleapis.com/auth/analytics.readonly",
  "search-console": "https://www.googleapis.com/auth/webmasters.readonly",
};
export default function AdminAgentApps() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  useEffect(() => {
    let active = true;
    const readSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) setGoogleConnected(Boolean((data.session as (typeof data.session & { provider_token?: string | null }) | null)?.provider_token));
    };
    void readSession();
    const { data } = supabase.auth.onAuthStateChange(() => { void readSession(); });
    const connected = new URLSearchParams(window.location.search).get("connected");
    if (connected) toast.success(`${connected === "google" || connected === "gmail" ? "Google" : connected} authorization returned to HkTube.`);
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AI_MANAGER_CONNECTORS.filter(item => (category === "All" || item.category === category) && (!q || [item.name, item.category, item.auth, ...item.capabilities, ...item.agentUses].join(" ").toLowerCase().includes(q)));
  }, [category, query]);
  const selectedConnector = selected ? AI_MANAGER_CONNECTORS.find(item => item.id === selected) ?? null : null;

  async function connect(item: typeof AI_MANAGER_CONNECTORS[number]) {
    const googleScope = googleScopes[item.id];
    const provider = googleScope ? { provider: "google", scopes: googleScope } : undefined;
    if (!provider) {
      toast.info(`${item.name} is not enabled in HkTube yet. An owner must configure its OAuth client/API connector first; no external error was opened.`);
      return;
    }
    setPending(item.id);
    try {
      const error = await connectOAuthProvider(provider.provider, provider.scopes);
      if (error) toast.error(`${item.name} authorization could not start. The provider is not enabled in HkTube's connector configuration yet.`);
    } catch (error) {
      toast.error(`${item.name}: ${error instanceof Error ? error.message : "authorization could not start"}.`);
    } finally {
      setPending(null);
    }
  }

  return <HkTubeShell title="Connected Apps" subtitle="AI Manager tools, accounts, permissions and external services"><main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
    <header className="flex flex-col gap-4 border-b border-white/10 py-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><Link href="/admin-agent" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 hover:text-white" aria-label="Back to AI Agent"><ArrowLeft className="size-5" /></Link><span className="grid size-11 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Bot className="size-5" /></span><div><h1 className="text-xl font-black text-white">AI Manager Apps</h1><p className="text-xs text-slate-500">{AI_MANAGER_CONNECTORS.length} connector types · real authorization per app</p></div></div><div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[.06] px-3 py-1.5 text-xs font-semibold text-emerald-200"><ShieldCheck className="size-3.5" />No fake connected state</span><Button asChild variant="outline" className="border-cyan-300/20 bg-cyan-400/[.05] text-cyan-100"><Link href="/admin-agent/manager">Advanced AI Manager</Link></Button><Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin-agent">Back to Agent</Link></Button></div></header>
    <section className="my-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-200" /><div><h2 className="font-bold text-white">Manus-style connector setup</h2><p className="mt-1 text-sm leading-6 text-slate-400">Choose an enabled connector, approve its exact permissions on the provider page, then return here. Google services are live in this HkTube project; every other card stays in setup-required mode until its OAuth client/API connector is configured—so it will not throw a raw provider error.</p><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${googleConnected ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-400/10 text-amber-200"}`}>{googleConnected ? "Google connected for this session" : "Google authorization required"}</span><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] text-slate-400">Credentials stay with provider session</span></div></div></div></section>
    <div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search apps, actions or capabilities..." className="border-white/10 bg-white/[.04] pl-9 text-white placeholder:text-slate-600" /></label><div className="flex gap-2 overflow-x-auto pb-1">{CONNECTOR_CATEGORIES.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={category === item ? "shrink-0 rounded-xl border border-violet-300/30 bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-100" : "shrink-0 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"}>{item === "All" ? "All" : categoryLabels[item as ConnectorCategory]}</button>)}</div></div>
    <p className="mt-4 text-xs text-slate-600">Showing {filtered.length} of {AI_MANAGER_CONNECTORS.length} connector types.</p>
    <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Available connectors">{filtered.map(item => { const ready = Boolean(googleScopes[item.id]); return <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0b0d16]/75 p-4 shadow-xl shadow-black/10"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-violet-200"><KeyRound className="size-4" /></span><div className="min-w-0"><h3 className="truncate font-bold text-white">{item.name}</h3><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{categoryLabels[item.category]} · {item.auth}</p></div></div><span title={ready ? "OAuth ready" : "Secure setup required"} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${ready ? "border-emerald-300/15 bg-emerald-400/[.05] text-emerald-200" : "border-amber-300/15 bg-amber-400/[.05] text-amber-200"}`}>{ready ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}{ready ? "Ready" : "Setup"}</span></div><div className="mt-4 flex flex-wrap gap-1.5">{item.capabilities.slice(0, 5).map(capability => <span key={capability} className="rounded-lg bg-white/[.04] px-2 py-1 text-[10px] text-slate-400">{capability}</span>)}</div><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.agentUses.join(" · ")}</p><div className="mt-4 flex gap-2"><Button type="button" onClick={() => void connect(item)} disabled={pending === item.id} className={`flex-1 text-white ${ready ? "bg-violet-500 hover:bg-violet-400" : "bg-white/10 hover:bg-white/15"}`}>{pending === item.id ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : ready ? <ExternalLink className="mr-2 size-3.5" /> : <KeyRound className="mr-2 size-3.5" />}{pending === item.id ? "Opening…" : ready ? "Connect" : "Setup required"}</Button><Button type="button" variant="outline" onClick={() => setSelected(item.id)} className="border-white/10 bg-transparent text-slate-300">Details</Button></div></article>; })}</section>
    {!filtered.length && <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No connector matches this search.</div>}
    {selectedConnector && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={selectedConnector.name + " connector details"} onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#10131d] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-white">{selectedConnector.name}</h2><p className="mt-1 text-xs text-slate-500">{categoryLabels[selectedConnector.category]} · {selectedConnector.auth}</p></div><Button variant="ghost" onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">Close</Button></div><div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-600">Connector capabilities</p><ul className="mt-2 space-y-2">{selectedConnector.capabilities.map(value => <li key={value} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />{value}</li>)}</ul></div><div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-600">Agent uses</p><ul className="mt-2 space-y-2">{selectedConnector.agentUses.map(value => <li key={value} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-300" />{value}</li>)}</ul></div><div className="mt-6 rounded-2xl border border-amber-300/10 bg-amber-400/[.04] p-4 text-xs leading-5 text-amber-100/70"><Unplug className="mb-2 size-4 text-amber-200" />{googleScopes[selectedConnector.id] ? "Connect opens the provider's real login/consent page with the requested scope. HkTube returns here after approval." : "This connector is not enabled in HkTube yet. Configure its OAuth client/API/MCP entry first; the UI will then enable this button."}</div><Button className="mt-4 w-full bg-violet-500 text-white hover:bg-violet-400" disabled={pending === selectedConnector.id} onClick={() => void connect(selectedConnector)}>{pending === selectedConnector.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}{googleScopes[selectedConnector.id] ? `Connect ${selectedConnector.name}` : "Setup required"}</Button></div></div>}
  </main></HkTubeShell>;
}
