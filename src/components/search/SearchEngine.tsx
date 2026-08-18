import { useEffect, useState } from 'react'
import { searchContent } from '../../lib/content'

interface Props { initialQuery?: string; onVideoClick?: (id: string) => void }
export default function SearchEngine({ initialQuery = '', onVideoClick }: Props) {
  const [query, setQuery] = useState(initialQuery); const [results, setResults] = useState<Awaited<ReturnType<typeof searchContent>> | null>(null); const [loading, setLoading] = useState(false)
  useEffect(() => { const term = initialQuery.trim(); if (!term) return; setLoading(true); searchContent(term).then(setResults).finally(() => setLoading(false)) }, [initialQuery])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); try { setResults(await searchContent(query)) } finally { setLoading(false) } }
  return <section className="search-engine"><form onSubmit={submit} className="search-form"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search HkTube" aria-label="Search HkTube" /><button className="btn-primary" type="submit">Search</button></form>{loading && <p>Searching…</p>}{results && <div className="search-results"><h2>Videos</h2>{results.videos.length === 0 ? <p>No videos matched this search.</p> : results.videos.map(video => <button className="search-result-row" key={video.id} onClick={() => onVideoClick?.(video.id)}><strong>{video.title}</strong><span>{video.description}</span></button>)}<h2>Shorts</h2>{results.shorts.map(short => <button className="search-result-row" key={short.id} onClick={() => onVideoClick?.(short.id)}><strong>{short.title}</strong><span>Short</span></button>)}<h2>Creators</h2>{results.channels.map(channel => <div className="search-result-row" key={channel.id}><strong>{channel.name}</strong><span>@{channel.handle}</span></div>)}<h2>Posts</h2>{results.posts.map(post => <div className="search-result-row" key={post.id}>{post.content}</div>)}</div>}</section>
}
