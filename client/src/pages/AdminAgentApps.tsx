import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, CheckCircle2, CircleAlert, Eye, EyeOff, ExternalLink, KeyRound, Loader2, Search, ShieldCheck, Unplug } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AI_MANAGER_CONNECTORS, CONNECTOR_CATEGORIES, type ConnectorCategory } from "@/lib/aiManagerConnectors";
import { disconnectAIConnector, getAIConnectorStatuses, saveAIConnector } from "@/lib/supabase";
import { getCredentialFields, getCredentialMode, type CredentialMode } from "@shared/connectorCredentials";

const categoryLabels: Record<ConnectorCategory, string> = {
  AI: "AI & Agent",
  Communication: "Communication",
  Content: "Content & Social",
  Data: "Data",
  Developer: "Developer",
  Finance: "Finance",
  Marketing: "Marketing",
  Productivity: "Productivity",
  Storage: "Storage",
  Infrastructure: "Infrastructure",
  Automation: "Automation",
};

const modeLabels: Record<CredentialMode, string> = {
  "api-key": "API key",
  oauth: "OAuth",
  mcp: "MCP",
  webhook: "Webhook",
};

function connectorModes(auth: string): CredentialMode[] {
  if (auth === "OAuth/API Key") return ["oauth", "api-key"];
  if (auth === "OAuth/MCP") return ["oauth", "mcp"];
  return [getCredentialMode(auth)];
}

export default function AdminAgentApps() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [credentialMode, setCredentialMode] = useState<CredentialMode>("api-key");
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AI_MANAGER_CONNECTORS.filter(item => {
      if (category !== "All" && item.category !== category) return false;
      if (!q) return true;
      return [item.name, item.category, item.auth, ...item.capabilities, ...item.agentUses].join(" ").toLowerCase().includes(q);
    });
  }, [category, query]);

  const selectedConnector = selected ? AI_MANAGER_CONNECTORS.find(item => item.id === selected) ?? null : null;
  const selectedStatus = selected ? statuses[selected] : undefined;
  const availableModes = selectedConnector ? connectorModes(selectedConnector.auth) : [];
  const fields = selectedConnector ? getCredentialFields(selectedConnector.id, selectedConnector.auth, credentialMode) : [];

  useEffect(() => {
    void getAIConnectorStatuses()
      .then(rows => setStatuses(Object.fromEntries(rows.map(row => [row.connectorId, row.status]))))
      .catch(error => console.warn("[AI Connectors] status load failed", error));
  }, []);

  function openConnect(item: typeof AI_MANAGER_CONNECTORS[number]) {
    const modes = connectorModes(item.auth);
    const mode = modes[0];
    setSelected(item.id);
    setCredentialMode(mode);
    setValues({});
    setVisibleSecrets({});
  }

  async function refreshStatuses() {
    const rows = await getAIConnectorStatuses();
    setStatuses(Object.fromEntries(rows.map(row => [row.connectorId, row.status])));
  }

  async function submitConnector() {
    if (!selectedConnector) return;
    setConnecting(true);
    try {
      await saveAIConnector({ connectorId: selectedConnector.id, authMode: credentialMode, credentials: values });
      await refreshStatuses();
      toast.success(`${selectedConnector.name} connected securely.`);
      setSelected(null);
      setValues({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connector could not be saved.");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect(item: typeof AI_MANAGER_CONNECTORS[number]) {
    setConnecting(true);
    try {
      await disconnectAIConnector(item.id);
      await refreshStatuses();
      toast.success(`${item.name} disconnected.`);
      if (selected === item.id) setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connector could not be disconnected.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <HkTubeShell title="Connected Apps" subtitle="AI Manager tools, accounts, permissions and external services">
      <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-white/10 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin-agent" className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300 hover:text-white" aria-label="Back to AI Agent"><ArrowLeft className="size-5" /></Link>
            <span className="grid size-11 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><Bot className="size-5" /></span>
            <div><h1 className="text-xl font-black text-white">AI Manager Apps</h1><p className="text-xs text-slate-500">{AI_MANAGER_CONNECTORS.length} connector types · dynamic secure setup</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[.06] px-3 py-1.5 text-xs font-semibold text-emerald-200"><ShieldCheck className="size-3.5" />Encrypted server-side credentials</span>
            <Button asChild variant="outline" className="border-cyan-300/20 bg-cyan-400/[.05] text-cyan-100"><Link href="/admin-agent/manager">Advanced AI Manager</Link></Button>
            <Button asChild variant="outline" className="border-white/10 bg-transparent text-slate-300"><Link href="/admin-agent">Back to Agent</Link></Button>
          </div>
        </header>

        <section className="my-5 rounded-3xl border border-violet-300/15 bg-violet-400/[.045] p-5">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-violet-200" /><div><h2 className="font-bold text-white">Connect services directly</h2><p className="mt-1 text-sm leading-6 text-slate-400">Connect opens a service-specific form. Secrets are sent over HTTPS, encrypted with AES-256-GCM on the server, and never returned to the browser after saving. Humanity has finally invented a place to put API keys that is not a random chat message.</p></div></div>
        </section>

        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search apps, actions or capabilities..." className="border-white/10 bg-white/[.04] pl-9 text-white placeholder:text-slate-600" /></label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CONNECTOR_CATEGORIES.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={category === item ? "shrink-0 rounded-xl border border-violet-300/30 bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-100" : "shrink-0 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"}>{item === "All" ? "All" : categoryLabels[item as ConnectorCategory]}</button>)}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-600">Showing {filtered.length} of {AI_MANAGER_CONNECTORS.length} connector types.</p>
        <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Available connectors">
          {filtered.map(item => {
            const connected = statuses[item.id] === "connected";
            return <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0b0d16]/75 p-4 shadow-xl shadow-black/10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-violet-200"><KeyRound className="size-4" /></span><div className="min-w-0"><h3 className="truncate font-bold text-white">{item.name}</h3><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{categoryLabels[item.category]} · {item.auth}</p></div></div>
                <span title={connected ? "Connected" : "Setup required"} className={connected ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[.05] px-2 py-1 text-[10px] font-bold text-emerald-200" : "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/15 bg-amber-400/[.05] px-2 py-1 text-[10px] font-bold text-amber-200"}>{connected ? <><CheckCircle2 className="size-3" />Connected</> : <><CircleAlert className="size-3" />Setup</>}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">{item.capabilities.slice(0, 5).map(capability => <span key={capability} className="rounded-lg bg-white/[.04] px-2 py-1 text-[10px] text-slate-400">{capability}</span>)}</div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.agentUses.join(" · ")}</p>
              <div className="mt-4 flex gap-2"><Button type="button" onClick={() => openConnect(item)} className="flex-1 bg-violet-500 text-white hover:bg-violet-400"><ExternalLink className="mr-2 size-3.5" />{connected ? "Manage" : "Connect"}</Button><Button type="button" variant="outline" onClick={() => setSelected(item.id)} className="border-white/10 bg-transparent text-slate-300">Details</Button></div>
            </article>;
          })}
        </section>

        {!filtered.length && <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No connector matches this search.</div>}

        {selectedConnector && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={selectedConnector.name + " connector"} onMouseDown={event => { if (event.target === event.currentTarget && !connecting) setSelected(null); }}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#10131d] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-white">{selectedConnector.name}</h2><p className="mt-1 text-xs text-slate-500">{categoryLabels[selectedConnector.category]} · {selectedConnector.auth}</p></div><Button variant="ghost" disabled={connecting} onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">Close</Button></div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-white">{selectedStatus === "connected" ? "Connected" : "Connect this service"}</p><p className="mt-1 text-xs leading-5 text-slate-500">Enter only the credentials required for this connector. Existing saved secrets remain server-side when you update another field.</p></div>{selectedStatus === "connected" && <span className="rounded-full border border-emerald-300/15 bg-emerald-400/[.05] px-2.5 py-1 text-xs font-bold text-emerald-200">Connected</span>}</div>

              {availableModes.length > 1 && <div className="mt-4 grid grid-cols-2 gap-2">{availableModes.map(mode => <button key={mode} type="button" onClick={() => { setCredentialMode(mode); setValues({}); }} className={credentialMode === mode ? "rounded-xl border border-violet-300/30 bg-violet-400/15 px-3 py-2 text-xs font-bold text-violet-100" : "rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-xs font-bold text-slate-400"}>{modeLabels[mode]}</button>)}</div>}

              <div className="mt-4 space-y-4">
                {fields.map(field => {
                  const secret = Boolean(field.secret);
                  const visible = visibleSecrets[field.key] === true;
                  return <label key={field.key} className="block"><span className="text-xs font-bold text-slate-200">{field.label}{field.required ? " *" : ""}</span>
                    <div className="relative mt-1.5"><Input type={secret && !visible ? "password" : "text"} inputMode={field.inputMode === "url" ? "url" : "text"} autoComplete="off" value={values[field.key] ?? ""} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="border-white/10 bg-black/20 pr-11 text-white placeholder:text-slate-600" />
                      {secret && <button type="button" aria-label={visible ? "Hide secret" : "Show secret"} onClick={() => setVisibleSecrets(current => ({ ...current, [field.key]: !visible }))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-white">{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
                    </div>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">{field.helper}</span>
                  </label>;
                })}
              </div>

              <div className="mt-5 rounded-xl border border-cyan-300/10 bg-cyan-400/[.035] p-3 text-[11px] leading-5 text-slate-400"><ShieldCheck className="mr-1 inline size-3.5 text-cyan-200" />Secrets are never written to localStorage, chat history, source code, or the returned API response. Disconnect deletes the encrypted record.</div>

              <div className="mt-5 flex gap-2">
                <Button type="button" disabled={connecting} onClick={() => void submitConnector()} className="flex-1 bg-violet-500 text-white hover:bg-violet-400">{connecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}{connecting ? "Saving securely..." : selectedStatus === "connected" ? "Update connection" : "Save & Connect"}</Button>
                {selectedStatus === "connected" && <Button type="button" disabled={connecting} variant="outline" onClick={() => void disconnect(selectedConnector)} className="border-red-300/15 bg-red-400/[.04] text-red-200"><Unplug className="mr-2 size-4" />Disconnect</Button>}
              </div>
            </div>

            <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-600">Agent capabilities</p><ul className="mt-2 space-y-2">{selectedConnector.capabilities.map(value => <li key={value} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />{value}</li>)}</ul></div>
          </div>
        </div>}
      </main>
    </HkTubeShell>
  );
}
