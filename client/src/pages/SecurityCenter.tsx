import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { KeyRound, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

type Factor = { id: string; factor_type: string; friendly_name?: string | null; status: string; phone?: string | null };

export default function SecurityCenter() {
  const [loading,setLoading]=useState(true);
  const [userEmail,setUserEmail]=useState("");
  const [factors,setFactors]=useState<Factor[]>([]);
  const [enrolling,setEnrolling]=useState(false);
  const [qr,setQr]=useState<string | null>(null);
  const [factorId,setFactorId]=useState<string | null>(null);
  const [code,setCode]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function load() {
    setLoading(true); setMessage("");
    const [{data:{user}}, {data:{factors:dataFactors}, error}] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.mfa.listFactors(),
    ]);
    setUserEmail(user?.email || "");
    if (!error) setFactors([...(dataFactors?.totp || []), ...(dataFactors?.phone || [])] as Factor[]);
    else setMessage(error.message);
    setLoading(false);
  }
  useEffect(()=>{ void load(); },[]);

  async function enrollTOTP() {
    setBusy(true); setMessage("");
    const {data,error}=await supabase.auth.mfa.enroll({factorType:"totp",friendlyName:"HkTube Authenticator"});
    if(error){setMessage(error.message);setBusy(false);return;}
    setFactorId(data.id); setQr(data.totp?.qr_code || null); setEnrolling(true); setBusy(false);
  }

  async function verifyTOTP() {
    if(!factorId || code.trim().length < 6) return;
    setBusy(true); setMessage("");
    const {data:challenge,error:challengeError}=await supabase.auth.mfa.challenge({factorId});
    if(challengeError){setMessage(challengeError.message);setBusy(false);return;}
    const {error}=await supabase.auth.mfa.verify({factorId,challengeId:challenge.id,code:code.trim()});
    if(error){setMessage(error.message);setBusy(false);return;}
    setEnrolling(false); setQr(null); setFactorId(null); setCode(""); setMessage("Two-step verification is now enabled."); await load(); setBusy(false);
  }

  async function removeFactor(id:string) {
    setBusy(true); setMessage("");
    const {error}=await supabase.auth.mfa.unenroll({factorId:id});
    setMessage(error?.message || "Two-step factor removed."); await load(); setBusy(false);
  }

  async function signOutOthers() {
    setBusy(true); setMessage("");
    const {error}=await supabase.auth.signOut({scope:"others"});
    setMessage(error?.message || "Other active HkTube sessions were signed out.");
    setBusy(false);
  }

  async function signOutEverywhere() {
    setBusy(true); setMessage("");
    const {error}=await supabase.auth.signOut({scope:"global"});
    if(error) setMessage(error.message);
    else location.href="/auth";
    setBusy(false);
  }

  return <HkTubeShell title="Security Center" subtitle="Protect your account, authentication factors and active sessions.">
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 sm:px-0">
      <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5">
        <div className="flex gap-3"><ShieldCheck className="size-6 shrink-0 text-cyan-200"/><div><h2 className="font-bold text-white">Account security</h2><p className="mt-1 text-sm leading-6 text-slate-400">Signed in as {userEmail || "current HkTube account"}. Authentication is enforced by Supabase Auth, while this page provides the controls exposed to the account owner.</p></div></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
        <div className="flex items-start gap-3"><KeyRound className="mt-1 size-5 text-violet-200"/><div className="min-w-0 flex-1"><h2 className="font-bold text-white">Two-step verification</h2><p className="mt-1 text-xs leading-5 text-slate-400">Use an authenticator app with a TOTP code. Verification is performed by Supabase Auth, not by a local browser flag.</p></div></div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Checking authentication factors…</p> : factors.length ? <div className="mt-4 space-y-2">{factors.map(f=><div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-3"><div><p className="text-sm font-bold text-white">{f.friendly_name || "Authenticator"}</p><p className="text-xs text-slate-500">{f.factor_type.toUpperCase()} · {f.status}</p></div><Button variant="ghost" disabled={busy} onClick={()=>void removeFactor(f.id)} className="border border-white/10 text-slate-300"><Trash2 className="mr-2 size-4"/>Remove</Button></div>)}</div> : <Button disabled={busy} onClick={()=>void enrollTOTP()} className="mt-4 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white">{busy ? "Working…" : "Enable authenticator"}</Button>}
        {enrolling && qr ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm font-bold text-white">Scan this QR code</p><img src={qr} alt="Authenticator QR code" className="mt-3 size-48 rounded-xl bg-white p-2"/><p className="mt-3 text-xs text-slate-500">Then enter the current 6-digit code from your authenticator app.</p><div className="mt-3 flex gap-2"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#151a25] px-3 text-center text-lg font-bold tracking-[.3em] text-white outline-none" placeholder="000000"/><Button disabled={busy || code.length<6} onClick={()=>void verifyTOTP()} className="min-h-11">Verify</Button></div></div> : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
        <div className="flex items-start gap-3"><Smartphone className="mt-1 size-5 text-cyan-200"/><div className="flex-1"><h2 className="font-bold text-white">Active sessions</h2><p className="mt-1 text-xs leading-5 text-slate-400">End sessions on other devices or everywhere. Revoked access tokens can remain valid until their normal expiry, so sensitive server actions must still validate authorization.</p></div></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" disabled={busy} onClick={()=>void signOutOthers()} className="border border-white/10 text-slate-200"><LogOut className="mr-2 size-4"/>Sign out other sessions</Button><Button variant="ghost" disabled={busy} onClick={()=>void signOutEverywhere()} className="border border-red-300/20 text-red-200">Sign out everywhere</Button></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-bold text-white">Password & recovery</h2><p className="mt-1 text-xs leading-5 text-slate-400">Password reset and email verification are handled through the authentication flow. Keep your recovery email accessible and never share verification codes.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/auth" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-200">Open sign-in & recovery</Link><Link href="/delete-account" className="inline-flex min-h-10 items-center rounded-xl border border-red-300/15 px-4 text-sm font-bold text-red-200">Delete account</Link></div></section>
      {message ? <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035] p-4 text-sm text-cyan-100">{message}</div> : null}
    </div>
  </HkTubeShell>;
}
