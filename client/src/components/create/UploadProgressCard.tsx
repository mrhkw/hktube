import { useSyncExternalStore } from "react";
import { Link } from "wouter";
import { CheckCircle2, Film, Loader2, TriangleAlert, X } from "lucide-react";
import {
  describeStage,
  dismissJob,
  formatRemaining,
  getSnapshot,
  isActive,
  overallPercent,
  subscribe,
  type UploadJob,
} from "@/lib/uploadActivity";

/**
 * Upload progress, shaped like the YouTube app: "Preparing 100%" while the edit
 * is rendered locally, then "Sending file 4% · About 14 seconds remaining" while
 * it goes up, with the finished state kept visible for a minute.
 */
export function useUploadJobs(): UploadJob[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function UploadProgressCard({ job, compact = false }: { job: UploadJob; compact?: boolean }) {
  const percent = overallPercent(job);
  const remaining = job.stage === "sending" ? formatRemaining(job.secondsRemaining) : null;
  const active = isActive(job);

  return (
    <div
      className="hkc-upload-card"
      data-stage={job.stage}
      style={compact ? { padding: 10 } : undefined}
    >
      <div className="hkc-upload-thumb">
        {job.thumbnail ? (
          <img src={job.thumbnail} alt="" />
        ) : (
          <Film className="size-4" aria-hidden="true" />
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="hkc-upload-line">
          <span className="hkc-upload-title" title={job.title}>
            {job.title || (job.isShort ? "Your Short" : "Your video")}
          </span>
          <button
            type="button"
            className="hkc-icon-btn hkc-upload-close"
            aria-label={active ? "Hide this upload" : "Dismiss"}
            onClick={() => dismissJob(job.id)}
          >
            <X className="size-3.5" />
          </button>
        </div>

        <p className="hkc-upload-status">
          {active && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {job.stage === "done" && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
          {job.stage === "failed" && <TriangleAlert className="size-3.5" aria-hidden="true" />}
          <span>
            {describeStage(job)}
            {remaining ? ` · ${remaining}` : ""}
          </span>
        </p>

        <div className="hkc-progress" aria-hidden="true">
          <div
            style={{
              width: `${percent}%`,
              background: job.stage === "failed" ? "#f87171" : job.stage === "done" ? "#34d399" : undefined,
            }}
          />
        </div>

        {job.error && (
          <p className="hkc-row-hint" style={{ color: "#ffb3c1", marginTop: 6 }}>
            {job.error}
          </p>
        )}
        {job.detail && !job.error && <p className="hkc-row-hint" style={{ marginTop: 6 }}>{job.detail}</p>}

        {job.stage === "done" && (
          <Link href={job.href} className="hkc-upload-link" onClick={() => dismissJob(job.id)}>
            {job.isShort ? "Open your Short" : "Open your video"}
          </Link>
        )}
        {job.stage === "failed" && (
          <Link href={job.href} className="hkc-upload-link">
            Try again
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * The floating stack of upload cards. Mounted once in the shell, so progress is
 * visible from any page, exactly like the YouTube app's upload banner.
 */
export function UploadActivityBanner() {
  const jobs = useUploadJobs();
  const visible = jobs.filter(
    job =>
      isActive(job) ||
      job.stage === "done" ||
      // A failure has to stay until it is dismissed, or the reason is lost.
      job.stage === "failed"
  );
  if (visible.length === 0) return null;

  return (
    <div className="hkc-upload-stack" role="status" aria-live="polite">
      {visible.slice(0, 2).map(job => (
        <UploadProgressCard key={job.id} job={job} compact />
      ))}
    </div>
  );
}
