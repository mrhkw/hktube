import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { KeyRound, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type Factor = { id: string; factor_type: string; friendly_name?: string | null; status: string; phone?: string | null };
type Assurance = { currentLevel: string | null; nextLevel: string | null };
type PendingChallenge = { factorId: string; challengeId: string };

export default function SecurityCenter() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [assurance, setAssurance] = useState<Assurance | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [challengeCode, setChallengeCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const verifiedFactor = useMemo(() => factors.find(factor => factor.factor_type === "totp" && factor.status === "verified") || factors.find(factor => factor.factor_type === "phone" && factor.status === "verified"), [factors]);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [userResult, factorResult, assuranceResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      const user = userResult.data.user;
      setUserEmail(user?.email || "");
      if (!user) {
        setFactors([]);
        setAssurance(null);
        setMessage("Sign in with your HkTube account to manage two-step verification.");
      } else {
        const nextFactors = factorResult.data
          ? [...(factorResult.data.totp || []), ...(factorResult.data.phone || [])] as Factor[]
          : [];
        setFactors(nextFactors);
        setAssurance(assuranceResult.data ? {
          currentLevel: assuranceResult.data.currentLevel,
          nextLevel: assuranceResult.data.nextLevel,
        } : null);
        if (factorResult.error) setMessage(factorResult.error.message);
        else if (assuranceResult.error) setMessage(assuranceResult.error.message);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Security settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function enrollTOTP() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "HkTube Authenticator" });
    if (error) { setMessage(error.message); setBusy(false); return; }
    setFactorId(data.id);
    setQr(data.totp?.qr_code || null);
    setEnrolling(true);
    setBusy(false);
  }

  async function verifyTOTP() {
    if (!factorId || code.trim().length < 6) return;
    setBusy(true);
    setMessage("");
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) { setMessage(challengeError.message); setBusy(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challengeData.id, code: code.trim() });
    if (error) { setMessage(error.message); setBusy(false); return; }
    setEnrolling(false);
    setQr(null);
    setFactorId(null);
    setCode("");
    await load();
    setMessage("Two-step verification is enabled and this session is verified.");
    setBusy(false);
  }

  async function beginChallenge() {
    if (!verifiedFactor) { setMessage("No verified second factor is available for this account."); return; }
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id });
    if (error) { setMessage(error.message); setBusy(false); return; }
    setChallenge({ factorId: verifiedFactor.id, challengeId: data.id });
    setChallengeCode("");
    setBusy(false);
  }

  async function verifyChallenge() {
    if (!challenge || challengeCode.trim().length !== 6) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.verify({ factorId: challenge.factorId, challengeId: challenge.challengeId, code: challengeCode.trim() });
    if (error) { setMessage(error.message); setBusy(false); return; }
    setChallenge(null);
    setChallengeCode("");
    await load();
    setMessage("Two-step verification complete. This session can now perform protected creator and admin actions.");
    setBusy(false);
  }

  async function removeFactor(id: string) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) setMessage(error.message);
    else setMessage("Two-step factor removed. High-impact HkTube actions will require a verified factor again.");
    await load();
    setBusy(false);
  }

  async function signOutOthers() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setMessage(error?.message || "Other active HkTube sessions were signed out.");
    setBusy(false);
  }

  async function signOutEverywhere() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) setMessage(error.message);
    else location.href = "/auth";
    setBusy(false);
  }

  const needsStepUp = assurance?.currentLevel !== "aal2" && assurance?.nextLevel === "aal2";

  return <HkTubeShell title="Security Center" subtitle="Protect your account, authentication factors and active sessions.">
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 sm:px-0">
      <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[.035] p-5">
        <div className="flex gap-3"><ShieldCheck className="size-6 shrink-0 text-cyan-200"/><div><h2 className="font-bold text-white">Account security</h2><p className="mt-1 text-sm leading-6 text-slate-400">Signed in as {userEmail || "current HkTube account"}. HkTube verifies your Supabase session on the server; uploads, publishing, channel changes and admin actions require a signed AAL2 second-factor claim.</p></div></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
        <div className="flex items-start gap-3"><KeyRound className="mt-1 size-5 text-violet-200"/><div className="min-w-0 flex-1"><h2 className="font-bold text-white">Two-step verification</h2><p className="mt-1 text-xs leading-5 text-slate-400">Use an authenticator app with a TOTP code. The server checks Supabase’s signed assurance level; a browser-only setting cannot unlock protected actions.</p></div></div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Checking authentication factors…</p> : !userEmail ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-3 text-sm text-amber-100">{message || "Sign in with your HkTube account to manage security factors."}<Link href="/auth" className="ml-2 underline">Sign in</Link></div> : <>
          {factors.length ? <div className="mt-4 space-y-2">{factors.map(factor => <div key={factor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-3"><div><p className="text-sm font-bold text-white">{factor.friendly_name || "Authenticator"}</p><p className="text-xs text-slate-500">{factor.factor_type.toUpperCase()} · {factor.status}</p></div><Button variant="ghost" disabled={busy || assurance?.currentLevel !== "aal2"} onClick={() => void removeFactor(factor.id)} className="border border-white/10 text-slate-300"><Trash2 className="mr-2 size-4"/>Remove</Button></div>)}</div> : <Button disabled={busy} onClick={() => void enrollTOTP()} className="mt-4 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 font-bold text-white">{busy ? "Working…" : "Enable authenticator"}</Button>}
          {assurance?.currentLevel === "aal2" ? <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.04] p-3 text-sm text-emerald-100">This session has completed two-step verification.</p> : needsStepUp ? <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-4"><p className="text-sm font-semibold text-amber-100">Your account has MFA, but this login is not verified with the second factor yet. Complete verification before uploads, publishing or admin actions.</p>{!challenge ? <Button disabled={busy || !verifiedFactor} onClick={() => void beginChallenge()} className="mt-3">{busy ? "Working…" : "Verify this session"}</Button> : <div className="mt-3 flex gap-2"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={challengeCode} onChange={event => setChallengeCode(event.target.value.replace(/\D/g, ""))} aria-label="Second-factor code" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#151a25] px-3 text-center text-lg font-bold tracking-[.3em] text-white outline-none" placeholder="000000"/><Button disabled={busy || challengeCode.length !== 6} onClick={() => void verifyChallenge()} className="min-h-11">Verify</Button></div>}</div> : <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-3 text-sm text-amber-100">No verified authenticator is enabled. Set one up before using high-impact creator or admin actions.</p>}
          {enrolling && qr ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm font-bold text-white">Scan this QR code</p><img src={qr} alt="Authenticator QR code" className="mt-3 size-48 rounded-xl bg-white p-2"/><p className="mt-3 text-xs text-slate-500">Then enter the current 6-digit code from your authenticator app.</p><div className="mt-3 flex gap-2"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} aria-label="Authenticator setup code" className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#151a25] px-3 text-center text-lg font-bold tracking-[.3em] text-white outline-none" placeholder="000000"/><Button disabled={busy || code.length < 6} onClick={() => void verifyTOTP()} className="min-h-11">Verify</Button></div></div> : null}
        </>}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
        <div className="flex items-start gap-3"><Smartphone className="mt-1 size-5 text-cyan-200"/><div className="flex-1"><h2 className="font-bold text-white">Active sessions</h2><p className="mt-1 text-xs leading-5 text-slate-400">End sessions on other devices or everywhere. Supabase revokes refresh sessions; an already-issued access token can remain valid until its short expiry, so sensitive HkTube actions also check the session’s assurance level.</p></div></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" disabled={busy || !userEmail} onClick={() => void signOutOthers()} className="border border-white/10 text-slate-200"><LogOut className="mr-2 size-4"/>Sign out other sessions</Button><Button variant="ghost" disabled={busy || !userEmail} onClick={() => void signOutEverywhere()} className="border border-red-300/20 text-red-200">Sign out everywhere</Button></div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-bold text-white">Password & recovery</h2><p className="mt-1 text-xs leading-5 text-slate-400">Password reset and email verification are handled through the authentication flow. Keep your recovery email accessible and never share verification codes.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/auth" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-200">Open sign-in & recovery</Link><Link href="/delete-account" className="inline-flex min-h-10 items-center rounded-xl border border-red-300/15 px-4 text-sm font-bold text-red-200">Delete account</Link></div></section>
      {message && userEmail ? <div role="status" className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035] p-4 text-sm text-cyan-100">{message}</div> : null}
    </div>
  </HkTubeShell>;
}
