import { adminClient, getUserId, userClient } from '../_shared/db.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { handleOptions, json } from '../_shared/http.ts'
import {
  normalizePhone,
  sendWhatsappTemplate,
  sendWhatsappText,
} from '../_shared/whatsapp.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const userId = await getUserId(req)
    if (!userId) return json({ error: 'Nao autenticado.' }, 401)

    const body = await req.json().catch(() => ({}))
    const tenantId = body.tenantId as string | undefined
    if (!tenantId) return json({ error: 'tenantId obrigatorio.' }, 400)

    const sbUser = userClient(req)
    const { data: tenant } = await sbUser
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .maybeSingle()
    if (!tenant) return json({ error: 'Acesso negado.' }, 403)

    const to = normalizePhone(String(body.to ?? ''))
    if (!to) return json({ error: 'Numero de destino obrigatorio.' }, 400)

    const sb = adminClient()
    const accountId = body.accountId as string | undefined
    let query = sb
      .from('whatsapp_accounts')
      .select('id, phone_number_id, access_token_enc')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
    if (accountId) query = query.eq('id', accountId)
    const { data: account } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!account?.access_token_enc) {
      return json({ error: 'Nenhuma conta WhatsApp conectada.' }, 400)
    }

    const token = await decryptToken(account.access_token_enc)
    const template = body.template as
      | { name?: string; language?: string; params?: string[] }
      | undefined
    const text = String(body.text ?? '')

    if (!template?.name && !text.trim()) {
      return json({ error: 'Informe text ou template.' }, 400)
    }

    let messageId: string | null = null
    let kind = 'text'
    let sentBody = text
    try {
      if (template?.name) {
        const result = await sendWhatsappTemplate(
          account.phone_number_id,
          token,
          to,
          template.name,
          template.language ?? 'pt_BR',
          template.params ?? [],
        )
        messageId = result.messageId
        kind = 'template'
        sentBody = `template:${template.name}`
      } else {
        const result = await sendWhatsappText(
          account.phone_number_id,
          token,
          to,
          text,
        )
        messageId = result.messageId
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no envio'
      await sb.from('whatsapp_messages').insert({
        tenant_id: tenantId,
        account_id: account.id,
        direction: 'out',
        wa_to: to,
        kind,
        body: sentBody,
        status: 'failed',
        error: message,
      })
      return json({ error: message }, 502)
    }

    await sb.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      account_id: account.id,
      meta_message_id: messageId,
      direction: 'out',
      wa_to: to,
      kind,
      body: sentBody,
      status: 'sent',
    })

    return json({ ok: true, messageId })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500)
  }
})
