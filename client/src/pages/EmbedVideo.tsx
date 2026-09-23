import { Loader2 } from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { VideoPlayer } from "@/components/VideoPlayer";

export default function EmbedVideo() {
  const [, params] = useRoute("/embed/:id");
  const id = Number(params?.id);
  const query = trpc.videos.byId.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-black"><Loader2 className="size-7 animate-spin text-violet-300" /></main>;
  if (!query.data) return <main className="grid min-h-screen place-items-center bg-black p-6 text-center text-sm text-slate-400">This video is not available.</main>;
  return <main className="min-h-screen bg-black p-0"><VideoPlayer video={query.data} /></main>;
}
