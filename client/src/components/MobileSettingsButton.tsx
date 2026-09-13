import { Settings } from "lucide-react";
import { Link } from "wouter";

/** Persistent mobile settings shortcut. The header keeps the same HkTube mark/icon. */
export function MobileSettingsButton() {
  return (
    <Link
      href="/settings"
      aria-label="Open Settings"
      title="Settings"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-3 z-30 grid size-11 place-items-center rounded-full border border-white/10 bg-[#121621]/95 text-slate-200 shadow-xl shadow-black/30 backdrop-blur-xl transition hover:bg-violet-500/20 hover:text-white active:scale-95 sm:hidden"
    >
      <Settings className="size-5" />
    </Link>
  );
}
