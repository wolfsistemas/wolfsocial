import { adminClient } from '../_shared/db.ts'
import { verifyWebhookSignature } from '../_shared/whatsapp.ts'

interface WaMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  button?: { text?: string }
  interactive?: { button_reply?: { title?: string } }
  image?: { caption?: string }
  video?: { caption?: string }
}

interface WaStatus {
  id?: string
  status?: string
  recipient_id?: string
  errors?: { code?: number; title?: string; message?: string }[]
}

interface WaValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  messages?: WaMessage[]
  statuses?: WaStatus[]
}

function inboundBody(message: WaMessage): string | null {
  if (message.text?.body) return message.text.body
  if (message.button?.text) return message.button.text
  if (message.interactive?.button_reply?.title) {
    return message.interactive.button_reply.title
  }
  if (message.image?.caption) return message.image.caption
  if (message.video?.caption) return message.video.caption
  return null
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Webhook verification (Meta calls this when subscribing).
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    if (mode === 'subscribe' && expected && token === expected) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const raw = await req.text()

  const appSecret = Deno.env.get('META_APP_SECRET')
  if (!appSecret) {
    console.error('whatsapp-webhook: META_APP_SECRET ausente; recusando POST.')
    return new Response('Server misconfigured', { status: 500 })
  }
  const valid = await verifyWebhookSignature(
    appSecret,
    raw,
    req.headers.get('x-hub-signature-256'),
  )
  if (!valid) return new Response('Invalid signature', { status: 401 })

  let payload: { entry?: { changes?: { value?: WaValue }[] }[] }
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('EVENT_RECEIVED', { status: 200 })
  }

  try {
    const sb = adminClient()
    const values: WaValue[] = []
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.value) values.push(change.value)
      }
    }

    const phoneIds = [
      ...new Set(
        values
          .map((v) => v.metadata?.phone_number_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    const accountByPhone = new Map<string, string>()
    if (phoneIds.length) {
      const { data } = await sb
        .from('whatsapp_accounts')
        .select('id, phone_number_id, tenant_id')
        .in('phone_number_id', phoneIds)
      for (const row of data ?? []) {
        accountByPhone.set(row.phone_number_id as string, row.id as string)
        accountByPhone.set(
          `${row.phone_number_id}:tenant`,
          row.tenant_id as string,
        )
      }
    }

    for (const value of values) {
      const phoneId = value.metadata?.phone_number_id ?? ''
      const accountId = accountByPhone.get(phoneId) ?? null
      const tenantId = accountByPhone.get(`${phoneId}:tenant`) ?? null
      if (!tenantId) continue

      for (const message of value.messages ?? []) {
        if (!message.id) continue
        const body = inboundBody(message)
        await sb.from('whatsapp_messages').upsert(
          {
            tenant_id: tenantId,
            account_id: accountId,
            meta_message_id: message.id,
            direction: 'in',
            wa_from: message.from ?? null,
            kind: message.type ?? 'text',
            body,
            status: 'received',
            payload: message,
          },
          { onConflict: 'meta_message_id', ignoreDuplicates: true },
        )
      }

      for (const status of value.statuses ?? []) {
        if (!status.id) continue
        const error = status.errors?.[0]
        await sb
          .from('whatsapp_messages')
          .update({
            status: status.status ?? null,
            error: error
              ? [error.title, error.message].filter(Boolean).join(' | ')
              : null,
          })
          .eq('tenant_id', tenantId)
          .eq('meta_message_id', status.id)
      }
    }
  } catch (err) {
    // Meta only needs a 200 to stop retrying, but log so failures are visible.
    console.error('whatsapp-webhook: falha ao processar evento', err)
  }

  return new Response('EVENT_RECEIVED', { status: 200 })
})
