import { handleOptions, json } from '../_shared/http.ts'
import { deviceFromToken } from '../_shared/robot.ts'

const CLAIM_LIMIT = 10
const STALE_MS = 5 * 60 * 1000

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const found = await deviceFromToken(req)
    if (!found) return json({ error: 'Token do robo invalido.' }, 401)
    const { sb, device } = found

    const now = new Date()
    await sb
      .from('robot_devices')
      .update({ last_seen_at: now.toISOString(), last_error: null })
      .eq('id', device.id)

    // Recover messages stuck in "sending" (robot crashed mid-flight).
    const staleCutoff = new Date(now.getTime() - STALE_MS).toISOString()
    await sb
      .from('wa_outbox')
      .update({ status: 'queued', claimed_at: null })
      .eq('tenant_id', device.tenant_id)
      .eq('status', 'sending')
      .lt('claimed_at', staleCutoff)

    const { data: candidates } = await sb
      .from('wa_outbox')
      .select('id, attempts, max_attempts')
      .eq('tenant_id', device.tenant_id)
      .eq('status', 'queued')
      .or(`device_id.is.null,device_id.eq.${device.id}`)
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(CLAIM_LIMIT)

    const claimed: Array<Record<string, unknown>> = []
    for (const candidate of candidates ?? []) {
      const { data: row } = await sb
        .from('wa_outbox')
        .update({
          status: 'sending',
          claimed_at: now.toISOString(),
          device_id: device.id,
          attempts: (candidate.attempts ?? 0) + 1,
        })
        .eq('id', candidate.id)
        .eq('status', 'queued')
        .select('id, to_phone, body, kind, media_url, attempts, max_attempts')
        .maybeSingle()
      if (row) claimed.push(row)
    }

    return json({
      device: { id: device.id, name: device.name },
      messages: claimed.map((row) => ({
        id: row.id,
        to: row.to_phone,
        body: row.body,
        kind: row.kind,
        mediaUrl: row.media_url,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
      })),
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500)
  }
})
