import { adminClient } from '../_shared/db.ts'
import { decryptToken, encryptToken } from '../_shared/crypto.ts'
import { refreshToken } from '../_shared/meta.ts'
import { handleOptions, json } from '../_shared/http.ts'
import type { AuthPath } from '../_shared/types.ts'

function authorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') === secret) return true
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return Boolean(service) && req.headers.get('Authorization') === `Bearer ${service}`
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight
  if (!authorized(req)) return json({ error: 'Nao autorizado.' }, 401)

  const sb = adminClient()
  const threshold = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

  const { data: accounts } = await sb
    .from('social_accounts')
    .select('id, auth_path, access_token_enc, token_expires_at')
    .eq('status', 'connected')
    .not('token_expires_at', 'is', null)
    .lte('token_expires_at', threshold)

  let refreshed = 0
  for (const account of accounts ?? []) {
    try {
      const token = await decryptToken(account.access_token_enc as string)
      const result = await refreshToken(account.auth_path as AuthPath, token)
      const enc = await encryptToken(result.accessToken)
      await sb
        .from('social_accounts')
        .update({
          access_token_enc: enc,
          token_expires_at: result.expiresIn
            ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
            : null,
          status: 'connected',
          last_error: null,
        })
        .eq('id', account.id)
      refreshed += 1
    } catch (err) {
      await sb
        .from('social_accounts')
        .update({
          status: 'error',
          last_error: err instanceof Error ? err.message : 'Falha no refresh',
        })
        .eq('id', account.id)
    }
  }

  return json({ checked: accounts?.length ?? 0, refreshed })
})
