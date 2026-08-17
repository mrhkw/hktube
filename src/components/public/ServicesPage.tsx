import { ArrowLeft, BadgeCheck, BarChart3, Crown, Download, Gift, Headphones, Radio, ShieldCheck, Sparkles } from 'lucide-react'

const services = [
  { icon: Sparkles, title: 'Free Tier', description: 'Upload and watch community videos with standard playback, creator profiles, and core social features.', label: 'Free' },
  { icon: Crown, title: 'Premium Pass', description: 'Ad-free viewing, higher quality playback, expanded creator tools, and priority support.', label: 'Monthly' },
  { icon: Radio, title: 'Live Creator Stage', description: 'Host vertical live sessions with chat, gifts, coins, and creator moderation controls.', label: 'Creator service' },
  { icon: ShieldCheck, title: 'Ad-Free Upgrade', description: 'An uninterrupted viewing experience for members who prefer fewer promotional interruptions.', label: 'Upgrade' },
  { icon: Sparkles, title: 'Creator Studio Tools', description: 'Organize uploads, review channel activity, manage profile presentation, and plan content.', label: 'Creator tools' },
  { icon: BadgeCheck, title: 'Gold Creator Badge', description: 'Eligible creators can receive a visible account badge subject to verification and platform rules.', label: 'Eligibility-based' },
  { icon: Download, title: 'Creator Downloads', description: 'Download-enabled content can be saved by viewers according to the creator’s permissions and platform policy.', label: 'Permission-based' },
  { icon: Headphones, title: 'Channel Sponsorships', description: 'Support participating creators through sponsorship and community benefit programs when available.', label: 'Availability varies' },
]

export default function ServicesPage({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const goHome = () => onNavigate ? onNavigate('home') : window.location.assign('/')
  return <article className="public-page services-page">
    <button className="btn-secondary btn-sm public-back" onClick={goHome}><ArrowLeft size={15} /> Back to HkTube</button>
    <div className="public-hero"><BarChart3 size={28} /><div><span className="eyebrow">HK TUBE SERVICES</span><h1>Plans &amp; creator services</h1><p>Explore the ways HkTube supports viewers, creators, live communities, and channel growth.</p></div></div>
    <div className="service-grid">{services.map(({ icon: Icon, title, description, label }) => <section className="service-card" key={title}><div className="service-icon"><Icon size={20} /></div><span className="service-label">{label}</span><h2>{title}</h2><p>{description}</p></section>)}</div>
    <div className="service-note"><Gift size={18} /><p>Prices, eligibility, availability, and payment terms are shown before any paid action. HkTube does not charge for the Free Tier.</p></div>
  </article>
}
