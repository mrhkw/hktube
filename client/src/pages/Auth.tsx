import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, RefreshCw, UserRound } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function readableAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email ya password ghalat hai.";
  if (value.includes("user already registered")) return "Is email par HKW account pehle se mojood hai. Login karein.";
  if (value.includes("email not confirmed")) return "Pehle apni email verify karein.";
  if (value.includes("rate limit") || value.includes("too many")) return "Bohat zyada attempts ho gaye. Thori dair baad dobara try karein.";
  if (value.includes("password")) return "Password kam az kam 8 characters ka hona chahiye.";
  if (value.includes("email")) return "Valid email address enter karein.";
  return message || "Account request complete nahi ho saki. Dobara try karein.";
}

function validPassword(value: string) { return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value); }
function withTimeout<T>(promise: PromiseLike<T>, message: string, timeoutMs = 20_000) { return Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs))]); }
function authRedirectUrl() { return `${window.location.origin}/auth`; }

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerStep, setRegisterStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem("hkw-pending-signup") || "null") as { name?: string; email?: string } | null;
      if (saved?.email) { setMode("register"); setRegisterStep("otp"); setName(saved.name || ""); setEmail(saved.email); }
    } catch { window.localStorage.removeItem("hkw-pending-signup"); }
    supabase.auth.getSession().then(({ data }) => { if (active && data.session) navigate("/menu"); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => { if (active && session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) navigate("/menu"); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [navigate]);

  useEffect(() => {
    if (!resendIn) return;
    const timer = window.setInterval(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  function switchMode(next: "login" | "register") {
    window.localStorage.removeItem("hkw-pending-signup");
    setMode(next); setRegisterStep("details"); setOtp(""); setPassword(""); setConfirmPassword("");
  }

  async function sendSignupOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error("Apna naam enter karein."); return; }
    if (!email.trim() || !email.includes("@")) { toast.error("Valid Gmail/email enter karein."); return; }
    if (!validPassword(password)) { toast.error("Password 8+ characters ka ho aur is mein letter aur number ho."); return; }
    if (password !== confirmPassword) { toast.error("Passwords match nahi karte."); return; }
    setPending(true);
    try {
      const { data, error } = await withTimeout(supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: authRedirectUrl(), data: { display_name: name.trim(), full_name: name.trim() } } }), "OTP request is taking too long. Dobara try karein.");
      if (error) throw error;
      if (data.session) { toast.success("HKW account ready. Welcome!"); navigate("/menu"); return; }
      window.localStorage.setItem("hkw-pending-signup", JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }));
      setRegisterStep("otp"); setOtp(""); setResendIn(45);
      toast.success(`6-digit verification code ${email.trim().toLowerCase()} par bhej diya gaya.`);
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "OTP send nahi ho saka.")); }
    finally { setPending(false); }
  }

  async function verifySignupOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error("6-digit OTP enter karein."); return; }
    setPending(true);
    try {
      const { error } = await withTimeout(supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: "signup" }), "OTP verification is taking too long.");
      if (error) throw error;
      window.localStorage.removeItem("hkw-pending-signup");
      toast.success("HKW account ready. Welcome!"); navigate("/menu");
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "OTP verify nahi ho saka.")); }
    finally { setPending(false); }
  }

  async function resendOtp() {
    if (resendIn > 0 || pending) return;
    setPending(true);
    try {
      const { error } = await withTimeout(supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: authRedirectUrl() } }), "OTP request is taking too long.");
      if (error) throw error;
      setResendIn(45); setOtp(""); toast.success("Naya OTP bhej diya gaya.");
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "OTP resend nahi ho saka.")); }
    finally { setPending(false); }
  }

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault(); setPending(true);
    try {
      const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }), "Login is taking too long. Check your connection.");
      if (error) throw error;
      toast.success("Welcome back to HKW."); navigate("/menu");
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "Login failed.")); }
    finally { setPending(false); }
  }

  return <HkTubeShell title="HKW account" subtitle="Apna HKW account banayein ya login karein.">
    <div className="mx-auto grid min-h-[calc(100dvh-220px)] max-w-md place-items-center px-5 py-10">
      <section className="relative w-full overflow-hidden rounded-[32px] border border-violet-200/70 bg-white p-6 shadow-[0_24px_80px_rgba(91,33,182,.14)] transition-all duration-500 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-48 animate-pulse rounded-full bg-violet-200/45 blur-3xl" /><div className="pointer-events-none absolute -bottom-24 -left-20 size-48 animate-pulse rounded-full bg-cyan-200/45 blur-3xl [animation-delay:700ms]" /><div className="pointer-events-none absolute left-1/2 top-0 h-1 w-32 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-500" />
        <div className="relative mx-auto grid size-20 place-items-center"><div className="absolute inset-0 rounded-[28%] border-2 border-violet-300/70 animate-[spin_7s_linear_infinite]" /><div className="absolute -inset-2 rounded-[32%] border border-cyan-300/50 animate-pulse" /><div className="relative grid size-16 place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-[0_0_35px_rgba(124,58,237,.35)]"><img src="/brand/hkw-mark.webp" alt="HKW" className="size-full object-cover" /></div></div>
        <h1 className="mt-5 text-center text-2xl font-black text-zinc-950">{mode === "login" ? "Log in to HKW" : registerStep === "otp" ? "Verify your email" : "Create your HKW account"}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-600">{mode === "login" ? "Apne channel, library aur Creator Studio par continue karein." : registerStep === "otp" ? <>Code ya verification button <b>{email}</b> par bheja gaya hai.</> : "Facebook-style simple signup — apna naam, email aur password set karein."}</p>
        {mode === "register" && <div className="relative mx-auto mt-6 flex max-w-xs items-center justify-between"><span className="absolute left-5 right-5 top-2.5 h-px bg-zinc-200" /><span className={`relative z-10 grid size-5 place-items-center rounded-full text-[10px] font-black ${registerStep === "details" ? "bg-violet-600 text-white" : "bg-emerald-500 text-white"}`}>{registerStep === "details" ? "1" : "✓"}</span><span className={`relative z-10 grid size-5 place-items-center rounded-full text-[10px] font-black ${registerStep === "otp" ? "bg-violet-600 text-white" : "bg-zinc-200 text-zinc-500"}`}>2</span></div>}
        {mode === "register" && registerStep === "otp" ? <form onSubmit={verifySignupOtp} className="mt-7 animate-in space-y-5 duration-500">
          <label className="block"><span className="mb-3 block text-center text-xs font-bold uppercase tracking-wider text-zinc-600">6-digit email code</span><div role="group" aria-label="6-digit email code" onClick={() => otpInputRef.current?.focus()} className="relative mx-auto flex max-w-[290px] cursor-text justify-center gap-2"><Input ref={otpInputRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0" aria-label="Enter six digit code" />{Array.from({ length: 6 }, (_, index) => <span key={index} className={`grid size-11 place-items-center rounded-xl border text-lg font-black transition-all duration-200 ${otp[index] ? "border-violet-500 bg-violet-50 text-violet-700 shadow-[0_0_16px_rgba(124,58,237,.18)]" : index === otp.length ? "border-violet-400 bg-white ring-2 ring-violet-100" : "border-zinc-300 bg-zinc-50 text-zinc-300"}`}>{otp[index] || "•"}</span>)}</div></label>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900"><Mail className="mr-2 inline size-4" />Gmail inbox aur spam folder check karein. Code 10 minutes ke liye valid hai.</div>
          <Button disabled={pending || otp.length !== 6} type="submit" className="h-11 w-full rounded-full bg-zinc-950 font-bold text-white hover:bg-zinc-800">{pending ? "Verifying…" : <><CheckCircle2 className="mr-2 size-4" />Verify & create account</>}</Button>
          <div className="flex items-center justify-between text-xs font-semibold"><button type="button" onClick={() => { window.localStorage.removeItem("hkw-pending-signup"); setRegisterStep("details"); setOtp(""); }} className="inline-flex items-center gap-1 text-zinc-500 hover:text-black"><ArrowLeft className="size-3.5" />Change details</button><button type="button" disabled={resendIn > 0 || pending} onClick={() => void resendOtp()} className="inline-flex items-center gap-1 text-violet-700 disabled:text-zinc-400"><RefreshCw className="size-3.5" />{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</button></div>
        </form> : <form onSubmit={mode === "login" ? submitLogin : sendSignupOtp} className="mt-7 space-y-4">
          {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Full name</span><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="Your name" /></div></label>}
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Gmail / Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="you@gmail.com" /></div></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Password</span><div className="relative"><Input required minLength={mode === "register" ? 8 : 1} maxLength={128} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} className="h-11 border-zinc-300 bg-white pr-10 text-zinc-950" placeholder={mode === "register" ? "8+ chars with letter and number" : "Your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
          {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Confirm password</span><div className="relative"><Input required minLength={8} maxLength={128} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-11 border-zinc-300 bg-white pr-10 text-zinc-950" placeholder="Repeat password" /><button type="button" aria-label={showConfirm ? "Hide password" : "Show password"} onClick={() => setShowConfirm(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><span className="mt-1.5 block text-xs text-zinc-500">OTP verify hone ke baad password activate hoga.</span></label>}
          <Button disabled={pending} type="submit" className="h-11 w-full rounded-full bg-zinc-950 font-bold text-white hover:bg-zinc-800">{pending ? "Please wait…" : mode === "login" ? <><KeyRound className="mr-2 size-4" />Log in</> : <><ArrowRight className="mr-2 size-4" />Continue to email verification</>}</Button>
        </form>}
        <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-center text-sm font-semibold text-zinc-700 hover:text-black">{mode === "login" ? "New to HKW? Create an account" : "Already have an account? Log in"}</button>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-zinc-500"><LockKeyhole className="size-3.5" />HKW email authentication. No Google sign-in.</p>
        <Link href="/" className="mt-5 block text-center text-xs font-semibold text-zinc-500 hover:text-black">Back to Home</Link>
      </section>
    </div>
  </HkTubeShell>;
}
