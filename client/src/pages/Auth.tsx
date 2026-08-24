import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function readableAuthError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email ya password ghalat hai.";
  if (value.includes("user already registered")) return "Is email par HkTube account pehle se mojood hai. Login karein.";
  if (value.includes("password")) return "Password kam az kam 8 characters ka hona chahiye.";
  if (value.includes("email")) return "Valid email address enter karein.";
  return message || "Account request complete nahi ho saki. Dobara try karein.";
}

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back to HkTube.");
        navigate("/menu");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Your HkTube account is ready.");
          navigate("/menu");
        } else {
          toast.success("Account created. Email verification complete karke login karein.");
          setMode("login");
          setPassword("");
        }
      }
    } catch (error) {
      toast.error(readableAuthError(error instanceof Error ? error.message : "Account request failed."));
    } finally {
      setPending(false);
    }
  }

  return <HkTubeShell title="HkTube account" subtitle="Apna HkTube account banayein aur channel, library aur creator activity ko ek jagah rakhein.">
    <div className="mx-auto grid min-h-[calc(100dvh-220px)] max-w-md place-items-center px-5 py-10"><section className="w-full rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 via-[#141a2a] to-cyan-400/[.08] p-6 shadow-2xl shadow-black/20 sm:p-8"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"><LockKeyhole className="size-7" /></div><h1 className="mt-5 text-center text-2xl font-black text-white">{mode === "login" ? "Log in to HkTube" : "Create your HkTube account"}</h1><p className="mt-2 text-center text-sm leading-6 text-slate-400">{mode === "login" ? "Apne channel, library aur Creator Studio par continue karein." : "Aapka account Supabase Auth mein protected credentials ke sath save hoga."}</p><form onSubmit={submit} className="mt-7 space-y-4">{mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Display name</span><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} className="h-11 border-white/10 bg-black/20 pl-10 text-white" placeholder="Your name" /></div></label>}<label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 border-white/10 bg-black/20 pl-10 text-white" placeholder="you@example.com" /></div></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Password</span><div className="relative"><Input required minLength={mode === "register" ? 8 : 1} maxLength={128} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-11 border-white/10 bg-black/20 pr-10 text-white" placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label><Button disabled={pending} type="submit" className="h-11 w-full rounded-full bg-violet-500 font-bold text-white hover:bg-violet-400">{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Button></form><button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-center text-sm font-semibold text-cyan-200 hover:text-white">{mode === "login" ? "New to HkTube? Create an account" : "Already have an account? Log in"}</button><p className="mt-5 text-center text-xs leading-5 text-slate-500">Supabase session refresh ke baad bhi account ko remember rakhega. Agar email confirmation enabled hai to pehle inbox se email verify karein.</p><Link href="/" className="mt-5 block text-center text-xs font-semibold text-slate-400 hover:text-white">Back to Home</Link></section></div>
  </HkTubeShell>;
}
