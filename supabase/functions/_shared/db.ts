import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { requireEnv } from './http.ts'
import { decryptToken } from './crypto.ts'
import { sendWhatsappTemplate, sendWhatsappText } from './whatsapp.ts'

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

  await forwardToWhatsapp(tenantId, level, title, message)
}

// Sends the notification to the tenant's WhatsApp alert number, when the
// tenant opted in. Business-initiated messages outside the 24h window require
// an approved template; set WHATSAPP_NOTIFY_TEMPLATE to use one, otherwise a
// free-form text is attempted (works inside the 24h window / test recipients).
async function forwardToWhatsapp(
  tenantId: string,
  level: string,
  title: string,
  message?: string,
): Promise<void> {
  try {
    const sb = adminClient()
    const { data: account } = await sb
      .from('whatsapp_accounts')
      .select('id, phone_number_id, access_token_enc, alert_phone')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .eq('notify_enabled', true)
      .not('alert_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!account?.access_token_enc || !account.alert_phone) return

    const token = await decryptToken(account.access_token_enc)
    const text = `[${level}] ${title}${message ? `\n${message}` : ''}`
    const template = Deno.env.get('WHATSAPP_NOTIFY_TEMPLATE')

    let messageId: string | null = null
    if (template) {
      const result = await sendWhatsappTemplate(
        account.phone_number_id,
        token,
        account.alert_phone,
        template,
        Deno.env.get('WHATSAPP_NOTIFY_TEMPLATE_LANG') ?? 'pt_BR',
        [title, message ?? ''],
      )
      messageId = result.messageId
    } else {
      const result = await sendWhatsappText(
        account.phone_number_id,
        token,
        account.alert_phone,
        text,
      )
      messageId = result.messageId
    }

    await sb.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      account_id: account.id,
      meta_message_id: messageId,
      direction: 'out',
      wa_to: account.alert_phone,
      kind: template ? 'template' : 'text',
      body: template ? `template:${template}` : text,
      status: 'sent',
    })
  } catch {
    // notifications must never break the caller
  }
}
