import { adminClient, getUserId, userClient } from '../_shared/db.ts'
import { sha256Hex } from '../_shared/crypto.ts'
import { handleOptions, json } from '../_shared/http.ts'

function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  let binary = ''
  for (const byte of buf) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const DEVICE_COLUMNS = 'id, tenant_id, name, status, last_seen_at, last_error, alert_phone, notify_enabled, notify_only_failures, created_at, updated_at'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const userId = await getUserId(req)
    if (!userId) return json({ error: 'Nao autenticado.' }, 401)

    const body = await req.json().catch(() => ({}))
    const tenantId = body.tenantId as string | undefined
    const action = String(body.action ?? 'list')
    if (!tenantId) return json({ error: 'tenantId obrigatorio.' }, 400)

    const sbUser = userClient(req)
    const { data: tenant } = await sbUser
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant) return json({ error: 'Acesso negado.' }, 403)

    const sb = adminClient()

    if (action === 'list') {
      const { data, error } = await sb
        .from('robot_devices')
        .select(DEVICE_COLUMNS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return json({ devices: data ?? [] })
    }

    if (action === 'create') {
      const name = String(body.name ?? '').trim() || 'Meu computador'
      const token = randomToken()
      const tokenHash = await sha256Hex(token)
      const { data: device, error } = await sb
        .from('robot_devices')
        .insert({
          tenant_id: tenantId,
          name,
        })
        .select(DEVICE_COLUMNS)
        .single()
      if (error) throw error
      const { error: secretErr } = await sb
        .from('robot_device_secrets')
        .insert({ device_id: device.id, token_hash: tokenHash })
      if (secretErr) {
        await sb.from('robot_devices').delete().eq('id', device.id)
        throw secretErr
      }
      return json({ device, token })
    }

    // Alert settings for the whole tenant (applied to every device; the
    // notifier picks the most recently seen active device).
    if (action === 'settings') {
      const alertPhone = String(body.alertPhone ?? '').replace(/\D/g, '')
      const notifyEnabled =
        body.notifyEnabled === true || body.notifyEnabled === 'true'
      const notifyOnlyFailures =
        body.notifyOnlyFailures === true || body.notifyOnlyFailures === 'true'
      const { error } = await sb
        .from('robot_devices')
        .update({
          alert_phone: alertPhone || null,
          notify_enabled: notifyEnabled,
          notify_only_failures: notifyOnlyFailures,
        })
        .eq('tenant_id', tenantId)
      if (error) throw error
      return json({
        ok: true,
        alert_phone: alertPhone || null,
        notify_enabled: notifyEnabled,
        notify_only_failures: notifyOnlyFailures,
      })
    }

    const deviceId = body.deviceId as string | undefined
    if (!deviceId) return json({ error: 'deviceId obrigatorio.' }, 400)

    const { data: existing } = await sb
      .from('robot_devices')
      .select('id')
      .eq('id', deviceId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!existing) return json({ error: 'Dispositivo nao encontrado.' }, 404)

    if (action === 'rotate') {
      const token = randomToken()
      const tokenHash = await sha256Hex(token)
      const { error } = await sb
        .from('robot_device_secrets')
        .upsert({ device_id: deviceId, token_hash: tokenHash }, { onConflict: 'device_id' })
      if (error) throw error
      return json({ token })
    }

    if (action === 'remove') {
      const { error } = await sb.from('robot_devices').delete().eq('id', deviceId)
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'Acao invalida.' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500)
  }
})
