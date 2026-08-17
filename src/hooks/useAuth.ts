import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const applySession = (nextSession: Session | null) => {
      if (!mounted) return
      setSession(previous => previous?.access_token === nextSession?.access_token ? previous : nextSession)
      setUser(previous => previous?.id === nextSession?.user?.id ? previous : (nextSession?.user ?? null))
      setLoading(false)
    }

    void supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch(error => { console.warn('[HkTube] Session restore failed', error); applySession(null) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => {
      mounted = false
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
