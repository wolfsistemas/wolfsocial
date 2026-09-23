import { getUserId, userClient } from '../_shared/db.ts'
import { signState } from '../_shared/crypto.ts'
import { handleOptions, json, requireEnv } from '../_shared/http.ts'
import { authorizeUrl } from '../_shared/meta.ts'
import type { AuthPath } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const userId = await getUserId(req)
    if (!userId) return json({ error: 'Nao autenticado.' }, 401)

    const sb = userClient(req)
    const { data: membership } = await sb
      .from('memberships')
      .select('tenant_id')
      .limit(1)
      .maybeSingle()
    if (!membership?.tenant_id) return json({ error: 'Espaco nao encontrado.' }, 400)

    const body = await req.json().catch(() => ({}))
    const authPath: AuthPath =
      body.authPath === 'instagram' ? 'instagram' : 'facebook'

    const redirectUri = requireEnv('META_REDIRECT_URI')
    const state = await signState(
      JSON.stringify({ tenantId: membership.tenant_id, authPath, ts: Date.now() }),
    )

    return json({ url: authorizeUrl(authPath, redirectUri, state) })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500)
  }
})
