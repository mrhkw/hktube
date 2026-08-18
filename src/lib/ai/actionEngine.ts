// HkTube Admin AI — action engine.
// Turns natural-language admin commands into structured actions executed by the
// server-side /api/ai/execute endpoint (owner-email gated, service-role backed).
import { supabase } from '../supabase'

export type ActionRequest = {
  type:
    | 'update_profile'
    | 'create_post'
    | 'create_video'
    | 'delete_video'
    | 'update_video'
    | 'create_comment'
    | 'ban_user'
    | 'unban_user'
    | 'set_role'
    | 'list'
    | 'upsert'
    | 'delete_row'
  payload?: Record<string, unknown>
  note?: string
}

export type ActionResult = {
  ok: boolean
  summary: string
  executed?: boolean
  error?: string
  result?: unknown
}

type ParsedCommand = ActionRequest | null

/**
 * Command grammar (agent-style, deterministic parser so the AI assistant can
 * reliably act on anything the admin types without an external LLM):
 *
 *   post "<title>" description "<text>"
 *   video "<title>" description "<text>" url "<url>" category "<cat>"
 *   update video "<id>" title "<text>"
 *   delete video "<id>"
 *   comment "<text>" on "<videoId>"
 *   ban "<userId>" reason "<text>"
 *   unban "<userId>"
 *   role "<userId>" = "<admin|moderator|user|super_admin|owner>"
 *   set channel name "<text>" username "<name>" avatar "<url>" banner "<url>" description "<text>"
 *   list videos|users|posts|comments|streams|permissions
 *   add "<key>" = <json> to settings
 *   delete "<table>" row "<id>"
 */
export function parseCommand(raw: string): { command: ParsedCommand; plan: string[] } {
  const input = raw.trim()
  const lower = input.toLowerCase()
  const plan: string[] = []

  const planFrom = (steps: string[]) => steps.forEach(s => plan.push(s))

  // Profile / channel settings
  if (/^set channel\b|^update (my )?profile|^change (my )?(channel|profile)/.test(lower)) {
    const data: Record<string, unknown> = {}
    const m = input.match(/name "([^"]+)"/i) || input.match(/name (\S+)/i)
    const u = input.match(/username "([^"]+)"/i) || input.match(/username (\S+)/i)
    const a = input.match(/avatar "([^"]+)"/i) || input.match(/avatar (https?:\/\/\S+)/i)
    const b = input.match(/banner "([^"]+)"/i) || input.match(/banner (https?:\/\/\S+)/i)
    const d = input.match(/description "([^"]+)"/i)
    if (m) data.channel_name = m[1]
    if (u) data.username = u[1].toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    if (a) data.avatar_url = a[1]
    if (b) data.banner_url = b[1]
    if (d) data.description = d[1]
    planFrom(['Apply profile changes to your account.'])
    return { command: { type: 'update_profile', payload: data }, plan }
  }

  // Posts
  const postTitle = input.match(/^post "([^"]+)"/i) || input.match(/^create post "?([^"]+)"?/i)
  if (/^post\b|^create (a )?post|^new post|^write (a )?post|^publish/i.test(lower)) {
    const title = postTitle?.[1] || extractQuoted(input, 0) || 'Untitled post'
    const description = extractQuoted(input, 1) || ''
    planFrom(['Create a new community post.', 'Verify it appears in the public feed.'])
    return { command: { type: 'create_post', payload: { title, content: description, content_type: 'text' } }, plan }
  }

  // Videos
  const videoTitle = input.match(/^video "([^"]+)"/i)
  if (/^video\b|^upload video|^create video|^add video|^new video|^publish video/i.test(lower)) {
    const title = videoTitle?.[1] || extractQuoted(input, 0) || 'Untitled video'
    const description = input.match(/description "([^"]+)"/i)?.[1] || ''
    const url = input.match(/url "([^"]+)"/i)?.[1] || ''
    const category = input.match(/category "([^"]+)"/i)?.[1] || 'General'
    planFrom(['Register the video record in the library.'])
    return { command: { type: 'create_video', payload: { title, description, video_url: url, category, visibility: 'public', allow_comments: true } }, plan }
  }
  if (/^update video\b|^edit video/i.test(lower)) {
    const id = input.match(/"([0-9a-f-]{36})"/i)?.[1] || ''
    const title = input.match(/title "([^"]+)"/i)?.[1]
    const data: Record<string, unknown> = {}
    if (title) data.title = title
    planFrom(['Update the video record.'])
    return { command: id ? { type: 'update_video', payload: { ...data, id } } : null, plan }
  }
  if (/^delete video\b|^remove video/i.test(lower)) {
    const id = input.match(/"([0-9a-f-]{36})"/i)?.[1] || ''
    planFrom(['Delete the video record.', 'Confirm removal from public feeds.'])
    return { command: id ? { type: 'delete_video', payload: { id } } : null, plan }
  }

  // Comments
  if (/^comment\b|^add comment|^write comment/i.test(lower)) {
    const text = extractQuoted(input, 0) || ''
    const videoId = input.match(/on "([0-9a-f-]{36})"/i)?.[1] || input.match(/video ([0-9a-f-]{36})/i)?.[1] || ''
    planFrom(['Post the comment on the target video.'])
    return { command: { type: 'create_comment', payload: { signal_id: videoId, content: text } }, plan }
  }

  // Moderation
  const banMatch = input.match(/^ban "([0-9a-f-]{36})"/i) || input.match(/^ban (\S+)(?: reason "([^"]+)")?/i)
  if (/^ban\b/i.test(lower)) {
    const id = banMatch?.[1] || ''
    const reason = input.match(/reason "([^"]+)"/i)?.[1] || 'Owner moderation action'
    planFrom(['Ban the account.', 'Record the moderation reason in the audit log.'])
    return { command: id ? { type: 'ban_user', payload: { id, reason } } : null, plan }
  }
  const unbanMatch = input.match(/^unban "([0-9a-f-]{36})"/i) || input.match(/^unban (\S+)/i)
  if (/^unban\b/i.test(lower)) {
    const id = unbanMatch?.[1] || ''
    planFrom(['Lift the ban on the account.'])
    return { command: id ? { type: 'unban_user', payload: { id } } : null, plan }
  }
  const roleMatch = input.match(/^role "([0-9a-f-]{36})"/i) || input.match(/role (?:of )?"?([0-9a-f-]{36})"? *= *"?(admin|moderator|user|super_admin|owner)"?/i)
  if (/^role\b|^set role|^make (me )?(admin|moderator|owner)/i.test(lower)) {
    const id = roleMatch?.[1] || ''
    const role = roleMatch?.[2] || input.match(/(admin|moderator|user|super_admin|owner)/i)?.[1]?.toLowerCase() || ''
    planFrom([`Set the account role to ${role || '<role>'}.`])
    return { command: id && role ? { type: 'set_role', payload: { id, role } } : null, plan }
  }

  // Listings
  const listMatch = lower.match(/^list (videos|users|posts|comments|streams|permissions|settings|live)/i)
  if (listMatch) {
    const map: Record<string, { table: string; label: string }> = {
      videos: { table: 'signals', label: 'videos' },
      users: { table: 'profiles', label: 'user profiles' },
      posts: { table: 'posts', label: 'community posts' },
      comments: { table: 'comments', label: 'comments' },
      streams: { table: 'live_streams', label: 'live streams' },
      permissions: { table: 'ai_permissions', label: 'AI permissions' },
      settings: { table: 'admin_settings', label: 'admin settings' },
      live: { table: 'live_streams', label: 'live streams' },
    }
    const entry = map[listMatch[1]]
    planFrom([`Fetch recent ${entry.label} from the database.`])
    return { command: { type: 'list', payload: { table: entry.table } }, plan }
  }

  // Admin settings key/value
  if (/^add .*settings|^update setting|^set setting|^save setting/i.test(lower)) {
    const key = input.match(/"(\w+)"/i)?.[1] || input.match(/(\w+) *=/) ? input.match(/(\w+) *=/)?.[1] : ''
    let value: unknown = {}
    try {
      const json = input.match(/=\s*(\{.*\}|\[.*\])/s)?.[1]
      value = json ? JSON.parse(json) : { note: input.slice(input.indexOf('=') + 1).trim().slice(0, 500) }
    } catch { value = { note: input.slice(input.indexOf('=') + 1).trim().slice(0, 500) } }
    planFrom(['Persist the admin setting to the database.'])
    return { command: key ? { type: 'upsert', payload: { table: 'admin_settings', row: { key, value } } } : null, plan }
  }

  // Delete row by id
  if (/^delete (row|record)/i.test(lower)) {
    const table = input.match(/^delete (row|record) (videos|users|posts|comments|streams|permissions|settings)/i)?.[2]
    const id = input.match(/"([0-9a-f-]{36})"/i)?.[1] || ''
    const tableMap: Record<string, string> = {
      videos: 'signals', users: 'profiles', posts: 'posts', comments: 'comments',
      streams: 'live_streams', permissions: 'ai_permissions', settings: 'admin_settings',
    }
    planFrom(['Remove the record from the database.'])
    return { command: table && id ? { type: 'delete_row', payload: { table: tableMap[table], id } } : null, plan }
  }

  planFrom(['No actionable command understood yet. Rephrase using the supported grammar.'])
  return { command: null, plan }
}

function extractQuoted(input: string, index: number): string | null {
  const matches = [...input.matchAll(/"([^"]+)"/g)]
  // skip the command word itself if the first quote belongs to a keyword
  return matches[index] ? matches[index][1] : null
}

export async function executeAction(request: ActionRequest): Promise<ActionResult> {
  if (!request.type) {
    return { ok: false, summary: 'Nothing to execute yet — the command did not map to a supported action.' }
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, summary: 'Sign in again before the AI can act on your behalf.' }
  }
  try {
    const response = await fetch('/api/ai/execute', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: { type: request.type, ...request.payload } }),
    })
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; result?: unknown; error?: string }
    if (!response.ok) {
      return { ok: false, summary: payload.error || 'The action could not be executed.', error: payload.error }
    }
    const executed = request.type !== 'list'
    return {
      ok: true,
      executed,
      summary: executed
        ? `Done — the ${request.type.replace(/_/g, ' ')} action was applied and audited.`
        : `Here is what I found in the database.`,
      result: payload.result,
    }
  } catch (error) {
    return { ok: false, summary: 'The action endpoint could not be reached.', error: error instanceof Error ? error.message : 'Network error' }
  }
}
