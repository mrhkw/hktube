import { HkTubeShell } from "@/components/HkTubeShell";
import { Link } from "wouter";
import { ArrowRight, CircleHelp, Flag, LockKeyhole, ShieldCheck, UploadCloud, UserRound } from "lucide-react";

const topics = [
  { title: "Account & login", text: "Google sign-in, email login, sessions and account settings.", href: "/settings", icon: UserRound },
  { title: "Channel & uploads", text: "Create a channel, upload videos or Clips, and use Creator Studio.", href: "/upload", icon: UploadCloud },
  { title: "Safety & reporting", text: "Report videos, posts or comments and use HkTube's moderation flow.", href: "/community", icon: Flag },
  { title: "Privacy & data", text: "Review privacy, cookies, advertising choices and data controls.", href: "/privacy", icon: LockKeyhole },
  { title: "Creator safety", text: "Learn about ownership, moderation and publishing responsibilities.", href: "/studio", icon: ShieldCheck },
  { title: "Contact support", text: "For account, copyright, safety, privacy or advertising questions.", href: "/contact", icon: CircleHelp },
];

export default function Help() {
  return <HkTubeShell title="Help Center" subtitle="Quick answers and direct paths for viewers and creators.">
    <main className="mx-auto w-full max-w-5xl space-y-8">
      <section className="rounded-[30px] border border-violet-300/15 bg-gradient-to-br from-violet-500/[.14] via-white/[.035] to-cyan-400/[.05] p-6 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200/80">HkTube Support</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-white sm:text-5xl">Need help? Start here.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Find the right support path without leaving HkTube. Safety reports and account controls are available from inside the platform.</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map(topic => { const Icon = topic.icon; return <Link key={topic.title} href={topic.href} className="group rounded-3xl border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-0.5 hover:border-violet-300/25 hover:bg-violet-500/[.05]"><span className="grid size-11 place-items-center rounded-2xl bg-white/[.06] text-violet-200"><Icon className="size-5" aria-hidden="true" /></span><h2 className="mt-5 font-bold text-white">{topic.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{topic.text}</p><span className="mt-4 inline-flex items-center text-xs font-bold text-violet-200">Open <ArrowRight className="ml-1 size-3.5 transition group-hover:translate-x-0.5" /></span></Link>; })}
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-6">
        <h2 className="text-lg font-black text-white">Safety first</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">HkTube is a user-generated-content platform. Do not ignore harmful or illegal content: use the Report action on the content itself so it reaches the moderation queue.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/community" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/[.06]">Community Guidelines</Link><Link href="/contact" className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100">Contact support</Link></div>
      </section>
    </main>
  </HkTubeShell>;
}
