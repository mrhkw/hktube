import { useEffect, useState } from "react";
import { HkTubeShell } from "@/components/HkTubeShell";
import { ClipsView } from "@/components/ClipsView";
import { SupabaseVideoCard } from "@/components/SupabaseVideoCard";
import { rankPublicVideos, type RankedVideo } from "@/lib/supabaseDiscovery";
import {
  listPublicSupabaseShorts,
  listPublicSupabaseVideos,
} from "@/lib/supabaseVideos";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

function asRanked(
  video: Awaited<ReturnType<typeof listPublicSupabaseVideos>>[number]
): RankedVideo {
  return { ...video, reason: "fresh", score: 0 };
}

export function SupabaseCollections({ kind }: { kind: "shorts" | "trending" }) {
  const { user } = useAuth();
  const [items, setItems] = useState<RankedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"for-you" | "following">("for-you");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let ranked: RankedVideo[] = [];
      try {
        ranked = await rankPublicVideos({
          shorts: kind === "shorts",
          limit: kind === "shorts" ? 50 : 40,
          userId: user?.id == null ? undefined : String(user.id),
        });
      } catch {
        ranked = [];
      }
      if (!ranked.length) {
        const fallback =
          kind === "shorts"
            ? await listPublicSupabaseShorts(50)
            : await listPublicSupabaseVideos(40);
        ranked = fallback.map(asRanked);
      }
      if (mode === "following" && kind === "shorts" && user?.id) {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("channel_id")
          .eq("subscriber_id", user.id);
        const followed = new Set((subs ?? []).map(x => String(x.channel_id)));
        setItems(ranked.filter(x => followed.has(x.channelId)));
      } else setItems(ranked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load discovery.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [kind, mode, user?.id]);

  if (kind === "shorts") {
    return <ClipsView />;
  }

  return (
    <HkTubeShell
      title="Trending"
      subtitle="Rising content is diversified by freshness, quality, engagement and creator/topic variety."
    >
      <main className="mx-auto w-full max-w-[1480px] px-4 pb-16 sm:px-8 lg:px-10">
        {loading ? (
          <div className="grid min-h-[60vh] place-items-center">
            <Loader2 className="size-8 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center">
            <p className="text-white">{error}</p>
            <Button onClick={() => void load()} className="mt-4">
              <RefreshCw className="mr-2 size-4" />
              Retry
            </Button>
          </div>
        ) : items.length ? (
          <div className="space-y-7">
            <div className="flex items-center gap-2 rounded-2xl border border-violet-400/15 bg-violet-500/[.06] px-4 py-3 text-xs text-slate-300">
              <Sparkles className="size-4 text-violet-300" />
              HkTube mixes popularity with freshness and diversity so one
              creator or duplicate topic cannot dominate.
            </div>
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map(v => (
                <SupabaseVideoCard
                  key={v.id}
                  video={{
                    id: v.id,
                    title: v.title,
                    thumbnailUrl: v.thumbnailUrl,
                    durationSeconds: v.durationSeconds,
                    views: v.viewCount,
                    publishedAt: v.publishedAt,
                    isShort: false,
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-white/10 p-12 text-center text-slate-500">
            No approved long-form content yet.
          </div>
        )}
      </main>
    </HkTubeShell>
  );
}
