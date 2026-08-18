import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    // Flush pending session updates in a single microtask tick. Supabase fires
    // onAuthStateChange multiple times in quick succession (INITIAL_SESSION ->
    // SIGNED_IN); batching prevents repeated unmount/remount flicker.
    let pending: Session | null | undefined
    const flush = () => {
      if (!mounted || pending === undefined) return
      const next = pending
      pending = undefined
      setSession(previous => previous?.access_token === next?.access_token ? previous : next)
      setUser(previous => previous?.id === next?.user?.id ? previous : (next?.user ?? null))
      setLoading(false)
    }
    const applySession = (nextSession: Session | null) => {
      if (!mounted) return
      pending = nextSession
      // Defer the state update; rapid successive auth events merge into one render.
      queueMicrotask(flush)
    }

    void supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch(error => { console.warn('[HkTube] Session restore failed', error); applySession(null) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => {
      mounted = false
      pending = undefined
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.warn('[HkTube] Remote sign-out failed', error)
    } catch (error) {
      console.warn('[HkTube] Sign-out failed; clearing local session', error)
    } finally {
      setSession(null)
      setUser(null)
    }
  }

  return { session, user, loading, signOut }
}
