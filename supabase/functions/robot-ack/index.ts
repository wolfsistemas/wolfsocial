import { handleOptions, json } from '../_shared/http.ts'
import { deviceFromToken } from '../_shared/robot.ts'

interface AckResult {
  id?: string
  status?: 'sent' | 'failed'
  error?: string
  metaMessageId?: string
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const found = await deviceFromToken(req)
    if (!found) return json({ error: 'Token do robo invalido.' }, 401)
    const { sb, device } = found

    const body = await req.json().catch(() => ({}))
    const results = Array.isArray(body.results) ? (body.results as AckResult[]) : []
    if (!results.length) return json({ error: 'results obrigatorio.' }, 400)

    let updated = 0
    for (const result of results) {
      if (!result.id) continue
      const { data: row } = await sb
        .from('wa_outbox')
        .select('id, tenant_id, to_phone, body, kind, media_url, attempts, max_attempts')
        .eq('id', result.id)
        .eq('tenant_id', device.tenant_id)
        .maybeSingle()
      if (!row) continue

      const sent = result.status === 'sent'
      const exhausted = (row.attempts ?? 0) >= (row.max_attempts ?? 3)
      const error = sent ? null : String(result.error ?? 'Falha no envio pelo robo')

      await sb
        .from('wa_outbox')
        .update(
          sent
            ? { status: 'sent', sent_at: new Date().toISOString(), last_error: null }
            : {
                status: exhausted ? 'failed' : 'queued',
                claimed_at: null,
                last_error: error,
              },
        )
        .eq('id', row.id)

      await sb.from('whatsapp_messages').insert({
        tenant_id: row.tenant_id,
        direction: 'out',
        wa_to: row.to_phone,
        kind: row.kind,
        body: row.body,
        status: sent ? 'sent' : 'failed',
        error,
        meta_message_id: result.metaMessageId ?? null,
        payload: { robotDeviceId: device.id, robotDeviceName: device.name },
      })
      updated += 1
    }

    await sb
      .from('robot_devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device.id)

    return json({ ok: true, updated })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500)
  }
})
