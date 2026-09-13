import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function readableAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("incorrect")) return "Email ya password ghalat hai.";
  if (value.includes("already exists") || value.includes("already registered")) return "Is email par HkTube account pehle se mojood hai. Login karein.";
  if (value.includes("database is unavailable")) return "Server database abhi available nahi hai. Please try again in a moment.";
  return message || "Account request complete nahi ho saki. Dobara try karein.";
}

function validSignupPassword(value: string) { return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value); }

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = trpc.auth.login.useMutation();
  const register = trpc.auth.register.useMutation();
  const utils = trpc.useUtils();
  const pending = login.isPending || register.isPending;

  useEffect(() => {
    let active = true;
    void utils.auth.me.fetch().then(user => { if (active && user) navigate("/menu"); }).catch(() => {});
    return () => { active = false; };
  }, [navigate, utils]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (mode === "login") {
        await login.mutateAsync({ email: email.trim(), password });
        await utils.auth.me.invalidate();
        toast.success("Welcome back to HkTube.");
        navigate("/menu");
      } else {
        if (!validSignupPassword(password)) throw new Error("Password should be at least 8 characters and contain at least one letter and one number.");
        await register.mutateAsync({ name: name.trim(), email: email.trim(), password });
        await utils.auth.me.invalidate();
        toast.success("Your HkTube account is ready.");
        navigate("/menu");
      }
    } catch (error) { toast.error(readableAuthError(error instanceof Error ? error.message : "Account request failed.")); }
  }

  return <HkTubeShell title="HkTube account" subtitle="Apna HkTube account banayein aur channel, library aur creator activity ko ek jagah rakhein.">
    <div className="mx-auto grid min-h-[calc(100dvh-220px)] max-w-md place-items-center px-5 py-10">
      <section className="w-full rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-zinc-300 bg-white text-zinc-950 shadow-sm"><LockKeyhole className="size-7" /></div>
        <h1 className="mt-5 text-center text-2xl font-black text-zinc-950">{mode === "login" ? "Log in to HkTube" : "Create your HkTube account"}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-600">{mode === "login" ? "Apne channel, library aur Creator Studio par continue karein." : "Aapka account HkTube ke secure server session ke sath save hoga."}</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Display name</span><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="Your name" /></div></label>}
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="you@example.com" /></div></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Password</span><div className="relative"><Input required minLength={mode === "register" ? 8 : 1} maxLength={128} pattern={mode === "register" ? "(?=.*[A-Za-z])(?=.*\\d).{8,}" : undefined} title={mode === "register" ? "8 characters, including at least 1 letter and 1 number" : undefined} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-11 border-zinc-300 bg-white pr-10 text-zinc-950" placeholder={mode === "register" ? "8+ chars with a letter and number" : "Your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{mode === "register" && <span className="mt-1.5 block text-xs text-zinc-500">8 characters, including at least 1 letter and 1 number.</span>}</label>
          <Button disabled={pending} type="submit" className="h-11 w-full rounded-full border border-zinc-950 bg-white font-bold text-zinc-950 shadow-sm hover:bg-zinc-100">{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Button>
        </form>
        <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-center text-sm font-semibold text-zinc-700 hover:text-black">{mode === "login" ? "New to HkTube? Create an account" : "Already have an account? Log in"}</button>
        <Link href="/" className="mt-5 block text-center text-xs font-semibold text-zinc-500 hover:text-black">Back to Home</Link>
      </section>
    </div>
  </HkTubeShell>;
}
