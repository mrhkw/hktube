import { HkTubeShell } from "@/components/HkTubeShell";
import { ArrowLeft, Cookie, FileText, Megaphone, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "wouter";

type LegalKind = "privacy" | "terms" | "cookies" | "community" | "advertising";

type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

const pages: Record<LegalKind, { icon: typeof FileText; label: string; title: string; intro: string; sections: LegalSection[] }> = {
  privacy: {
    icon: ShieldCheck, label: "Privacy", title: "Privacy Policy", intro: "This policy explains what HKTUBE collects, why it is used, how it is protected, and the choices available to visitors, viewers, and creators.",
    sections: [
      { heading: "Information HKTUBE processes", paragraphs: ["HKTUBE processes account details provided through the configured sign-in service, including an account identifier and any available name or email address. When the owner publishes a video, HKTUBE stores the video metadata required to display it, including its title, description, category, duration, media URLs, thumbnail URL, caption URL, upload time, and view count."] },
      { heading: "How information is used", paragraphs: ["Account information is used to maintain sign-in sessions and enforce role-based access. Video and media information is used to show the catalog, play authorized media, search titles and descriptions, and provide owner-only publishing tools. HKTUBE does not sell personal information."], bullets: ["We use essential session data to authenticate accounts and prevent unauthorized access.", "We use content and activity data only for requested platform functions, safety, moderation, and aggregate service improvement.", "If advertising is enabled later, advertising partners may process device or usage information only as described in an updated notice and after any consent required by applicable law."] },
      { heading: "Storage and access", paragraphs: ["Uploaded media is stored through the configured object-storage workflow and linked from the HKTUBE database. Only the owner/admin role can publish or remove video records through Creator Studio. Public visitors can view published catalog data and media intended for public playback."] },
      { heading: "Retention, choices, and contact", paragraphs: ["HKTUBE keeps account, content, and moderation records only for as long as needed to provide the service, meet legal obligations, resolve disputes, and protect the platform. You may request access, correction, deletion, or clarification of personal information, subject to legal and security limits, by contacting hanifnazamdin17@gmail.com. This policy is updated before material account, advertising, comments, analytics, or tracking features are activated."] },
    ],
  },
  terms: {
    icon: Scale, label: "Terms", title: "Terms of Use", intro: "These terms set the rules for using HKTUBE, publishing content, interacting with creators, and viewing any future advertising or sponsored placements.",
    sections: [
      { heading: "Using HKTUBE", paragraphs: ["By accessing HKTUBE, you agree to use the service lawfully and in accordance with these terms and the Community Guidelines. HKTUBE may change or suspend features while the platform is developed and maintained."] },
      { heading: "Account responsibility", paragraphs: ["You are responsible for activity performed through your signed-in account and for keeping your access credentials secure. Owner/admin access is reserved for authorized platform management and video publishing."] },
      { heading: "Content rights", paragraphs: ["Only upload media that you own or are authorized to publish. You remain responsible for your title, description, thumbnail, video, and caption materials, and for ensuring that your content does not infringe another party’s rights."] },
      { heading: "Advertising and enforcement", paragraphs: ["HKTUBE may restrict access to content or accounts that violate these terms, applicable law, or the Community Guidelines. Any advertising or sponsored content will be identified clearly and will not be presented as an endorsement unless the relationship is real. Contact hanifnazamdin17@gmail.com with a platform or content concern."] },
    ],
  },
  cookies: {
    icon: Cookie, label: "Cookies", title: "Cookie Notice", intro: "HKTUBE uses essential session mechanisms needed to keep signed-in accounts working securely.",
    sections: [
      { heading: "Essential cookies and storage", paragraphs: ["HKTUBE uses authentication session data to recognize a signed-in account and enforce owner-only publishing access. Local browser storage may be used to support the signed-in preview experience where browser cookie rules require it."] },
      { heading: "Advertising cookies and consent", paragraphs: ["Advertising and AdSense are not enabled in the current HKTUBE build. If advertising is introduced later, HKTUBE will update this notice and the Privacy Policy before activation, disclose the provider and purposes, obtain consent where required, and provide a way to withdraw or change consent. Non-essential advertising cookies will not be set before the applicable consent choice."] },
      { heading: "Your controls", paragraphs: ["You can clear cookies and local browser storage through your browser settings. Doing so may sign you out of HKTUBE or remove locally stored preferences."] },
    ],
  },
  community: {
    icon: UsersRound, label: "Community", title: "Community Guidelines", intro: "HKTUBE is for authorized, respectful, and lawful video sharing.",
    sections: [
      { heading: "Publish responsibly", paragraphs: ["Only publish media, thumbnails, captions, and descriptions you are authorized to use. Describe content accurately and do not mislead viewers through false titles, imagery, or fabricated engagement."] },
      { heading: "Content that is not allowed", paragraphs: ["Do not use HKTUBE to publish illegal content, hateful or harassing material, content that violates privacy or intellectual-property rights, malware, scams, or deceptive impersonation."], bullets: ["Do not upload content you do not own or have permission to distribute.", "Do not present fake views, fake creator identities, or fabricated activity as real.", "Do not use the platform to collect sensitive personal information from viewers."] },
      { heading: "Reporting and enforcement", paragraphs: ["If you believe content violates these guidelines, contact hanifnazamdin17@gmail.com with the video URL and a concise explanation. HKTUBE may remove or restrict content while reviewing a report."] },
    ],
  },
  advertising: {
    icon: Megaphone, label: "Advertising", title: "Advertising Disclosure", intro: "This page explains HKTUBE’s current advertising status and the conditions for adding an advertising program later.",
    sections: [
      { heading: "Current status", paragraphs: ["No advertising network, AdSense tag, premium advertising benefit, or sponsored placement is enabled in the current HKTUBE build. The platform does not display a fake advertising status, estimated revenue, or ad performance metric."] },
      { heading: "Before enabling advertising", paragraphs: ["Before Google AdSense or another advertising provider is connected, HKTUBE should maintain accurate Privacy, Cookie, Terms, and Community Guidelines pages; provide required consent controls; publish any required ads.txt file; and ensure that ad placements follow the provider’s program policies."] },
      { heading: "Sponsored content", paragraphs: ["Any paid promotion, sponsored video, affiliate relationship, or creator payment arrangement must be disclosed clearly within the relevant content or placement. HKTUBE should not label content as sponsored unless that relationship is real and documented."] },
      { heading: "Changes to this disclosure", paragraphs: ["This disclosure will be updated before advertising features are activated. Contact hanifnazamdin17@gmail.com with advertising or disclosure questions."] },
    ],
  },
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const page = pages[kind];
  const Icon = page.icon;
  return <HkTubeShell>
    <article className="mx-auto max-w-3xl pb-10 pt-1"><Link href="/settings" className="inline-flex items-center text-sm font-semibold text-fuchsia-200 hover:text-fuchsia-100"><ArrowLeft className="mr-1.5 size-4" />Back to settings</Link><div className="mt-6 rounded-3xl border border-violet-300/18 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.045] to-cyan-400/[.06] p-6 sm:p-8"><span className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-100"><Icon className="size-6" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">HKTUBE {page.label}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{page.title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{page.intro}</p><p className="mt-5 text-xs text-slate-500">Last updated: 19 August 2026</p></div><div className="mt-8 space-y-8">{page.sections.map(section => <section key={section.heading}><h2 className="text-xl font-bold text-white">{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-400">{paragraph}</p>)}{section.bullets && <ul className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-white/[.025] p-5 text-sm leading-6 text-slate-400">{section.bullets.map(bullet => <li key={bullet} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-fuchsia-300" />{bullet}</li>)}</ul>}</section>)}</div></article>
  </HkTubeShell>;
}
