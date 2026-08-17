import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'

interface LegalPageProps {
  kind: 'privacy' | 'terms' | 'refund'
  onNavigate?: (view: string) => void
}

const content = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains how HkTube collects, uses, stores, and protects information when you use our video-sharing and creator services.',
    sections: [
      ['Information we collect', 'We collect account identifiers supplied by your authentication provider, profile information you choose to publish, uploaded media and metadata, support messages, and technical information needed to secure sessions, deliver media, prevent abuse, and improve reliability.'],
      ['How we use information', 'We use information to operate accounts, publish and recommend content, process creator features, provide support, prevent fraud and copyright abuse, maintain security, and comply with applicable legal obligations. We do not sell personal information.'],
      ['Storage and service providers', 'HkTube uses managed authentication, database, storage, hosting, analytics, and payment providers. Information may be processed in the regions where those providers operate, subject to their contractual safeguards and applicable law.'],
      ['Your choices', 'You may update profile information in Settings, control optional analytics consent, request support, or ask us to remove content or close your account. Some records may be retained where required for security, fraud prevention, disputes, or legal compliance.'],
      ['Children and safety', 'HkTube is not intended for children who cannot lawfully consent to online services. We remove content or restrict accounts that violate safety rules or applicable age requirements.'],
      ['Changes and contact', 'We may update this policy as the service changes. The public support channel is available at Contact Support; it is operated under the HkTube Support identity.'],
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    intro: 'By using HkTube, you agree to use the platform lawfully, respect other users, and follow these conditions.',
    sections: [
      ['Accounts', 'You are responsible for maintaining access to your account and for activity performed through it. Do not impersonate another person, share credentials, or bypass safety, payment, or access controls.'],
      ['Content and licence', 'You retain rights in content you upload, but grant HkTube a non-exclusive, worldwide licence to host, encode, display, distribute, and promote that content as needed to operate the service. You must have the rights and permissions required for your uploads.'],
      ['Acceptable use', 'Do not upload unlawful, infringing, deceptive, malicious, hateful, exploitative, or privacy-invasive material. Do not interfere with service operation, scrape private data, abuse payment flows, or attempt unauthorized access.'],
      ['Moderation and copyright', 'HkTube may restrict, unlist, remove, or review content that appears to violate law, these Terms, copyright rules, or community safety standards. You may submit a support appeal through Contact Support.'],
      ['Paid services', 'Premium and creator services may have separate pricing, availability, and payment conditions shown at checkout. A payment authorization does not guarantee continued access if an account violates these Terms.'],
      ['Availability and changes', 'Features may change, be suspended, or be discontinued. To the extent permitted by law, HkTube is provided on an as-available basis and you remain responsible for maintaining backups of your original content.'],
    ],
  },
  refund: {
    title: 'Return, Refund & Service Cancellation Policy',
    intro: 'This policy describes how HkTube handles paid-service cancellations, failed payments, and refund requests.',
    sections: [
      ['Cancellations', 'You may request cancellation of a recurring service through the account support channel. Cancellation stops future renewal where technically possible; access already delivered for the paid period may continue until that period ends.'],
      ['Refund requests', 'If a charge was duplicated, unauthorized, materially incorrect, or a paid service was not delivered, submit a support request with the transaction reference and account details. We review requests fairly and may ask for verification.'],
      ['Processing', 'Approved refunds are returned through the original payment method where supported by the payment provider. Provider processing times, bank timelines, currency conversion, and intermediary fees may affect when funds appear.'],
      ['Non-refundable situations', 'Where permitted by applicable law, completed periods of service, consumed digital benefits, promotional access, and violations of the Terms may not qualify for a refund. Mandatory consumer rights are not limited by this policy.'],
      ['Payment disputes', 'Please contact HkTube Support before filing a payment dispute so we can investigate promptly. This does not remove any statutory right to contact your payment provider.'],
    ],
  },
} as const

export default function LegalPage({ kind, onNavigate }: LegalPageProps) {
  const page = content[kind]
  const go = (view: string) => onNavigate ? onNavigate(view) : window.location.assign(view === 'home' ? '/' : `/${view}`)
  return <article className="public-page legal-page">
    <button className="btn-secondary btn-sm public-back" onClick={() => go('home')}><ArrowLeft size={15} /> Back to HkTube</button>
    <div className="public-hero"><ShieldCheck size={28} /><div><span className="eyebrow">HK TUBE SUPPORT &amp; COMPLIANCE</span><h1>{page.title}</h1><p>{page.intro}</p></div></div>
    <div className="legal-sections">{page.sections.map(([heading, body]) => <section key={heading}><h2><FileText size={17} /> {heading}</h2><p>{body}</p></section>)}</div>
    <p className="legal-disclaimer">This page is a working service policy and may require review by qualified counsel for the jurisdictions in which HkTube operates.</p>
  </article>
}

export function PublicFooter({ onNavigate }: { onNavigate: (view: string) => void }) {
  const go = (view: string) => window.location.assign(`/${view}`)
  return <footer className="public-footer"><span>© {new Date().getFullYear()} HkTube</span><button onClick={() => go('privacy')}>Privacy</button><button onClick={() => go('terms')}>Terms</button><button onClick={() => go('refund-policy')}>Refunds</button><button onClick={() => go('contact')}>Contact Support</button><button onClick={() => go('services')}>Services</button></footer>
}

export function ContactSupportLink({ onNavigate }: { onNavigate: (view: string) => void }) {
  return <button className="btn-secondary btn-sm" onClick={() => onNavigate('contact')}>Contact HkTube Support</button>
}
