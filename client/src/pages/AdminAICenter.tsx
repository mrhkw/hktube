import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";
import { useAuth } from "@/_core/hooks/useAuth";
import { isAllowlistedAdminEmail } from "@/lib/adminAccess";
import { Bot, Loader2, ShieldCheck } from "lucide-react";

export default function AdminAICenter() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const authorized = isAllowlistedAdminEmail(user?.email);

  useEffect(() => {
    if (!loading && authorized) setLocation("/admin-agent/manager");
  }, [authorized, loading, setLocation]);

  if (loading || authorized) {
    return <HkTubeShell title="HkTube Agent">
      <main className="grid min-h-[55vh] place-items-center px-5 text-center">
        <div><Loader2 className="mx-auto size-7 animate-spin text-violet-300" /><p className="mt-4 text-sm text-slate-400">Opening the unified HkTube Agent…</p></div>
      </main>
    </HkTubeShell>;
  }

  return <HkTubeShell title="HkTube Agent">
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200"><ShieldCheck className="size-6" /></span>
      <h1 className="mt-5 text-3xl font-black text-white">HkTube Agent access</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">This private control room is available only to the two authorized HkTube owner accounts.</p>
      <Link href="/auth" className="mt-6 inline-flex items-center rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white"><Bot className="mr-2 size-4" />Sign in with Google</Link>
    </main>
  </HkTubeShell>;
}
