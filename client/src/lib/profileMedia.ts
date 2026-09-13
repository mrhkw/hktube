import { supabase } from "@/lib/supabase";

const MAX_PROFILE_IMAGE_BYTES = 12 * 1024 * 1024;

export async function uploadProfileImage(file: File, onProgress?: (value: number) => void) {
  if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(file.type.toLowerCase())) {
    throw new Error("Please choose a JPG, PNG, WebP, AVIF or GIF image.");
  }
  if (!file.size || file.size > MAX_PROFILE_IMAGE_BYTES) throw new Error("Profile images must be 12 MB or smaller.");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Your session expired. Please sign in again.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;
  onProgress?.(5);

  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(error.message);

  onProgress?.(100);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { key: path, url: data.publicUrl };
}
