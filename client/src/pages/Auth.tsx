import { useEffect, useState } from "react";
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
  if (value.includes("provider is not enabled") || value.includes("unsupported provider")) return "Google login abhi Supabase mein enable nahi hua. Provider settings check karein.";
  if (value.includes("redirect") && value.includes("not allowed")) return "Google login redirect URL Supabase mein allow nahi hai.";
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
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate("/menu");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) navigate("/menu");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function signInWithGoogle() {
    setGooglePending(true);
    try {
      const redirectTo = "https://hktube.vercel.app";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      toast.error(readableAuthError(error instanceof Error ? error.message : "Google login failed."));
      setGooglePending(false);
    }
  }

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
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
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
    <div className="mx-auto grid min-h-[calc(100dvh-220px)] max-w-md place-items-center px-5 py-10">
      <section className="w-full rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-zinc-300 bg-white text-zinc-950 shadow-sm"><LockKeyhole className="size-7" /></div>
        <h1 className="mt-5 text-center text-2xl font-black text-zinc-950">{mode === "login" ? "Log in to HkTube" : "Create your HkTube account"}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-600">{mode === "login" ? "Apne channel, library aur Creator Studio par continue karein." : "Aapka account Supabase Auth mein protected credentials ke sath save hoga."}</p>

        {mode === "login" && <>
          <Button type="button" disabled={googlePending || pending} onClick={signInWithGoogle} variant="outline" className="mt-7 h-11 w-full rounded-full border-zinc-300 bg-white text-sm font-bold text-zinc-950 shadow-sm hover:bg-zinc-50">
            <span className="mr-2 grid size-5 place-items-center rounded-md border border-zinc-300 bg-white text-xs font-black text-zinc-950">G</span>
            {googlePending ? "Connecting to Google…" : "Continue with Google"}
          </Button>
          <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-zinc-200" /><span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">or</span><div className="h-px flex-1 bg-zinc-200" /></div>
        </>}

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Display name</span><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="Your name" /></div></label>}
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Email</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 border-zinc-300 bg-white pl-10 text-zinc-950" placeholder="you@example.com" /></div></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-600">Password</span><div className="relative"><Input required minLength={mode === "register" ? 8 : 1} maxLength={128} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="h-11 border-zinc-300 bg-white pr-10 text-zinc-950" placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
          <Button disabled={pending || googlePending} type="submit" className="h-11 w-full rounded-full border border-zinc-950 bg-white font-bold text-zinc-950 shadow-sm hover:bg-zinc-100">{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Button>
        </form>
        <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-center text-sm font-semibold text-zinc-700 hover:text-black">{mode === "login" ? "New to HkTube? Create an account" : "Already have an account? Log in"}</button>
        <p className="mt-5 text-center text-xs leading-5 text-zinc-500">Supabase session refresh ke baad bhi account ko remember rakhega. Agar email confirmation enabled hai to pehle inbox se email verify karein.</p>
        <Link href="/" className="mt-5 block text-center text-xs font-semibold text-zinc-500 hover:text-black">Back to Home</Link>
      </section>
    </div>
  </HkTubeShell>;
}
