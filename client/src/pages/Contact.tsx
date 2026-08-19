import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Copy, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const contactEmail = "hanifnazamdin17@gmail.com";

export default function Contact() {
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contactEmail);
      toast.success("Contact email copied.");
    } catch {
      toast.error("Copy is unavailable in this browser. Please use the email link.");
    }
  }

  return <HkTubeShell title="Contact HKTUBE" subtitle="Use the platform contact channel for privacy, copyright, safety, or service questions.">
    <div className="mx-auto max-w-2xl pb-10"><section className="rounded-3xl border border-violet-300/18 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.045] to-cyan-400/[.06] p-6 sm:p-8"><span className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-100"><Mail className="size-6" /></span><h2 className="mt-5 text-2xl font-bold text-white">Contact Us</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">For questions about HKTUBE, privacy, uploaded content, copyright concerns, accessibility, or platform policies, email the HKTUBE owner. Include the relevant video URL or page URL when possible.</p><div className="mt-6 flex flex-wrap gap-3"><Button asChild className="bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white hover:from-violet-400 hover:to-fuchsia-400"><a href={`mailto:${contactEmail}?subject=HKTUBE%20support%20request`}><Mail className="mr-2 size-4" />Email HKTUBE</a></Button><Button variant="outline" onClick={() => void copyEmail()} className="border-white/12 text-slate-200 hover:bg-white/8"><Copy className="mr-2 size-4" />Copy email</Button></div><p className="mt-4 text-xs text-slate-500">{contactEmail}</p></section><section className="mt-6 rounded-2xl border border-cyan-300/14 bg-cyan-300/[.035] p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-200" /><div><h2 className="font-bold text-white">Content report guidance</h2><p className="mt-1 text-sm leading-6 text-slate-400">For a content report, provide the video URL, a concise reason for the report, and any information needed to assess rights or safety concerns. HKTUBE does not promise a specific review time.</p></div></div></section></div>
  </HkTubeShell>;
}
