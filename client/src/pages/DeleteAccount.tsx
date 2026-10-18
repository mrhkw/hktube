import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DeleteAccount() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        setIsError(true);
        setMessage("Account deletion request ke liye pehle HkTube mein sign in karein. Agar account access nahi ho raha, support se rabta karein.");
        return;
      }

      const response = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; alreadyPending?: boolean; message?: string; error?: { message?: string } } | null;
      if (!response.ok || !payload?.ok) {
        setIsError(true);
        setMessage(payload?.error?.message || "Request submit nahi ho saki. Koi deletion confirm nahi hui.");
        return;
      }
      setMessage(payload.message || (payload.alreadyPending ? "Tumhari request pehle se pending hai." : "Request record ho gayi."));
    } catch {
      setIsError(true);
      setMessage("Network ya server error. Request confirm nahi hui, dobara try karein.");
    } finally {
      setBusy(false);
    }
  }

  return <HkTubeShell title="Delete HkTube account" subtitle="Submit a verified account-deletion request.">
    <main className="mx-auto w-full max-w-2xl space-y-6">
      <section className="rounded-3xl border border-red-300/15 bg-red-400/[.04] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-400/10 text-red-200"><AlertTriangle className="size-5" aria-hidden="true" /></span>
          <div>
            <h1 className="text-xl font-black text-white">Request account deletion</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Your signed-in session is verified by the server before a request is recorded. Submitting a request does not instantly delete the account. The operator must review and process it, including any legally required retention.</p>
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
        <p className="text-sm leading-6 text-slate-300">Sign in to the HkTube account you want deleted, then submit the request below. Duplicate pending requests are prevented.</p>
        <Button type="button" disabled={busy} onClick={() => void submit()} className="mt-4 bg-white text-slate-950 hover:bg-slate-100">
          <Mail className="mr-2 size-4" />{busy ? "Submitting..." : "Submit deletion request"}
        </Button>
        {message && <p role="status" className={`mt-4 rounded-xl border p-3 text-sm leading-6 ${isError ? "border-red-300/20 text-red-200" : "border-amber-300/20 text-amber-100"}`}>{message}</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">Account access issue? Contact <a className="underline" href="mailto:hanifnazamdin17@gmail.com?subject=HkTube%20account%20deletion%20help">HkTube support</a>. Do not send passwords or verification codes.</p>
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-emerald-300" aria-hidden="true" /><h2 className="font-bold text-white">What happens next?</h2></div>
        <p className="mt-2 text-sm leading-6 text-slate-400">The request is recorded in the private erasure queue. The account and associated data are not removed automatically by this form. The operator must complete and verify deletion before HkTube can claim the request is fulfilled.</p>
      </section>
    </main>
  </HkTubeShell>;
}
