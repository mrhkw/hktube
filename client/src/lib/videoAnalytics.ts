import { recordDiscoveryEvent } from "@/lib/supabaseDiscovery";

export interface AnalyticsPayload {
  videoId: string;
  userId?: string;
  watchDurationSeconds: number;
  totalDurationSeconds: number;
  completed: boolean;
}

/** Record retention signals without blocking playback when analytics is unavailable. */
export async function sendVideoAnalytics(payload: AnalyticsPayload) {
  try {
    await recordDiscoveryEvent({
      eventType: payload.completed ? "complete" : "watch_progress",
      objectType: "video",
      objectId: payload.videoId,
      watchSeconds: Math.max(0, Math.floor(payload.watchDurationSeconds)),
      positionSeconds: Math.max(0, Math.floor(payload.watchDurationSeconds)),
      context: {
        total_duration_seconds: Math.max(0, Math.floor(payload.totalDurationSeconds)),
        completed: payload.completed,
        user_id: payload.userId ?? null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.warn("Video analytics unavailable:", error);
  }
}
