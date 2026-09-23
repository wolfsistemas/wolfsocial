import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { requireEnv } from './http.ts'

export function adminClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? ''
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getUserId(req: Request): Promise<string | null> {
  const sb = userClient(req)
  const { data } = await sb.auth.getUser()
  return data.user?.id ?? null
}

export async function log(
  postId: string,
  tenantId: string,
  level: string,
  message: string,
  payload?: unknown,
): Promise<void> {
  try {
    const sb = adminClient()
    await sb.from('publish_logs').insert({
      post_id: postId,
      tenant_id: tenantId,
      level,
      message,
      payload: payload ?? null,
    })
  } catch {
    // logging must never break the publish flow
  }
}

// Creates an in-app notification and, when configured, forwards it to the
// tenant's alert webhook. Never throws.
export async function notify(
  tenantId: string,
  level: 'info' | 'warn' | 'error',
  title: string,
  message?: string,
): Promise<void> {
  const sb = adminClient()
  try {
    await sb.from('notifications').insert({
      tenant_id: tenantId,
      level,
      title,
      message: message ?? null,
    })
  } catch {
    // ignore
  }
  try {
    const { data } = await sb
      .from('tenants')
      .select('alert_webhook_url')
      .eq('id', tenantId)
      .single()
    const url = data?.alert_webhook_url as string | null
    if (url) {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, title, message: message ?? null, tenantId }),
      })
    }
  } catch {
    // webhook is best effort
  }
}
