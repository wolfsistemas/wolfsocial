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

interface FbPage {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: { id: string; username?: string }
}

const PAGE_FIELDS = 'id,name,access_token,instagram_business_account{id,username}'

async function fetchGraphList(
  path: string,
  fields: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let url: string | null =
    `https://graph.facebook.com/${graphVersion()}/${path}` +
    `?${new URLSearchParams({ fields, access_token: token, limit: '100' })}`
  let guard = 0
  while (url && guard < 20) {
    guard += 1
    const res = await fetch(url)
    const json = await res.json()
    if (!res.ok) throw new Error(readError(json))
    if (Array.isArray(json.data)) out.push(...json.data)
    const next = (json.paging as Record<string, unknown> | undefined)?.next
    url = typeof next === 'string' ? next : null
  }
  return out
}

// Lists Pages the user can act on, including Pages owned by a Business
// Portfolio (which do not always show up under /me/accounts).
async function listManagedPages(token: string): Promise<FbPage[]> {
  const pages = (await fetchGraphList(
    'me/accounts',
    PAGE_FIELDS,
    token,
  )) as unknown as FbPage[]

  let businesses: Record<string, unknown>[] = []
  try {
    businesses = await fetchGraphList('me/businesses', 'id,name', token)
  } catch {
    businesses = []
  }
  for (const biz of businesses) {
    for (const edge of ['owned_pages', 'client_pages']) {
      try {
        const list = (await fetchGraphList(
          `${String(biz.id)}/${edge}`,
          PAGE_FIELDS,
          token,
        )) as unknown as FbPage[]
        pages.push(...list)
      } catch {
        // Edge indisponivel para este portfolio; segue para o proximo.
      }
    }
  }

  const seen = new Map<string, FbPage>()
  for (const page of pages) {
    if (page?.id && !seen.has(page.id)) seen.set(page.id, page)
  }
  return [...seen.values()]
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

  const pages = await listManagedPages(long.access_token)
  const page = pages.find((p) => p.instagram_business_account)
  if (!page) {
    const seen = pages
      .map((p) => p.name ?? p.id)
      .slice(0, 10)
      .join(', ')
    throw new Error(
      pages.length
        ? `Nenhuma Pagina com conta profissional do Instagram foi encontrada. Paginas vistas: ${seen}. Vincule o Instagram a uma Pagina no Portfolio Empresarial.`
        : 'Nenhuma Pagina do Facebook foi encontrada nesta conta. Crie uma Pagina e vincule o Instagram a ela no Portfolio Empresarial.',
    )
  }
  const ig = page.instagram_business_account!
  return {
    igUserId: ig.id,
    username: ig.username ?? null,
    accountType: 'BUSINESS',
    fbPageId: page.id,
    accessToken: page.access_token ?? long.access_token,
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
      const parts = [
        err.message,
        err.type,
        err.code,
        err.error_subcode,
        err.error_user_msg,
      ]
        .filter(Boolean)
        .join(' | ')
      return parts || JSON.stringify(obj)
    }
    if (obj.error_message) return String(obj.error_message)
  }
  return JSON.stringify(payload)
}

export interface MediaInsights {
  impressions: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
}

const INSIGHT_METRICS = ['reach', 'likes', 'comments', 'saved', 'shares', 'impressions']

function pickValue(data: unknown, metric: string): number | null {
  if (!data || typeof data !== 'object') return null
  const list = (data as { data?: unknown }).data
  if (!Array.isArray(list)) return null
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    if (row.name !== metric) continue
    const values = row.values
    if (Array.isArray(values) && values.length > 0) {
      const last = values[values.length - 1] as Record<string, unknown>
      const v = last?.value
      if (typeof v === 'number') return v
      if (typeof v === 'string' && v !== '') return Number(v)
    }
    if (typeof row.value === 'number') return row.value
  }
  return null
}

// Reads lifetime insights for a published media. Tries the batch endpoint and
// falls back to per-metric calls so a single unsupported metric does not fail
// the whole sync.
export async function fetchMediaInsights(
  authPath: AuthPath,
  mediaId: string,
  accessToken: string,
): Promise<MediaInsights> {
  const base = graphBase(authPath)
  const empty: MediaInsights = {
    impressions: null,
    reach: null,
    likes: null,
    comments: null,
    saves: null,
    shares: null,
  }

  const batchUrl = `${base}/${mediaId}/insights?${new URLSearchParams({
    metric: INSIGHT_METRICS.join(','),
    access_token: accessToken,
  })}`
  const batchRes = await fetch(batchUrl)
  const batchJson = await batchRes.json()
  if (batchRes.ok) {
    return {
      impressions: pickValue(batchJson, 'impressions'),
      reach: pickValue(batchJson, 'reach'),
      likes: pickValue(batchJson, 'likes'),
      comments: pickValue(batchJson, 'comments'),
      saves: pickValue(batchJson, 'saved'),
      shares: pickValue(batchJson, 'shares'),
    }
  }

  const result = { ...empty }
  for (const metric of INSIGHT_METRICS) {
    try {
      const res = await fetch(
        `${base}/${mediaId}/insights?${new URLSearchParams({
          metric,
          access_token: accessToken,
        })}`,
      )
      if (!res.ok) continue
      const json = await res.json()
      const value = pickValue(json, metric)
      if (metric === 'saved') result.saves = value
      else (result as Record<string, number | null>)[metric] = value
    } catch {
      // ignore individual metric failures
    }
  }
  return result
}
