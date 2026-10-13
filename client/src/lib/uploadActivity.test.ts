import { describe, expect, it } from "vitest";
import {
  describeStage,
  estimateRemaining,
  estimateRemainingFromPercent,
  formatRemaining,
  isActive,
  overallPercent,
  pruneJobs,
  sortJobs,
  stageLabel,
  storableThumbnail,
  FINISHED_TTL_MS,
  type UploadJob,
} from "./uploadActivity";

function job(patch: Partial<UploadJob> = {}): UploadJob {
  return {
    id: "job-1",
    title: "My upload",
    isShort: false,
    stage: "preparing",
    progress: 0,
    secondsRemaining: null,
    startedAt: 1000,
    finishedAt: null,
    error: null,
    href: "/watch/1",
    thumbnail: null,
    detail: null,
    ...patch,
  };
}

describe("stage labels", () => {
  it("uses the wording the YouTube app uses", () => {
    expect(stageLabel("preparing")).toBe("Preparing");
    expect(stageLabel("sending")).toBe("Sending file");
    expect(stageLabel("processing")).toBe("Processing");
  });

  it("shows the percent inside the current stage", () => {
    expect(describeStage(job({ stage: "preparing", progress: 100 }))).toBe("Preparing 100%");
    expect(describeStage(job({ stage: "sending", progress: 4 }))).toBe("Sending file 4%");
  });

  it("rounds to whole percent and clamps junk values", () => {
    expect(describeStage(job({ stage: "sending", progress: 4.4 }))).toBe("Sending file 4%");
    expect(describeStage(job({ stage: "sending", progress: 140 }))).toBe("Sending file 100%");
    expect(describeStage(job({ stage: "sending", progress: -20 }))).toBe("Sending file 0%");
  });

  it("never claims a percentage for a finished or failed job", () => {
    expect(describeStage(job({ stage: "done", progress: 100 }))).toBe("Upload complete");
    expect(describeStage(job({ stage: "failed", error: "Network" }))).toBe("Upload failed");
  });
});

describe("formatRemaining", () => {
  it("words the countdown the way the app does", () => {
    expect(formatRemaining(14)).toBe("About 14 seconds remaining");
    expect(formatRemaining(1)).toBe("About 1 second remaining");
    expect(formatRemaining(0.4)).toBe("Less than a second remaining");
  });

  it("switches to minutes and hours for long uploads", () => {
    expect(formatRemaining(59)).toBe("About 59 seconds remaining");
    expect(formatRemaining(60)).toBe("About a minute remaining");
    expect(formatRemaining(150)).toBe("About 3 minutes remaining");
    expect(formatRemaining(3600)).toBe("About an hour remaining");
    expect(formatRemaining(7200)).toBe("About 2 hours remaining");
  });

  it("says nothing rather than guessing when there is no estimate", () => {
    expect(formatRemaining(null)).toBeNull();
    expect(formatRemaining(undefined)).toBeNull();
    expect(formatRemaining(Number.NaN)).toBeNull();
    expect(formatRemaining(-5)).toBeNull();
  });
});

describe("overallPercent", () => {
  it("moves forward across the stages instead of restarting", () => {
    const values = [
      overallPercent(job({ stage: "preparing", progress: 50 })),
      overallPercent(job({ stage: "preparing", progress: 100 })),
      overallPercent(job({ stage: "sending", progress: 0 })),
      overallPercent(job({ stage: "sending", progress: 100 })),
      overallPercent(job({ stage: "processing", progress: 0 })),
      overallPercent(job({ stage: "done" })),
    ];
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThanOrEqual(values[index - 1]);
    }
    expect(values[values.length - 1]).toBe(100);
  });
});

describe("pruning and ordering", () => {
  it("keeps active uploads regardless of age", () => {
    const old = job({ stage: "sending", startedAt: 0 });
    expect(pruneJobs([old], FINISHED_TTL_MS * 10).length).toBe(1);
  });

  it("keeps a failure so the reason is not lost", () => {
    const failed = job({ stage: "failed", finishedAt: 0, error: "Quota" });
    expect(pruneJobs([failed], FINISHED_TTL_MS * 10).length).toBe(1);
  });

  it("drops a finished card once its time is up", () => {
    const done = job({ stage: "done", finishedAt: 1000 });
    expect(pruneJobs([done], 1000 + FINISHED_TTL_MS - 1).length).toBe(1);
    expect(pruneJobs([done], 1000 + FINISHED_TTL_MS + 1).length).toBe(0);
  });

  it("orders the newest upload first", () => {
    const rows = [job({ id: "a", startedAt: 10 }), job({ id: "b", startedAt: 30 })];
    expect(sortJobs(rows).map(row => row.id)).toEqual(["b", "a"]);
  });

  it("knows which stages are still running", () => {
    expect(isActive(job({ stage: "sending" }))).toBe(true);
    expect(isActive(job({ stage: "done" }))).toBe(false);
    expect(isActive(job({ stage: "failed" }))).toBe(false);
  });
});

describe("storableThumbnail", () => {
  it("keeps a small preview", () => {
    expect(storableThumbnail("data:image/jpeg;base64,abc")).toBe("data:image/jpeg;base64,abc");
  });

  it("drops a preview too large for storage instead of breaking the save", () => {
    expect(storableThumbnail(`data:image/jpeg;base64,${"a".repeat(70_000)}`)).toBeNull();
    expect(storableThumbnail(null)).toBeNull();
  });
});

describe("estimateRemaining", () => {
  it("projects the remaining time from the bytes already sent", () => {
    // 25 MB of a 100 MB file in 10s is 2.5 MB/s, so 75 MB left is 30s.
    const remaining = estimateRemaining({
      bytesUploaded: 25 * 1024 * 1024,
      totalBytes: 100 * 1024 * 1024,
      startedAt: 0,
      now: 10_000,
    });
    expect(remaining).toBeCloseTo(30, 1);
  });

  it("stays quiet until there is enough signal to be useful", () => {
    expect(estimateRemaining({ bytesUploaded: 0, totalBytes: 100, startedAt: 0, now: 10_000 })).toBeNull();
    expect(estimateRemaining({ bytesUploaded: 10, totalBytes: 0, startedAt: 0, now: 10_000 })).toBeNull();
    expect(estimateRemaining({ bytesUploaded: 10, totalBytes: 100, startedAt: 0, now: 200 })).toBeNull();
  });
});

describe("estimateRemainingFromPercent", () => {
  it("projects the rest of the upload from the percentage so far", () => {
    // 4% in 10s means the remaining 96% needs about 240s.
    expect(estimateRemainingFromPercent(4, 0, 10_000)).toBeCloseTo(240, 0);
    expect(estimateRemainingFromPercent(50, 0, 20_000)).toBeCloseTo(20, 0);
  });

  it("stays quiet at the very start and at the end", () => {
    expect(estimateRemainingFromPercent(0, 0, 10_000)).toBeNull();
    expect(estimateRemainingFromPercent(100, 0, 10_000)).toBeNull();
    expect(estimateRemainingFromPercent(Number.NaN, 0, 10_000)).toBeNull();
  });
});
