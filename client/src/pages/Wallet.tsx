import { HkTubeShell } from "@/components/HkTubeShell";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, WalletCards } from "lucide-react";

export default function Wallet() {
  return (
    <HkTubeShell title="Wallet" subtitle="Creator earnings and payout records.">
      <div className="mx-auto max-w-2xl rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[.08] via-white/[.03] to-violet-400/[.08] p-8 text-center shadow-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-200">
          <WalletCards className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-white">Wallet is not configured yet</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">
          HkTube will show real earnings, payout status, and transaction records here only after a verified payments or creator-revenue provider is connected. No estimated balance or fake payout data is shown.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/library">
            <Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">Back to library</Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10">Open settings</Button>
          </Link>
        </div>
        <Link href="/" className="mt-6 inline-flex items-center text-sm font-semibold text-cyan-200 hover:text-cyan-100">
          <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
          Go to home
        </Link>
      </div>
    </HkTubeShell>
  );
}

