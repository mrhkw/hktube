import { Copy, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ShareModalProps = {
  videoId: number | string;
  videoTitle: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function ShareModal({ videoId, videoTitle, isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);
  if (!isOpen) return null;

  const shareUrl = new URL(`/watch/${videoId}`, window.location.origin).toString();
  const embedUrl = new URL(`/embed/${videoId}`, window.location.origin).toString();
  const embedCode = `<iframe width="560" height="315" src="${embedUrl}" title="${videoTitle.replace(/"/g, "&quot;")}" frameborder="0" allowfullscreen></iframe>`;

  async function copy(value: string, type: "link" | "embed") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Share video" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#10131d] p-5 text-white shadow-2xl shadow-black/60 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Share video</p><h2 className="mt-1 text-lg font-black">{videoTitle}</h2></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close share dialog" className="text-slate-400 hover:bg-white/10 hover:text-white"><X className="size-5" /></Button></div>
      <div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-semibold text-slate-400">Direct link</span><span className="mt-1 flex gap-2"><input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-300 outline-none" /><Button type="button" size="sm" onClick={() => void copy(shareUrl, "link")} className="shrink-0 bg-violet-500 text-white hover:bg-violet-400"><Copy className="mr-1.5 size-3.5" />{copied === "link" ? "Copied" : "Copy"}</Button></span></label><label className="block"><span className="text-xs font-semibold text-slate-400">Embed code</span><textarea readOnly rows={4} value={embedCode} className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/[.04] p-3 font-mono text-xs leading-5 text-slate-300 outline-none" /><Button type="button" variant="outline" size="sm" onClick={() => void copy(embedCode, "embed")} className="mt-2 border-white/10 text-slate-200 hover:bg-white/10"><ExternalLink className="mr-1.5 size-3.5" />{copied === "embed" ? "Copied" : "Copy embed code"}</Button></label></div>
    </div>
  </div>;
}
