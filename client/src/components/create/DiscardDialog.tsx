import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * The confirmation TikTok shows when a creator leaves a half-finished post.
 * Used for both the in-app back action and the browser's own back/close
 * gestures, so a draft is never lost silently.
 */
export function DiscardDialog({
  open,
  onCancel,
  onDiscard,
  title = "Discard changes?",
  body = "Changes on this page will not be saved.",
  discardLabel = "Discard",
}: {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  title?: string;
  body?: string;
  discardLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="hkc-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={event => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="hkc-dialog">
        <h2 className="hkc-dialog-title">{title}</h2>
        <p className="hkc-dialog-body">{body}</p>
        <div className="hkc-dialog-actions">
          <Button variant="ghost" onClick={onCancel} className="border border-white/12 text-slate-200 hover:bg-white/8">
            Cancel
          </Button>
          <Button onClick={onDiscard} className="bg-[#fe2c55] font-bold text-white hover:bg-[#e62249]">
            {discardLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DiscardDialog;
