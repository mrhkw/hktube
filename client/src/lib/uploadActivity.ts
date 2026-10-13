/**
 * Upload activity tracking.
 *
 * HkTube shows upload progress the way the YouTube app does: a card with
 * "Preparing 100%" while the file is re-encoded locally, then
 * "Sending file 4% · About 14 seconds remaining" while it is going up, and a
 * finished state that stays visible long enough to be seen. The studio writes
 * here; the shell and the profile read from here, so progress survives
 * navigating away from the composer.
 */

export type UploadStage = "preparing" | "sending" | "processing" | "done" | "failed";

export type UploadJob = {
  id: string;
  /** Video title (or the Short's caption) shown on the card. */
  title: string;
  isShort: boolean;
  stage: UploadStage;
  /** Progress inside the current stage, 0..100. */
  progress: number;
  /** Estimated seconds left in the current stage, or null when unknown. */
  secondsRemaining: number | null;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  /** Where to send the creator once the upload finished. */
  href: string;
  /** Small JPEG data URL for the card preview, when one is available. */
  thumbnail: string | null;
  /** Human readable detail line, e.g. why the upload failed. */
  detail: string | null;
};

const STORAGE_KEY = "hktube-upload-activity";
/** Finished cards disappear after this long, like YouTube's snackbar. */
export const FINISHED_TTL_MS = 60_000;
/** localStorage cannot hold much; a bigger preview is simply dropped. */
const MAX_STORED_THUMBNAIL_CHARS = 60_000;

let jobs: UploadJob[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/* ------------------------------------------------------------ pure helpers */

/** Newest first, so the active upload is always the first card. */
export function sortJobs(input: readonly UploadJob[]): UploadJob[] {
  return [...input].sort((a, b) => b.startedAt - a.startedAt);
}

/** A job is still moving while it is preparing, sending or processing. */
export function isActive(job: UploadJob): boolean {
  return job.stage === "preparing" || job.stage === "sending" || job.stage === "processing";
}

/**
 * Drops finished cards once their TTL has passed. Failed cards are kept, so a
 * creator does not lose the reason their upload broke.
 */
export function pruneJobs(input: readonly UploadJob[], now = Date.now()): UploadJob[] {
  return input.filter(job => {
    if (isActive(job) || job.stage === "failed") return true;
    const finishedAt = job.finishedAt ?? job.startedAt;
    return now - finishedAt < FINISHED_TTL_MS;
  });
}

/** The first stage label, matching YouTube's "Preparing" wording. */
export function stageLabel(stage: UploadStage): string {
  switch (stage) {
    case "preparing":
      return "Preparing";
    case "sending":
      return "Sending file";
    case "processing":
      return "Processing";
    case "done":
      return "Upload complete";
    case "failed":
      return "Upload failed";
  }
}

/** "Preparing 100%", "Sending file 4%" — the exact YouTube line shape. */
export function describeStage(job: UploadJob): string {
  if (job.stage === "done") return "Upload complete";
  if (job.stage === "failed") return job.error ? "Upload failed" : "Upload stopped";
  const percent = Math.max(0, Math.min(100, Math.round(job.progress)));
  return `${stageLabel(job.stage)} ${percent}%`;
}

/** "About 14 seconds remaining", the way the YouTube app words it. */
export function formatRemaining(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 1) return "Less than a second remaining";
  if (seconds < 2) return "About 1 second remaining";
  if (seconds < 60) return `About ${Math.round(seconds)} seconds remaining`;
  const minutes = Math.round(seconds / 60);
  if (minutes <= 1) return "About a minute remaining";
  if (minutes < 60) return `About ${minutes} minutes remaining`;
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? "About an hour remaining" : `About ${hours} hours remaining`;
}

/**
 * Overall progress across both stages. Preparing is the first slice, so a card
 * can show one bar that does not jump backwards when sending starts.
 */
export function overallPercent(job: UploadJob): number {
  const progress = Math.max(0, Math.min(100, job.progress));
  switch (job.stage) {
    case "preparing":
      return Math.round(progress * 0.45);
    case "sending":
      return Math.round(45 + progress * 0.5);
    case "processing":
      return Math.round(95 + progress * 0.05);
    case "done":
      return 100;
    case "failed":
      return Math.round(progress * 0.45);
  }
}

/** Trims a data URL so it can be persisted without eating the storage quota. */
export function storableThumbnail(thumbnail: string | null): string | null {
  if (!thumbnail) return null;
  return thumbnail.length > MAX_STORED_THUMBNAIL_CHARS ? null : thumbnail;
}

/* --------------------------------------------------------------- the store */

function readStorage(): UploadJob[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UploadJob[];
    if (!Array.isArray(parsed)) return [];
    return pruneJobs(
      parsed
        .filter(job => job && typeof job.id === "string" && typeof job.stage === "string")
        // A reload interrupts the in-flight upload, so it can never still be running.
        .map(job => (isActive(job) ? { ...job, stage: "failed", error: "Upload was interrupted.", detail: null } : job))
    );
  } catch {
    return [];
  }
}

function writeStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 6)));
  } catch {
    // Storage being full only costs the persisted copy, never the live state.
  }
}

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  jobs = readStorage();
}

export function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getJobs(): UploadJob[] {
  hydrate();
  return jobs;
}

/** Snapshot for useSyncExternalStore: the same reference until something changes. */
export function getSnapshot(): UploadJob[] {
  return getJobs();
}

function commit(next: UploadJob[]) {
  jobs = sortJobs(pruneJobs(next));
  writeStorage();
  notify();
}

export function startJob(input: {
  id: string;
  title: string;
  isShort: boolean;
  href: string;
  thumbnail?: string | null;
}): UploadJob {
  hydrate();
  const job: UploadJob = {
    id: input.id,
    title: input.title,
    isShort: input.isShort,
    stage: "preparing",
    progress: 0,
    secondsRemaining: null,
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
    href: input.href,
    thumbnail: storableThumbnail(input.thumbnail ?? null),
    detail: null,
  };
  commit([...jobs.filter(existing => existing.id !== job.id), job]);
  return job;
}

export function updateJob(id: string, patch: Partial<Omit<UploadJob, "id">>) {
  hydrate();
  commit(jobs.map(job => (job.id === id ? { ...job, ...patch } : job)));
}

export function finishJob(id: string, patch: { href?: string; detail?: string } = {}) {
  updateJob(id, {
    stage: "done",
    progress: 100,
    secondsRemaining: 0,
    finishedAt: Date.now(),
    error: null,
    ...(patch.href ? { href: patch.href } : {}),
    ...(patch.detail ? { detail: patch.detail } : {}),
  });
}

export function failJob(id: string, error: string) {
  updateJob(id, {
    stage: "failed",
    secondsRemaining: null,
    finishedAt: Date.now(),
    error,
  });
}

export function dismissJob(id: string) {
  hydrate();
  commit(jobs.filter(job => job.id !== id));
}

/** Used by tests and by a "clear finished" affordance. */
export function clearFinished() {
  hydrate();
  commit(jobs.filter(isActive));
}

/**
 * Estimates the seconds left from a stage percentage. The uploader reports
 * percent rather than bytes, and YouTube words the result the same way.
 */
export function estimateRemainingFromPercent(
  percent: number,
  startedAt: number,
  now = Date.now()
): number | null {
  if (!Number.isFinite(percent) || percent <= 1 || percent >= 100) return null;
  const elapsedSeconds = (now - startedAt) / 1000;
  if (elapsedSeconds <= 0.5) return null;
  const remaining = (elapsedSeconds * (100 - percent)) / percent;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  return remaining;
}

/**
 * Estimates the seconds left from the bytes that already went up. Only
 * meaningful once some bytes have landed, so it returns null before that.
 */
export function estimateRemaining(input: {
  bytesUploaded: number;
  totalBytes: number;
  startedAt: number;
  now?: number;
}): number | null {
  const { bytesUploaded, totalBytes } = input;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null;
  if (!Number.isFinite(bytesUploaded) || bytesUploaded <= 0) return null;
  const elapsedSeconds = (now - input.startedAt) / 1000;
  if (elapsedSeconds <= 0.5) return null;
  const bytesPerSecond = bytesUploaded / elapsedSeconds;
  if (bytesPerSecond <= 0) return null;
  const remaining = (totalBytes - bytesUploaded) / bytesPerSecond;
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  return remaining;
}
