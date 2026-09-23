import type { AuthPath } from './types.ts'

export function graphVersion(): string {
  return Deno.env.get('META_GRAPH_VERSION') ?? 'v21.0'
}

export function metaAppId(): string {
  const id = Deno.env.get('META_APP_ID')
  if (!id) throw new Error('META_APP_ID nao configurado')
  return id
}

export function metaAppSecret(): string {
  const secret = Deno.env.get('META_APP_SECRET')
  if (!secret) throw new Error('META_APP_SECRET nao configurado')
  return secret
}

export function instagramAppId(): string {
  return Deno.env.get('META_INSTAGRAM_APP_ID') ?? metaAppId()
}

export function instagramAppSecret(): string {
  return Deno.env.get('META_INSTAGRAM_APP_SECRET') ?? metaAppSecret()
}

export function graphBase(authPath: AuthPath): string {
  return authPath === 'instagram'
    ? `https://graph.instagram.com/${graphVersion()}`
    : `https://graph.facebook.com/${graphVersion()}`
}

export function authorizeUrl(
  authPath: AuthPath,
  redirectUri: string,
  state: string,
): string {
  const appId = authPath === 'instagram' ? instagramAppId() : metaAppId()
  if (authPath === 'instagram') {
    const scope = [
      'instagram_business_basic',
      'instagram_business_content_publish',
      'instagram_business_manage_comments',
      'instagram_business_manage_insights',
    ].join(',')
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state,
    })
    return `https://www.instagram.com/oauth/authorize?${params}`
  }
  const configId = Deno.env.get('META_FB_LOGIN_CONFIG_ID')
  if (configId) {
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      config_id: configId,
      override_default_response_type: 'true',
    })
    return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${params}`
  }
  const scope = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ].join(',')
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope,
  })
  return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${params}`
}

export interface Identity {
  igUserId: string
  username: string | null
  accountType: string | null
  fbPageId: string | null
  accessToken: string
  expiresIn: number | null
}

export async function exchangeCode(
  authPath: AuthPath,
  code: string,
  redirectUri: string,
): Promise<Identity> {
  if (authPath === 'instagram') {
    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: instagramAppId(),
        client_secret: instagramAppSecret(),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    })
    const short = await res.json()
    if (!res.ok) throw new Error(readError(short))
    const long = await fetch(
      `https://graph.instagram.com/access_token?${new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: instagramAppSecret(),
        access_token: short.access_token,
      })}`,
    )
    const longJson = await long.json()
    if (!long.ok) throw new Error(readError(longJson))
    const profile = await fetch(
      `${graphBase('instagram')}/me?${new URLSearchParams({
        fields: 'user_id,username,account_type',
        access_token: longJson.access_token,
      })}`,
    )
    const me = await profile.json()
    if (!profile.ok) throw new Error(readError(me))
    return {
      igUserId: String(me.user_id ?? me.id ?? short.user_id),
      username: me.username ?? null,
      accountType: me.account_type ?? 'BUSINESS',
      fbPageId: null,
      accessToken: longJson.access_token,
      expiresIn: longJson.expires_in ?? null,
    }
  }

  const tokenRes = await fetch(
    `https://graph.facebook.com/${graphVersion()}/oauth/access_token?${new URLSearchParams({
      client_id: metaAppId(),
      redirect_uri: redirectUri,
      client_secret: metaAppSecret(),
      code,
    })}`,
  )
  const short = await tokenRes.json()
  if (!tokenRes.ok) throw new Error(readError(short))

  const longRes = await fetch(
    `https://graph.facebook.com/${graphVersion()}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: metaAppId(),
      client_secret: metaAppSecret(),
      fb_exchange_token: short.access_token,
    })}`,
  )
  const long = await longRes.json()
  if (!longRes.ok) throw new Error(readError(long))

  const pagesRes = await fetch(
    `https://graph.facebook.com/${graphVersion()}/me/accounts?${new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      access_token: long.access_token,
    })}`,
  )
  const pages = await pagesRes.json()
  if (!pagesRes.ok) throw new Error(readError(pages))

  const page = (pages.data ?? []).find(
    (p: Record<string, unknown>) => p.instagram_business_account,
  )
  if (!page) {
    throw new Error(
      'Nenhuma Pagina com conta profissional do Instagram foi encontrada. Vincule o Instagram a uma Pagina no Portifolio Empresarial.',
    )
  }
  const ig = page.instagram_business_account as Record<string, string>
  return {
    igUserId: ig.id,
    username: ig.username ?? null,
    accountType: 'BUSINESS',
    fbPageId: page.id as string,
    accessToken: (page.access_token as string) ?? long.access_token,
    expiresIn: long.expires_in ?? null,
  }
}

export async function refreshToken(
  authPath: AuthPath,
  token: string,
): Promise<{ accessToken: string; expiresIn: number | null }> {
  if (authPath === 'instagram') {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
        grant_type: 'ig_refresh_token',
        access_token: token,
      })}`,
    )
    const data = await res.json()
    if (!res.ok) throw new Error(readError(data))
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? null }
  }
  const res = await fetch(
    `https://graph.facebook.com/${graphVersion()}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: metaAppId(),
      client_secret: metaAppSecret(),
      fb_exchange_token: token,
    })}`,
  )
  const data = await res.json()
  if (!res.ok) throw new Error(readError(data))
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? null }
}

export function readError(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    const err = obj.error as Record<string, unknown> | undefined
    if (err) {
      const parts = [err.message, err.type, err.code, err.error_subcode]
        .filter(Boolean)
        .join(' | ')
      return parts || JSON.stringify(obj)
    }
    if (obj.error_message) return String(obj.error_message)
  }
  return JSON.stringify(payload)
}
