export type VideoCategory = "regular" | "shorts";

export type VideoRecord = {
  id: number;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  captionUrl: string | null;
  durationSeconds: number;
  viewCount: number;
  category: VideoCategory;
  uploadedAt: Date;
};

export function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
    : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function formatViews(views: number) {
  if (views === 0) return "No views yet";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(views) + " views";
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}
