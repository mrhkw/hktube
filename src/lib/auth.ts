import { createElement, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export const MAX_AUTH_RETRIES = 3

export async function getSession(forceRefresh = false): Promise<{ session: Session | null; error: Error | null }> {
  const current = await supabase.auth.getSession()
  if (current.error) return { session: null, error: current.error }
  const session = current.data.session
  const expiresSoon = !session?.expires_at || session.expires_at * 1000 < Date.now() + 60_000
  if (session && !forceRefresh && !expiresSoon) return { session, error: null }
  if (!session && !forceRefresh) return { session: null, error: null }
  const refreshed = await supabase.auth.refreshSession()
  return { session: refreshed.data.session, error: refreshed.error }
}

export async function withAuthRetry<T>(request: (accessToken: string) => Promise<Response>, parse: (response: Response) => Promise<T>, retries = MAX_AUTH_RETRIES): Promise<T> {
  let lastError: Error | null = null
  let forceRefresh = false
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const auth = await getSession(forceRefresh)
    if (!auth.session?.access_token) throw auth.error || new Error('Your session has expired. Please sign in again.')
    const response = await request(auth.session.access_token)
    if (response.status !== 401 && response.status !== 403) return parse(response)
    lastError = new Error('Authorization failed.')
    forceRefresh = true
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
  }
  window.dispatchEvent(new CustomEvent('hktube:auth-required', { detail: { reason: lastError?.message } }))
  throw lastError || new Error('Authorization failed after retrying.')
}

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getSession().then(({ session: next }) => { if (active) { setSession(next); setLoading(false) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) setSession(next) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  return { session, user: session?.user ?? null, loading }
}

export async function signOut() {
  const result = await supabase.auth.signOut()
  if (result.error) throw result.error
}

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Array<'creator' | 'admin'> }) {
  const { user, loading } = useAuthSession()
  const location = useLocation()
  const [authorized, setAuthorized] = useState<boolean | null>(roles?.length ? null : true)
  useEffect(() => {
    if (!user || !roles?.length) { setAuthorized(!roles?.length); return }
    supabase.from('profiles').select('is_creator,is_admin').eq('id', user.id).single().then(({ data }) => {
      setAuthorized(Boolean(data && ((!roles.includes('creator') || data.is_creator) && (!roles.includes('admin') || data.is_admin))))
    })
  }, [user, roles])
  if (loading || authorized === null) return createElement('div', { className: 'app-loading' }, createElement('div', { className: 'spinner' }))
  if (!user) return createElement(Navigate, { to: '/', replace: true, state: { from: location.pathname } })
  if (!authorized) return createElement(Navigate, { to: '/', replace: true })
  return children
}

export type AuthUser = User
