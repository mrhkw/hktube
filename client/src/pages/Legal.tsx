import { HkTubeShell } from "@/components/HkTubeShell";
import { ArrowLeft, Cookie, FileText, Megaphone, Scale, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "wouter";

type LegalKind = "privacy" | "terms" | "cookies" | "community" | "advertising";
type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

const pages: Record<LegalKind, { icon: typeof FileText; label: string; title: string; intro: string; sections: LegalSection[] }> = {
  privacy: {
    icon: ShieldCheck, label: "Privacy", title: "Privacy Policy", intro: "This policy explains the data HkTube processes for accounts, video publishing, safety, support, personalization, and future advertising.",
    sections: [
      { heading: "Controller and contact", paragraphs: ["HkTube is operated by the service owner identified on the Impressum page. Privacy, access, deletion, copyright, safety, and platform-support requests can be sent to hanifnazamdin17@gmail.com."] },
      { heading: "Information we process", paragraphs: ["Depending on the features you use, HkTube may process account identifiers, name, email address, profile information, authentication/session data, channel details, uploaded media metadata, thumbnails, captions, comments, reports, notifications, and activity needed to operate the service. Technical request and security information may also be processed to prevent abuse and keep the service reliable."] },
      { heading: "Why we use it", paragraphs: ["We use information to authenticate users, provide playback and publishing, operate channels and creator tools, maintain requested libraries and notifications, moderate content, investigate reports, prevent fraud and abuse, secure the service, provide support, and comply with legal obligations. Personalization is limited to platform features and saved preferences unless a separate lawful basis applies."] },
      { heading: "Third parties and advertising", paragraphs: ["HkTube currently does not activate third-party analytics or advertising trackers through the consent banner. If Google AdSense, Google Ad Manager, another ad network, analytics provider, payment service, or similar third party is activated, this policy will identify the provider, purposes, categories of data, relevant technologies, and applicable choices before the feature is used. Google publisher products also require specific privacy disclosures and, for personalized ads in the EEA, UK, and Switzerland, a Google-certified CMP integrated with the IAB Europe TCF. "] },
      { heading: "Your choices and rights", paragraphs: ["Depending on applicable law, you may have rights to access, correct, delete, restrict, object to, or receive a copy of personal data, and to withdraw consent where processing is based on consent. You may also clear local storage through your browser. Requests are assessed for identity and legal/security limits. Users in the EU/EEA may have the right to complain to a competent supervisory authority."] },
      { heading: "Retention and security", paragraphs: ["HkTube retains information only for as long as reasonably necessary for the service, safety, legal obligations, dispute handling, and legitimate operational records. Security controls include authenticated access, server-side authorization, controlled publishing actions, and protected infrastructure. No online service can guarantee absolute security."] },
    ],
  },
  terms: {
    icon: Scale, label: "Terms", title: "Terms of Use", intro: "These terms govern viewing, publishing, accounts, moderation, advertising, and future platform features.",
    sections: [
      { heading: "Using HkTube", paragraphs: ["You must use HkTube lawfully, respect other users, and follow the Community Guidelines. Features may evolve, be rate-limited, suspended, or retired for security, maintenance, legal, or product reasons."] },
      { heading: "Accounts and creator responsibility", paragraphs: ["You are responsible for activity performed through your account and for keeping access secure. Creators are responsible for the legality, accuracy, and rights associated with their videos, clips, thumbnails, captions, posts, and other uploads."] },
      { heading: "Content rights and copyright", paragraphs: ["Only upload content you own or are authorized to distribute. HkTube may restrict or remove content when required by law, these terms, safety rules, or a valid rights complaint. A moderation decision may include a reason and, where the applicable law requires it, an appeal or review path."] },
      { heading: "Advertising and commercial communication", paragraphs: ["Ads will be clearly identified as advertising. Paid promotions, sponsorships, affiliate relationships, or commercial communications must be disclosed accurately. Video-sharing creators will be given an appropriate way to indicate commercial communication when that feature is enabled. Advertising rules will never override applicable privacy or consumer-protection law."] },
      { heading: "Enforcement and appeals", paragraphs: ["HkTube may warn, restrict, remove, suspend, or terminate access for violations or security risks. Where a content or account decision is appealable, the decision notice should explain the reason and available review path. HkTube does not promise a fixed moderation time unless expressly stated."] },
    ],
  },
  cookies: {
    icon: Cookie, label: "Cookies", title: "Cookie Notice", intro: "HkTube separates essential storage from optional analytics and advertising technologies.",
    sections: [
      { heading: "Essential storage", paragraphs: ["HkTube may use cookies, session mechanisms, or local storage that are strictly necessary for authentication, security, preferences, routing, or core requested functions. These technologies can be necessary for the service to work."] },
      { heading: "Optional analytics and advertising", paragraphs: ["No optional analytics or advertising tracker is active in the current build. The HkTube consent control stores your privacy choice locally and is designed so optional technologies can be gated before activation. Where consent is legally required, HkTube will not load the relevant non-essential technology before the required choice."] },
      { heading: "Google advertising readiness", paragraphs: ["If Google AdSense, Ad Manager, or AdMob is introduced for users in the EEA, UK, or Switzerland, HkTube will use the required Google-certified consent-management approach for personalized advertising and maintain the required disclosures. Google states that personalized publisher ads in those regions require a certified CMP integrated with the IAB Europe Transparency and Consent Framework."] },
      { heading: "Changing your choice", paragraphs: ["You can clear browser storage to reset the local consent prompt. HkTube will also provide a visible privacy-choice control when optional tracking is activated. Clearing storage can sign you out or remove local preferences."] },
    ],
  },
  community: {
    icon: UsersRound, label: "Community", title: "Community Guidelines", intro: "HkTube is a user-generated video platform built around lawful, respectful, original and rights-cleared content.",
    sections: [
      { heading: "Allowed use", paragraphs: ["Publish content that you have the right to share and describe it accurately. Respect privacy, intellectual-property rights, and the safety of other people."] },
      { heading: "Not allowed", paragraphs: ["Do not use HkTube for illegal content, credible threats, harassment, hateful abuse, exploitation, privacy violations, malware, scams, deceptive impersonation, non-consensual intimate material, or content that materially facilitates serious harm."], bullets: ["Do not upload copyrighted or licensed material without the necessary rights.", "Do not fabricate views, followers, creator identities, endorsements, or engagement.", "Do not target minors with harmful, exploitative, or inappropriate material.", "Do not use HkTube to collect or expose sensitive personal information without a lawful reason and appropriate safeguards."] },
      { heading: "Reports, moderation and appeals", paragraphs: ["Users can report suspected violations through the platform support channel. HkTube may review reports using human or automated tools. If content is restricted or removed, HkTube aims to provide a clear reason and an available review or appeal route where required by applicable law. Repeated abuse of reporting or platform tools may itself be restricted."] },
      { heading: "Safety contact", paragraphs: ["For urgent safety, privacy, copyright, or legal concerns, contact hanifnazamdin17@gmail.com and include the relevant URL and a concise explanation. Do not send passwords or unnecessary sensitive information."] },
    ],
  },
  advertising: {
    icon: Megaphone, label: "Advertising", title: "Advertising Disclosure", intro: "HkTube is being prepared for compliant advertising without activating ad technology prematurely.",
    sections: [
      { heading: "Current status", paragraphs: ["Advertising is not currently activated as a revenue product in the HkTube application. The site has an ads.txt authorization file, but ad serving must not be enabled until the exact provider account, publisher authorization, privacy disclosures, consent configuration, placement rules, and provider review requirements are satisfied."] },
      { heading: "Google AdSense / publisher readiness", paragraphs: ["Before enabling Google publisher products, HkTube must keep the site functional and useful, provide original value and clear navigation, maintain a privacy policy that accurately describes data use and Google advertising technologies, and comply with Google's publisher and ad-placement policies. Google also requires privacy disclosures describing cookies, web beacons, IP addresses and other identifiers used as a consequence of Google products."] },
      { heading: "EEA, UK and Switzerland consent", paragraphs: ["When personalized publisher ads are served to users in the EEA, UK, or Switzerland, Google requires a certified consent-management platform integrated with the IAB Europe TCF. HkTube will treat advertising consent as optional and will not claim consent where the user has not provided it."] },
      { heading: "Ad placement and destination quality", paragraphs: ["Any paid campaign pointing to HkTube must use a working, useful, easy-to-navigate destination. Google Ads destination requirements prohibit destinations that fail to work, mismatch the advertised destination, or exist primarily to show ads without meaningful original value."] },
      { heading: "Transparency", paragraphs: ["Ads will be clearly labelled and the advertiser or commercial relationship will be identifiable. If HkTube operates in jurisdictions covered by platform-transparency obligations such as the EU Digital Services Act, HkTube will implement the applicable reporting, moderation-reason, appeal, ad-transparency, and recommender-system controls at the scale required by law."] },
    ],
  },
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const page = pages[kind];
  const Icon = page.icon;
  return <HkTubeShell>
    <article className="mx-auto max-w-3xl pb-10 pt-1"><Link href="/settings" className="inline-flex items-center text-sm font-semibold text-fuchsia-200 hover:text-fuchsia-100"><ArrowLeft className="mr-1.5 size-4" />Back to settings</Link><div className="mt-6 rounded-3xl border border-violet-300/18 bg-gradient-to-br from-violet-500/[.12] via-fuchsia-500/[.045] to-cyan-400/[.06] p-6 sm:p-8"><span className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-100"><Icon className="size-6" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">HKTUBE {page.label}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{page.title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{page.intro}</p><p className="mt-5 text-xs text-slate-500">Last updated: 9 September 2026</p></div><div className="mt-8 space-y-8">{page.sections.map(section => <section key={section.heading}><h2 className="text-xl font-bold text-white">{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-400">{paragraph}</p>)}{section.bullets && <ul className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-white/[.025] p-5 text-sm leading-6 text-slate-400">{section.bullets.map(bullet => <li key={bullet} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-fuchsia-300" />{bullet}</li>)}</ul>}</section>)}</div></article>
  </HkTubeShell>;
}
