import { adminClient } from '../_shared/db.ts'
import { encryptToken, verifyState } from '../_shared/crypto.ts'
import { redirect } from '../_shared/http.ts'
import { exchangeCode } from '../_shared/meta.ts'
import type { AuthPath } from '../_shared/types.ts'

function appUrl(): string {
  return (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
}

function back(params: string): Response {
  return redirect(`${appUrl()}/accounts?${params}`)
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  if (oauthError) {
    return back(`error=${encodeURIComponent(errorDescription ?? oauthError)}`)
  }
  if (!code || !state) return back('error=Parametros ausentes')

  const verified = await verifyState(state)
  if (!verified) return back('error=State invalido')

  let parsed: { tenantId: string; authPath: AuthPath }
  try {
    parsed = JSON.parse(verified)
  } catch {
    return back('error=State corrompido')
  }

  try {
    const redirectUri = Deno.env.get('META_REDIRECT_URI') ?? url.origin + url.pathname
    const identity = await exchangeCode(parsed.authPath, code, redirectUri)
    const tokenEnc = await encryptToken(identity.accessToken)

    const expiresAt = identity.expiresIn
      ? new Date(Date.now() + identity.expiresIn * 1000).toISOString()
      : null

    const sb = adminClient()
    const { error } = await sb.from('social_accounts').upsert(
      {
        tenant_id: parsed.tenantId,
        platform: 'instagram',
        auth_path: parsed.authPath,
        ig_user_id: identity.igUserId,
        username: identity.username,
        account_type: identity.accountType,
        fb_page_id: identity.fbPageId,
        access_token_enc: tokenEnc,
        token_expires_at: expiresAt,
        scopes: null,
        status: 'connected',
        last_error: null,
      },
      { onConflict: 'tenant_id,auth_path,ig_user_id' },
    )
    if (error) throw error

    return back('connected=1')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na conexao'
    return back(`error=${encodeURIComponent(message)}`)
  }
})
