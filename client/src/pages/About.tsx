import { ArrowLeft, CheckCircle2, Eye, FileText, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Link } from "wouter";
import { HkTubeShell } from "@/components/HkTubeShell";

const sections = [
  { icon: Eye, title: "What HkTube is", body: "HkTube is a video-sharing experience for watching, discovering, and publishing authorized long-form videos, Shorts, and creator posts in one place." },
  { icon: Sparkles, title: "Built for real content", body: "HkTube displays records returned by its configured backend. It does not invent videos, thumbnails, creators, views, followers, notifications, earnings, or analytics. When a section has no records, the app shows an honest empty state." },
  { icon: UsersRound, title: "For viewers and creators", body: "Viewers can browse real content, use search and discovery surfaces, watch long videos in a responsive 16:9 player, and experience Shorts in a vertical 9:16 feed. Authorized creators can use the configured upload and creator workflows." },
  { icon: ShieldCheck, title: "Safety and access", body: "Protected actions use server-side authentication and authorization. Publishing and administrative workflows are not granted by hiding or showing a frontend button; they require the corresponding authenticated role and server permission." },
  { icon: FileText, title: "Clear status", body: "Provider-dependent services such as payments, advertising, advanced AI processing, dubbing, and live infrastructure are only described as active after their production integrations confirm success. HkTube does not present an unconfigured service as completed." },
];

export default function About() {
  return <HkTubeShell>
    <article className="mx-auto max-w-3xl pb-12 pt-1">
      <Link href="/settings" className="inline-flex items-center text-sm font-semibold text-fuchsia-200 hover:text-fuchsia-100"><ArrowLeft className="mr-1.5 size-4" />Back to settings</Link>
      <div className="mt-6 rounded-3xl border border-violet-300/18 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.045] to-cyan-400/[.06] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">HKTUBE ABOUT</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">About HkTube</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">A focused home for authentic video discovery, creator publishing, Shorts, and community updates—with clear boundaries between real platform data and features that still require an integration.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200"><CheckCircle2 className="mr-1 inline size-3.5" />Authentic content only</span><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-200">Viewer and creator experiences</span></div>
      </div>
      <div className="mt-8 space-y-7">{sections.map(({ icon: Icon, title, body }) => <section key={title}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-200"><Icon className="size-5" /></span><h2 className="text-xl font-bold text-white">{title}</h2></div><p className="mt-3 text-sm leading-7 text-slate-400">{body}</p></section>)}</div>
      <div className="mt-9 rounded-2xl border border-white/10 bg-white/[.025] p-5 text-sm leading-7 text-slate-400"><strong className="text-slate-200">Support:</strong> For account, content, copyright, or platform questions, use the <Link href="/contact" className="font-semibold text-fuchsia-200 hover:text-fuchsia-100">Contact and Support page</Link>.</div>
      <p className="mt-7 text-xs text-slate-500">About HkTube · Last updated: 23 August 2026</p>
    </article>
  </HkTubeShell>;
}
