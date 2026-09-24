import { adminClient, getUserId, userClient } from '../_shared/db.ts'
import { encryptToken } from '../_shared/crypto.ts'
import { handleOptions, json } from '../_shared/http.ts'
import { fetchPhoneInfo, normalizePhone } from '../_shared/whatsapp.ts'

async function isMember(req: Request, tenantId: string): Promise<boolean> {
  const sb = userClient(req)
  const { data } = await sb
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle()
  return Boolean(data)
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const userId = await getUserId(req)
    if (!userId) return json({ error: 'Nao autenticado.' }, 401)

    const body = await req.json().catch(() => ({}))
    const tenantId = body.tenantId as string | undefined
    const action = (body.action as string | undefined) ?? 'save'
    if (!tenantId) return json({ error: 'tenantId obrigatorio.' }, 400)
    if (!(await isMember(req, tenantId))) {
      return json({ error: 'Acesso negado.' }, 403)
    }

    const sb = adminClient()

    if (action === 'remove') {
      const accountId = body.accountId as string | undefined
      if (!accountId) return json({ error: 'accountId obrigatorio.' }, 400)
      const { error } = await sb
        .from('whatsapp_accounts')
        .delete()
        .eq('id', accountId)
        .eq('tenant_id', tenantId)
      if (error) throw error
      return json({ ok: true })
    }

    const phoneNumberId = String(body.phoneNumberId ?? '').trim()
    const accessToken = String(body.accessToken ?? '').trim()
    if (!phoneNumberId) {
      return json({ error: 'phoneNumberId obrigatorio.' }, 400)
    }
    const wabaId = body.wabaId ? String(body.wabaId).trim() : null
    const alertPhone = body.alertPhone
      ? normalizePhone(String(body.alertPhone))
      : null
    const notifyEnabled = Boolean(body.notifyEnabled)

    // Without a token we can only update the editable settings of an
    // already connected account (alert phone, notifications, WABA id).
    if (!accessToken) {
      const { data: existing } = await sb
        .from('whatsapp_accounts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle()
      if (!existing) {
        return json(
          { error: 'accessToken obrigatorio para conectar.' },
          400,
        )
      }
      const patch: Record<string, unknown> = {
        status: 'connected',
        notify_enabled: notifyEnabled,
        alert_phone: alertPhone,
        last_error: null,
      }
      if (wabaId) patch.waba_id = wabaId
      const { error } = await sb
        .from('whatsapp_accounts')
        .update(patch)
        .eq('id', existing.id)
      if (error) throw error
      return json({ ok: true })
    }

    // Validates the token and reads the phone metadata from Meta.
    const info = await fetchPhoneInfo(phoneNumberId, accessToken)
    const enc = await encryptToken(accessToken)

    const { error } = await sb.from('whatsapp_accounts').upsert(
      {
        tenant_id: tenantId,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        display_phone: info.display_phone_number ?? null,
        verified_name: info.verified_name ?? null,
        access_token_enc: enc,
        status: 'connected',
        notify_enabled: notifyEnabled,
        alert_phone: alertPhone,
        last_error: null,
      },
      { onConflict: 'tenant_id,phone_number_id' },
    )
    if (error) throw error

    return json({
      ok: true,
      displayPhone: info.display_phone_number ?? null,
      verifiedName: info.verified_name ?? null,
    })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Erro na conexao' },
      500,
    )
  }
})
