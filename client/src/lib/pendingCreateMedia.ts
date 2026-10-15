import type { CreateMediaMode } from "@/components/HkTubeCreateGallery";
let pendingSelection: { mode: CreateMediaMode; file: File } | null = null;
export function setPendingCreateMedia(mode: CreateMediaMode, file: File) { pendingSelection = { mode, file }; }
export function takePendingCreateMedia() { const value = pendingSelection; pendingSelection = null; return value; }
