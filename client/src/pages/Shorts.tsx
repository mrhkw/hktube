import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, RefreshCw } from "lucide-react";
import { ShortsPlayer } from "@/components/ShortsPlayer";
import { rankPublicVideos } from "@/lib/supabaseDiscovery";
import { listPublicSupabaseShorts, type SupabaseVideo } from "@/lib/supabaseVideos";

export default function Shorts() {
  const [items, setItems] = useState<SupabaseVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const ranked = await rankPublicVideos({ shorts: true, limit: 40 });
      setItems(ranked.length ? ranked : await listPublicSupabaseShorts(40));
    } catch (cause) {
      try { setItems(await listPublicSupabaseShorts(40)); }
      catch (fallbackError) { setError(fallbackError instanceof Error ? fallbackError.message : cause instanceof Error ? cause.message : "Unable to load Clips."); }
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="grid min-h-screen place-items-center bg-black text-white"><Loader2 className="size-8 animate-spin" /></div>;
  if (error) return <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white"><div><p className="text-lg font-black">Clips could not load</p><p className="mt-2 text-sm text-white/60">{error}</p><button onClick={() => void load()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"><RefreshCw className="size-4" />Retry</button></div></div>;
  if (!items.length) return <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white"><div><p className="text-xl font-black">No public Clips yet</p><p className="mt-2 text-sm text-white/60">Publish a vertical 9:16 Clip to start the swipe feed.</p><Link href="/" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">Back to Home</Link></div></div>;

  return <ShortsPlayer items={items} />;
}
