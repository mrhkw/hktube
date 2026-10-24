import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, Phone, RefreshCw, Smartphone, UserRound } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type AuthMethod = "email" | "phone";
type Country = { code: string; name: string; dial: string; flag: string };
const COUNTRIES: Country[] = [
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
];

function readableAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("unexpected status code returned from hook") || value.includes("unexpected_failure") || value.includes("email provider rejected") || value.includes("email provider is not configured")) return "HkTube ka email verification provider abhi sahi configure nahi. Account verification complete nahi ho saki; administrator ko verified sending domain set karna hoga.";
  if (value.includes("invalid login credentials")) return "Email/phone ya password ghalat hai.";
  if (value.includes("user already registered") || value.includes("already been registered")) return "Is email/phone par HKW account pehle se mojood hai. Login karein.";
  if (value.includes("email not confirmed")) return "Pehle apni email verify karein.";
  if (value.includes("sms") && (value.includes("provider") || value.includes("not enabled") || value.includes("disabled"))) return "Phone OTP provider abhi Supabase mein enabled nahi hai.";
  if (value.includes("phone") && value.includes("invalid")) return "Country code ke sath valid phone number enter karein.";
  if (value.includes("rate limit") || value.includes("too many")) return "Bohat zyada attempts ho gaye. Thori dair baad dobara try karein.";
  if (value.includes("password")) return "Password kam az kam 12 characters ka hona chahiye.";
  if (value.includes("email")) return "Valid email address enter karein.";
  return message || "Account request complete nahi saki. Dobara try karein.";
}
function passwordPolicy(value: string) {
  const characters = Array.from(value).length;
  return { characters, length: characters >= 12, uppercase: /[A-Z]/.test(value), lowercase: /[a-z]/.test(value), number: /\d/.test(value), special: /[^A-Za-z\d\s]/.test(value), spaces: /^\S(?:.*\S)?$/.test(value) };
}
function validPassword(value: string) { const p = passwordPolicy(value); return p.length && p.uppercase && p.lowercase && p.number && p.special && p.spaces; }
function missingPasswordRules(value: string) { const p = passwordPolicy(value); return [!p.length && "12 characters", !p.uppercase && "1 uppercase letter", !p.lowercase && "1 lowercase letter", !p.number && "1 number", !p.special && "1 special character", !p.spaces && "no leading/trailing spaces"].filter(Boolean) as string[]; }
function withTimeout<T>(promise: PromiseLike<T>, message: string, timeoutMs = 20_000) { return Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error(message)), timeoutMs))]); }
function authRedirectUrl() { return `${window.location.origin}/auth`; }
function normalizePhone(country: Country, value: string) { return `${country.dial}${value.replace(/\D/g, "").replace(/^0+/, "")}`; }

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [method, setMethod] = useState<AuthMethod>("email");
  const [countryCode, setCountryCode] = useState("PK");
  const [registerStep, setRegisterStep] = useState<"details" | "otp">("details");
  const [loginStep, setLoginStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryConfirm, setRecoveryConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const authFlowRef = useRef<"idle" | "login-otp" | "auth-pending" | "complete">("idle");
  const country = COUNTRIES.find(item => item.code === countryCode) || COUNTRIES[0];
  const identity = method === "email" ? email.trim().toLowerCase() : normalizePhone(country, phone);
  const identityLabel = method === "email" ? email.trim().toLowerCase() : `${country.dial} ${phone}`;

  async function continueAfterAuthentication() {
    if (authFlowRef.current === "complete") return;
    authFlowRef.current = "complete";
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!error && data.currentLevel !== "aal2" && data.nextLevel === "aal2") {
        navigate("/settings/security?challenge=1");
        return;
      }
    } catch { /* server-side AAL2 enforcement still protects sensitive operations */ }
    navigate("/menu");
  }

  useEffect(() => {
    let active = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem("hkw-pending-signup") || "null") as { name?: string; email?: string; phone?: string; method?: AuthMethod; countryCode?: string } | null;
      if (saved && ((saved.email && saved.method !== "phone") || saved.phone)) { setMode("register"); setRegisterStep("otp"); setName(saved.name || ""); setMethod(saved.method || (saved.phone ? "phone" : "email")); setCountryCode(saved.countryCode || "PK"); setEmail(saved.email || ""); setPhone(saved.phone || ""); }
    } catch { window.localStorage.removeItem("hkw-pending-signup"); }
    supabase.auth.getSession().then(({ data }) => { if (!active || !data.session) return; if (window.location.hash.includes("type=recovery")) setRecoveryMode(true); else if (authFlowRef.current === "idle") void continueAfterAuthentication(); });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => { if (!active || !session) return; if (event === "PASSWORD_RECOVERY") { setRecoveryMode(true); return; } if (authFlowRef.current === "idle" && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) void continueAfterAuthentication(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [navigate]);
  useEffect(() => { if (!resendIn) return; const timer = window.setInterval(() => setResendIn(value => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [resendIn]);

  function switchMode(next: "login" | "register") { window.localStorage.removeItem("hkw-pending-signup"); authFlowRef.current = "idle"; setMode(next); setRegisterStep("details"); setLoginStep("details"); setOtp(""); setPassword(""); setConfirmPassword(""); }
  function validateIdentity() {
    if (method === "email" && (!email.trim() || !email.includes("@"))) { toast.error("Valid Gmail/email enter karein."); return false; }
    if (method === "phone" && phone.replace(/\D/g, "").length < 6) { toast.error("Country code ke sath valid phone number enter karein."); return false; }
    return true;
  }

  async function sendSignupOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error("Apna naam enter karein."); return; }
    if (!validateIdentity()) return;
    if (!validPassword(password)) { toast.error(`Password rules missing: ${missingPasswordRules(password).join(", ")}.`); return; }
    if (password !== confirmPassword) { toast.error("Passwords match nahi karte."); return; }
    setPending(true);
    authFlowRef.current = "auth-pending";
    try {
      const request = method === "email"
        ? supabase.auth.signUp({ email: identity, password, options: { emailRedirectTo: authRedirectUrl(), data: { display_name: name.trim(), full_name: name.trim() } } })
        : supabase.auth.signUp({ phone: identity, password, options: { data: { display_name: name.trim(), full_name: name.trim() } } });
      const { data, error } = await withTimeout(request, "OTP request is taking too long. Dobara try karein.");
      if (error) throw error;
      if (data.session) { toast.success("HKW account ready. Welcome!"); await continueAfterAuthentication(); return; }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { authFlowRef.current = "idle"; setMode("login"); setRegisterStep("details"); setLoginStep("details"); setPassword(""); setConfirmPassword(""); toast.error("Is email/phone par account pehle se bana hua hai. Signup nahi, Login use karein."); return; }
      authFlowRef.current = "idle";
      window.localStorage.setItem("hkw-pending-signup", JSON.stringify({ name: name.trim(), email: method === "email" ? identity : "", phone: method === "phone" ? phone : "", method, countryCode }));
      setRegisterStep("otp"); setOtp(""); setResendIn(45); toast.success(`${method === "email" ? "Verification email" : "SMS OTP"} ${identityLabel} par bhej diya gaya.`);
    } catch (error) { authFlowRef.current = "idle"; toast.error(readableAuthError(error instanceof Error ? error.message : "OTP send nahi ho saka.")); } finally { setPending(false); }
  }

  async function verifySignupOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error("6-digit OTP enter karein."); return; }
    setPending(true);
    authFlowRef.current = "auth-pending";
    try {
      const request = method === "email" ? supabase.auth.verifyOtp({ email: identity, token: otp, type: "signup" }) : supabase.auth.verifyOtp({ phone: identity, token: otp, type: "sms" });
      const { error } = await withTimeout(request, "OTP verification is taking too long.");
      if (error) throw error;
      window.localStorage.removeItem("hkw-pending-signup"); toast.success("HKW account ready. Welcome!"); await continueAfterAuthentication();
    } catch (error) { authFlowRef.current = "idle"; toast.error(readableAuthError(error instanceof Error ? error.message : "OTP verify nahi ho saka.")); } finally { setPending(false); }
  }

  async function sendLoginOtp() {
    const request = method === "email" ? supabase.auth.signInWithOtp({ email: identity, options: { shouldCreateUser: false, emailRedirectTo: authRedirectUrl() } }) : supabase.auth.signInWithOtp({ phone: identity, options: { shouldCreateUser: false } });
    const { error } = await withTimeout(request, "Login OTP request is taking too long.");
    if (error) throw error;
    authFlowRef.current = "login-otp"; setLoginStep("otp"); setOtp(""); setResendIn(45); toast.success(`${method === "email" ? "Login code" : "Login SMS OTP"} ${identityLabel} par bhej diya gaya.`);
  }

  async function useLoginCode() {
    if (!validateIdentity()) return;
    setPending(true);
    try { await sendLoginOtp(); } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "Login code nahi bheja ja saka.")); } finally { setPending(false); }
  }

  async function requestPasswordReset() {
    if (method !== "email" || !email.trim() || !email.includes("@")) { toast.error("Password reset ke liye pehle apni email enter karein."); return; }
    setPending(true);
    try {
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(identity, { redirectTo: authRedirectUrl() }), "Password reset request is taking too long.");
      if (error) throw error;
      toast.success("Password reset link email par bhej diya gaya.");
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "Password reset nahi ho saka.")); } finally { setPending(false); }
  }

  async function updateRecoveredPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!validPassword(recoveryPassword)) { toast.error(`Password rules missing: ${missingPasswordRules(recoveryPassword).join(", ")}.`); return; }
    if (recoveryPassword !== recoveryConfirm) { toast.error("Passwords match nahi karte."); return; }
    setPending(true);
    try {
      const { error } = await withTimeout(supabase.auth.updateUser({ password: recoveryPassword }), "Password update is taking too long.");
      if (error) throw error;
      toast.success("Password update ho gaya. Welcome back to HKW.");
      setRecoveryMode(false);
      authFlowRef.current = "auth-pending";
      await continueAfterAuthentication();
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "Password update nahi ho saka.")); } finally { setPending(false); }
  }

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!validateIdentity()) return;
    if (!password) { toast.error("Password enter karein."); return; }
    setPending(true);
    authFlowRef.current = "auth-pending";
    try {
      const request = method === "email" ? supabase.auth.signInWithPassword({ email: identity, password }) : supabase.auth.signInWithPassword({ phone: identity, password });
      const { error } = await withTimeout(request, "Login is taking too long. Check your connection.");
      if (error) throw error;
      toast.success("Welcome back to HKW.");
      await continueAfterAuthentication();
    } catch (error) { authFlowRef.current = "idle"; toast.error(readableAuthError(error instanceof Error ? error.message : "Login failed.")); } finally { setPending(false); }
  }

  async function verifyLoginOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error("6-digit OTP enter karein."); return; }
    setPending(true);
    authFlowRef.current = "auth-pending";
    try {
      const request = method === "email" ? supabase.auth.verifyOtp({ email: identity, token: otp, type: "email" }) : supabase.auth.verifyOtp({ phone: identity, token: otp, type: "sms" });
      const { error } = await withTimeout(request, "Login OTP verification is taking too long.");
      if (error) throw error;
      toast.success("Welcome back to HKW."); await continueAfterAuthentication();
    } catch (error) { authFlowRef.current = "login-otp"; toast.error(readableAuthError(error instanceof Error ? error.message : "Login OTP verify nahi ho saka.")); } finally { setPending(false); }
  }

  async function resendOtp() {
    if (resendIn > 0 || pending) return;
    setPending(true);
    try {
      const request = mode === "login"
        ? (method === "email" ? supabase.auth.signInWithOtp({ email: identity, options: { shouldCreateUser: false, emailRedirectTo: authRedirectUrl() } }) : supabase.auth.signInWithOtp({ phone: identity, options: { shouldCreateUser: false } }))
        : (method === "email" ? supabase.auth.resend({ type: "signup", email: identity, options: { emailRedirectTo: authRedirectUrl() } }) : supabase.auth.resend({ type: "sms", phone: identity }));
      const { error } = await withTimeout(request, "OTP request is taking too long.");
      if (error) throw error;
      setResendIn(45); setOtp(""); toast.success("Naya OTP bhej diya gaya.");
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "OTP resend nahi ho saka.")); } finally { setPending(false); }
  }

  const otpMode = (mode === "register" && registerStep === "otp") || (mode === "login" && loginStep === "otp");
  const policy = passwordPolicy(password);
  return <HkTubeShell title="HKW account" subtitle="Apna HKW account banayein ya login karein.">
    <div className="mx-auto grid min-h-[calc(100dvh-220px)] max-w-md place-items-center px-5 py-10"><section className="relative w-full overflow-hidden rounded-[32px] border border-violet-200/70 bg-white p-6 shadow-[0_24px_80px_rgba(91,33,182,.14)] transition-all duration-500 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 size-48 animate-pulse rounded-full bg-violet-200/45 blur-3xl" /><div className="pointer-events-none absolute -bottom-24 -left-20 size-48 animate-pulse rounded-full bg-cyan-200/45 blur-3xl" /><div className="pointer-events-none absolute left-1/2 top-0 h-1 w-32 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-500" />
      <div className="relative mx-auto grid size-20 place-items-center"><div className="absolute inset-0 animate-[spin_7s_linear_infinite] rounded-[28%] border-2 border-violet-300/70" /><div className="absolute -inset-2 animate-pulse rounded-[32%] border border-cyan-300/50" /><div className="relative grid size-16 place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-[0_0_35px_rgba(124,58,237,.35)]"><img src="/brand/hktube-new-mark-transparent.png" alt="HkTube NEW" className="size-full object-cover" /></div></div>
      <h1 className="mt-5 text-center text-2xl font-black text-zinc-950">{mode === "login" ? loginStep === "otp" ? "Verify your login" : "Log in to HKW" : registerStep === "otp" ? `Verify your ${method === "email" ? "email" : "phone"}` : "Create your HKW account"}</h1>
      <p className="mt-2 text-center text-sm leading-6 text-zinc-600">{otpMode ? <>6-digit code <b>{identityLabel}</b> par bheja gaya hai.</> : mode === "login" ? "Password se direct login karein, ya email/SMS code ka option use karein." : "Email ya phone number se secure HKW account banayein."}</p>
      {mode === "register" && <div className="relative mx-auto mt-6 flex max-w-xs items-center justify-between"><span className="absolute left-5 right-5 top-2.5 h-px bg-zinc-200" /><span className={`relative z-10 grid size-5 place-items-center rounded-full text-[10px] font-black ${registerStep === "details" ? "bg-violet-600 text-white" : "bg-emerald-500 text-white"}`}>{registerStep === "details" ? "1" : "✓"}</span><span className={`relative z-10 grid size-5 place-items-center rounded-full text-[10px] font-black ${registerStep === "otp" ? "bg-violet-600 text-white" : "bg-zinc-200 text-zinc-500"}`}>2</span></div>}
      {otpMode ? <form onSubmit={mode === "login" ? verifyLoginOtp : verifySignupOtp} className="mt-7 animate-in space-y-5 duration-500">
        <label className="block"><span className="mb-3 block text-center text-xs font-bold uppercase tracking-wider text-zinc-600">6-digit {method === "email" ? "email" : "SMS"} code</span><div role="group" aria-label="6-digit verification code" onClick={() => otpInputRef.current?.focus()} className="relative mx-auto flex max-w-[290px] cursor-text justify-center gap-2"><Input ref={otpInputRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0" aria-label="Enter six digit code" />{Array.from({ length: 6 }, (_, index) => <span key={index} className={`grid size-11 place-items-center rounded-xl border text-lg font-black transition-all duration-200 ${otp[index] ? "border-violet-500 bg-violet-50 text-violet-700 shadow-[0_0_16px_rgba(124,58,237,.18)]" : index === otp.length ? "border-violet-400 bg-white ring-2 ring-violet-100" : "border-zinc-300 bg-zinc-50 text-zinc-300"}`}>{otp[index] || "•"}</span>)}</div></label>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900">{method === "email" ? <Mail className="mr-2 inline size-4" /> : <Smartphone className="mr-2 inline size-4" />}{method === "email" ? "Inbox aur spam folder" : "SMS messages"} check karein. Code 10 minutes ke liye valid hai.</div>
        <Button disabled={pending || otp.length !== 6} type="submit" className="h-11 w-full rounded-full bg-zinc-950 font-bold text-white hover:bg-zinc-800">{pending ? "Verifying…" : <><CheckCircle2 className="mr-2 size-4" />{mode === "login" ? "Verify & log in" : "Verify & create account"}</>}</Button>
        <div className="flex items-center justify-between text-xs font-semibold"><button type="button" onClick={() => { window.localStorage.removeItem("hkw-pending-signup"); authFlowRef.current = "idle"; if (mode === "login") setLoginStep("details"); else setRegisterStep("details"); setOtp(""); }} className="inline-flex items-center gap-1 text-zinc-500 hover:text-black"><ArrowLeft className="size-3.5" />Change details</button><button type="button" disabled={resendIn > 0 || pending} onClick={() => void resendOtp()} className="inline-flex items-center gap-1 text-violet-700 disabled:text-zinc-400"><RefreshCw className="size-3.5" />{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</button></div>
      </form> : <form onSubmit={mode === "login" ? submitLogin : sendSignupOtp} className="mt-7 space-y-4">
        {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Full name</span><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="Your name" /></div></label>}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1"><button type="button" onClick={() => setMethod("email")} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${method === "email" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500"}`}><Mail className="size-4" />Email</button><button type="button" onClick={() => setMethod("phone")} className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${method === "phone" ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500"}`}><Phone className="size-4" />Phone</button></div>
        {method === "email" ? <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Gmail / Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="you@gmail.com" /></div></label> : <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Phone number</span><div className="flex gap-2"><select aria-label="Country code" value={countryCode} onChange={event => setCountryCode(event.target.value)} className="h-11 w-[43%] rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none"><option value="">Country</option>{COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.flag} {item.dial} {item.name}</option>)}</select><Input required type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value.replace(/[^\d\s()-]/g, ""))} className="h-11 flex-1 border-zinc-300 bg-white text-zinc-950" placeholder="300 1234567" /></div><span className="mt-1.5 block text-xs text-zinc-500">Country code automatically add hoga: {country.dial}</span></label>}
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Password</span><div className="relative"><Input required minLength={mode === "register" ? 12 : 1} maxLength={128} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} className="h-11 border-zinc-300 bg-white pr-10 text-zinc-950" placeholder={mode === "register" ? "Example: HkwSecure12!" : "Your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{mode === "register" && <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs"><div className="mb-2 flex items-center justify-between font-bold text-zinc-700"><span>Password requirements</span><span className={policy.length ? "text-emerald-600" : "text-zinc-500"}>{policy.characters}/12</span></div><div className="grid grid-cols-2 gap-1.5 text-zinc-500"><span className={policy.length ? "text-emerald-600" : ""}>● 12+ characters</span><span className={policy.uppercase ? "text-emerald-600" : ""}>● Uppercase</span><span className={policy.lowercase ? "text-emerald-600" : ""}>● Lowercase</span><span className={policy.number ? "text-emerald-600" : ""}>● Number</span><span className={policy.special ? "text-emerald-600" : ""}>● Special character</span><span className={policy.spaces ? "text-emerald-600" : ""}>● No outer spaces</span></div></div>}</label>
        {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Confirm password</span><div className="relative"><Input required minLength={12} maxLength={128} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-11 border-zinc-300 bg-white pr-10 text-zinc-950" placeholder="Repeat password" /><button type="button" aria-label={showConfirm ? "Hide password" : "Show password"} onClick={() => setShowConfirm(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{confirmPassword && <span className={`mt-1.5 block text-xs ${password === confirmPassword ? "text-emerald-600" : "text-rose-600"}`}>{password === confirmPassword ? "Passwords match" : "Passwords do not match"}</span>}</label>}
        <Button disabled={pending || (mode === "register" && (!validPassword(password) || password !== confirmPassword))} type="submit" className="h-11 w-full rounded-full bg-zinc-950 font-bold text-white hover:bg-zinc-800">{pending ? "Please wait…" : mode === "login" ? <><KeyRound className="mr-2 size-4" />Log in</> : <><ArrowRight className="mr-2 size-4" />Continue to verification</>}</Button>
      </form>}
      {mode === "login" && loginStep === "details" && <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold"><button type="button" disabled={pending || method !== "email"} onClick={() => void requestPasswordReset()} className="text-violet-700 hover:text-violet-900 disabled:text-zinc-400">Forgot password?</button><button type="button" disabled={pending} onClick={() => void useLoginCode()} className="text-zinc-600 hover:text-black disabled:text-zinc-400">Use {method === "email" ? "email" : "SMS"} code</button></div>}
      {recoveryMode && <div className="absolute inset-0 z-20 rounded-[32px] bg-white p-6 sm:p-8"><h2 className="text-xl font-black text-zinc-950">Set a new password</h2><p className="mt-2 text-sm leading-6 text-zinc-600">Apne HKW account ke liye naya secure password set karein.</p><form onSubmit={updateRecoveredPassword} className="mt-6 space-y-4"><Input required minLength={12} maxLength={128} type="password" value={recoveryPassword} onChange={event => setRecoveryPassword(event.target.value)} className="h-11 border-zinc-300 text-zinc-950" placeholder="New password (12+ characters)" /><Input required minLength={12} maxLength={128} type="password" value={recoveryConfirm} onChange={event => setRecoveryConfirm(event.target.value)} className="h-11 border-zinc-300 text-zinc-950" placeholder="Confirm new password" /><Button disabled={pending} type="submit" className="h-11 w-full rounded-full bg-zinc-950 font-bold text-white">{pending ? "Updating…" : "Update password"}</Button></form></div>}
      <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-center text-sm font-semibold text-zinc-700 hover:text-black">{mode === "login" ? "New to HKW? Create an account" : "Already have an account? Log in"}</button>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-zinc-500"><LockKeyhole className="size-3.5" />Supabase-secured email and phone OTP. No Google sign-in.</p><Link href="/" className="mt-5 block text-center text-xs font-semibold text-zinc-500 hover:text-black">Back to Home</Link>
    </section></div>
  </HkTubeShell>;
}
