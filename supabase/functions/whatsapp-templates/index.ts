import { adminClient, getUserId, userClient } from '../_shared/db.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { handleOptions, json } from '../_shared/http.ts'
import { listMessageTemplates } from '../_shared/whatsapp.ts'

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

    const sb = adminClient()
    const { data: account } = await sb
      .from('whatsapp_accounts')
      .select('waba_id, access_token_enc')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!account?.waba_id) {
      return json(
        { error: 'Conecte a conta e informe o WABA ID para listar templates.' },
        400,
      )
    }
    if (!account.access_token_enc) {
      return json({ error: 'Conta WhatsApp sem token.' }, 400)
    }

    const token = await decryptToken(account.access_token_enc)
    const templates = await listMessageTemplates(account.waba_id, token)
    return json({ ok: true, templates })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Erro ao listar templates' },
      500,
    )
  }
})
