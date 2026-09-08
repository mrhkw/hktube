import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Home, Search } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-white px-5 py-10 text-neutral-950">
      <Card className="w-full max-w-xl overflow-hidden rounded-3xl border-neutral-200 bg-white shadow-[0_24px_70px_rgba(0,0,0,.08)]">
        <CardContent className="px-6 py-12 text-center sm:px-10 sm:py-16">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-neutral-950 text-white shadow-lg">
            <AlertCircle className="size-8" aria-hidden="true" />
          </div>
          <p className="mt-7 text-xs font-bold uppercase tracking-[.22em] text-neutral-400">HkTube</p>
          <h1 className="mt-2 text-5xl font-black tracking-[-.04em] sm:text-6xl">404</h1>
          <h2 className="mt-3 text-xl font-bold">Page nahi mili</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">Ye page available nahi hai. Ho sakta hai link change ya remove ho gaya ho.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={() => setLocation("/")} className="rounded-full bg-neutral-950 px-6 text-white hover:bg-neutral-800"><Home className="mr-2 size-4" />Home</Button>
            <Button variant="outline" onClick={() => window.history.back()} className="rounded-full border-neutral-300 px-6"><ArrowLeft className="mr-2 size-4" />Back</Button>
            <Button variant="outline" onClick={() => setLocation("/search")} className="rounded-full border-neutral-300 px-6"><Search className="mr-2 size-4" />Search</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
