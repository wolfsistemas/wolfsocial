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
import { listMyTenants } from './api'
import { isConfigured, supabase } from './supabase'
import type { Tenant } from './types'

const ACTIVE_TENANT_KEY = 'wolfsocial.activeTenant'

interface SessionState {
  configured: boolean
  loading: boolean
  session: Session | null
  tenant: Tenant | null
  tenants: Tenant[]
  email: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshTenant: () => Promise<void>
  setActiveTenant: (tenantId: string) => void
}

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const loadTenant = useCallback(async () => {
    try {
      const list = await listMyTenants()
      setTenants(list)
      const stored = window.localStorage.getItem(ACTIVE_TENANT_KEY)
      const resolved =
        stored && list.some((t) => t.id === stored)
          ? stored
          : (list[0]?.id ?? null)
      setActiveId(resolved)
    } catch {
      setTenants([])
      setActiveId(null)
    }
  }, [])

  const setActiveTenant = useCallback((tenantId: string) => {
    window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId)
    setActiveId(tenantId)
  }, [])

  const tenant = useMemo(
    () => tenants.find((t) => t.id === activeId) ?? tenants[0] ?? null,
    [tenants, activeId],
  )

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
        setTenants([])
        setActiveId(null)
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
      tenants,
      email: session?.user.email ?? null,
      signIn,
      signUp,
      signOut,
      refreshTenant: loadTenant,
      setActiveTenant,
    }),
    [loading, session, tenant, tenants, signIn, signUp, signOut, loadTenant, setActiveTenant],
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
