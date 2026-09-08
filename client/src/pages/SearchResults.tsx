import { EmptyVideos, VideoCard } from "@/components/VideoCard";
import { HkTubeShell } from "@/components/HkTubeShell";
import { VideoRecord } from "@/lib/video";
import { trpc } from "@/lib/trpc";
import { Clock3, Filter, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const recentKey = "hktube-recent-searches";
const filters = [{ label: "All", value: "all" }, { label: "Videos", value: "regular" }, { label: "Shorts", value: "shorts" }] as const;

type FilterValue = typeof filters[number]["value"];

export default function SearchResults() {
  const [location, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(location.split("?")[1] || ""), [location]);
  const query = params.get("q")?.trim() || "";
  const initialFilter = params.get("type") === "shorts" || params.get("type") === "regular" ? params.get("type") as FilterValue : "all";
  const [filter, setFilter] = useState<FilterValue>(initialFilter);
  const [recent, setRecent] = useState<string[]>([]);
  const category = filter === "all" ? undefined : filter;
  const resultsQuery = trpc.videos.search.useQuery({ query, category, limit: 48 }, { enabled: Boolean(query) });
  const videos = (resultsQuery.data ?? []) as VideoRecord[];

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(recentKey) || "[]")); } catch { setRecent([]); }
  }, []);

  useEffect(() => {
    if (!query) return;
    setRecent(previous => {
      const next = [query, ...previous.filter(item => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
      localStorage.setItem(recentKey, JSON.stringify(next));
      return next;
    });
  }, [query]);

  function chooseFilter(value: FilterValue) {
    setFilter(value);
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("type"); else next.set("type", value);
    navigate(`/search?${next.toString()}`);
  }

  function clearRecent() {
    localStorage.removeItem(recentKey);
    setRecent([]);
  }

  return <HkTubeShell title={query ? `Results for “${query}”` : "Search HKTUBE"} subtitle={query ? "Search real published HkTube videos by title and description." : "Find videos, Shorts, and creators from the live HkTube catalog."}>
    {!query ? <div className="mx-auto max-w-4xl space-y-6"><EmptyVideos title="Search the catalog" copy="Use the search bar above to discover published HkTube videos." icon={Search} />{recent.length > 0 && <section className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-neutral-950"><Clock3 className="size-4" />Recent searches</h2><button type="button" onClick={clearRecent} className="text-xs font-bold text-neutral-500 hover:text-black">Clear all</button></div><div className="mt-4 flex flex-wrap gap-2">{recent.map(item => <Link key={item} href={`/search?q=${encodeURIComponent(item)}`} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50">{item}<X className="size-3.5 text-neutral-400" /></Link>)}</div></section>}</div> : resultsQuery.isLoading ? <div className="grid min-h-[28vh] place-items-center"><Loader2 className="size-7 animate-spin text-fuchsia-300" aria-label="Searching" /></div> : resultsQuery.isError ? <EmptyVideos title="Search could not load" copy="Please refresh and try again. Search reads only from the live HkTube video catalog." icon={Search} /> : <><div className="mb-6 flex flex-wrap items-center gap-2"><Filter className="mr-1 size-4 text-neutral-500" aria-hidden="true" />{filters.map(item => <button key={item.value} type="button" onClick={() => chooseFilter(item.value)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${filter === item.value ? "border-black bg-black text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}>{item.label}</button>)}<span className="ml-auto text-xs font-medium text-neutral-500">{videos.length} result{videos.length === 1 ? "" : "s"}</span></div>{videos.length ? <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">{videos.map(video => <VideoCard key={video.id} video={video} />)}</div> : <EmptyVideos title="No matching videos" copy="No published HKTUBE video matches this search. Try another keyword or filter." icon={Search} />}</>}
  </HkTubeShell>;
}
