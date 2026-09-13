import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const KEY = "hktube-ugc-terms-v1";

export function UgcTermsGate() {
  const [location] = useLocation();
  const [accepted, setAccepted] = useState(() => localStorage.getItem(KEY) === "accepted");
  // Viewing public content must remain friction-free; the gate is only for UGC creation surfaces.
  const applies = location === "/upload" || location === "/channel/create" || location === "/posts";
  useEffect(() => { if (localStorage.getItem(KEY) === "accepted") setAccepted(true); }, [location]);
  if (!applies || accepted) return null;
  return <div className="fixed inset-0 z-[75] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ugc-terms-title">
    <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111624] p-6 text-white shadow-2xl sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">Before you create</p>
      <h1 id="ugc-terms-title" className="mt-2 text-2xl font-black">Accept HkTube's rules</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">Before uploading, posting, commenting or creating a public channel, please read and accept the Terms of Use and Community Guidelines. These rules prohibit illegal, abusive, exploitative, deceptive and rights-infringing content.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><Link href="/terms" className="rounded-full border border-white/10 px-3 py-2 text-cyan-200">Terms of Use</Link><Link href="/community" className="rounded-full border border-white/10 px-3 py-2 text-cyan-200">Community Guidelines</Link></div>
      <Button type="button" onClick={() => { localStorage.setItem(KEY, "accepted"); setAccepted(true); }} className="mt-6 w-full rounded-full bg-white font-bold text-slate-950 hover:bg-slate-100">I accept the Terms & Community Guidelines</Button>
      <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">You can review the policies again from Settings at any time.</p>
    </section>
  </div>;
}
