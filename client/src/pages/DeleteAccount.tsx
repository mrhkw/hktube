import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

export default function DeleteAccount() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value || !value.includes("@")) return;
    const subject = encodeURIComponent("HkTube account deletion request");
    const body = encodeURIComponent(`Please delete my HkTube account and associated app data.\n\nAccount email: ${value}`);
    window.location.href = `mailto:hello@hktube.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return <HkTubeShell title="Delete HkTube account" subtitle="A clear web path for account and data deletion requests.">
    <main className="mx-auto w-full max-w-2xl space-y-6">
      <section className="rounded-3xl border border-red-300/15 bg-red-400/[.04] p-6 sm:p-8">
        <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-400/10 text-red-200"><AlertTriangle className="size-5" aria-hidden="true" /></span><div><h1 className="text-xl font-black text-white">Request account deletion</h1><p className="mt-2 text-sm leading-6 text-slate-400">HkTube will use this request to identify your account and process deletion of the app-associated account data. Any legally required retention will be explained in the privacy policy or support response.</p></div></div>
      </section>
      <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[.035] p-6">
        <label htmlFor="delete-email" className="text-sm font-semibold text-white">Account email</label>
        <Input id="delete-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 border-white/10 bg-black/20 text-white" />
        <Button type="submit" className="mt-4 bg-white text-slate-950 hover:bg-slate-100"><Mail className="mr-2 size-4" />Request deletion</Button>
        {submitted && <p className="mt-3 text-sm text-emerald-300">Your email client should now contain the deletion request. If it did not open, contact HkTube support directly.</p>}
      </form>
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-6"><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-emerald-300" aria-hidden="true" /><h2 className="font-bold text-white">What is deleted?</h2></div><p className="mt-2 text-sm leading-6 text-slate-400">The deletion process covers the HkTube account data associated with your request. Content or records that must be retained for legitimate legal, security or fraud-prevention reasons will be handled according to the Privacy Policy.</p></section>
    </main>
  </HkTubeShell>;
}
