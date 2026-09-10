import { supabase } from "@/lib/supabase";

const MAX_PROFILE_IMAGE_BYTES = 12 * 1024 * 1024;

export async function uploadProfileImage(file: File, onProgress?: (value: number) => void) {
  if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(file.type.toLowerCase())) {
    throw new Error("Please choose a JPG, PNG, WebP, AVIF or GIF image.");
  }
  if (!file.size || file.size > MAX_PROFILE_IMAGE_BYTES) throw new Error("Profile images must be 12 MB or smaller.");

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const response = await fetch("/api/media-upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: "thumbnail", filename: file.name, contentType: file.type, size: file.size }),
  });
  const payload = await response.json().catch(() => null) as { url?: string; key?: string; publicUrl?: string; message?: string } | null;
  if (!response.ok || !payload?.url || !payload.key || !payload.publicUrl) throw new Error(payload?.message || `Could not prepare the image upload (HTTP ${response.status}).`);

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", payload.url!, true);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Image upload failed (${request.status}).`));
    request.onerror = () => reject(new Error("Network error while uploading the image."));
    request.send(file);
  });

  onProgress?.(100);
  return { key: payload.key, url: payload.publicUrl };
}
