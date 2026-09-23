import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getMyTenant } from './api'
import { isConfigured, supabase } from './supabase'
import type { Tenant } from './types'

interface SessionState {
  configured: boolean
  loading: boolean
  session: Session | null
  tenant: Tenant | null
  email: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshTenant: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)

  const loadTenant = useCallback(async () => {
    try {
      const t = await getMyTenant()
      setTenant(t)
    } catch {
      setTenant(null)
    }
  }, [])

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) void loadTenant()
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        void loadTenant()
      } else {
        setTenant(null)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadTenant])

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = supabase
    if (!sb) throw new Error('Supabase nao configurado')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const sb = supabase
    if (!sb) throw new Error('Supabase nao configurado')
    const { error } = await sb.auth.signUp({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const sb = supabase
    if (!sb) return
    await sb.auth.signOut()
  }, [])

  const value = useMemo<SessionState>(
    () => ({
      configured: isConfigured,
      loading,
      session,
      tenant,
      email: session?.user.email ?? null,
      signIn,
      signUp,
      signOut,
      refreshTenant: loadTenant,
    }),
    [loading, session, tenant, signIn, signUp, signOut, loadTenant],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession deve ser usado dentro de SessionProvider')
  return ctx
}
