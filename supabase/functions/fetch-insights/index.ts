import { adminClient, getUserId } from '../_shared/db.ts'
import { decryptToken } from '../_shared/crypto.ts'
import { fetchMediaInsights } from '../_shared/meta.ts'
import { handleOptions, json } from '../_shared/http.ts'

function isServiceAuthorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') === secret) return true
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return Boolean(service) && req.headers.get('Authorization') === `Bearer ${service}`
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  const service = isServiceAuthorized(req)
  const userId = service ? null : await getUserId(req)
  if (!service && !userId) return json({ error: 'Nao autorizado.' }, 401)

  const sb = adminClient()
  const force = new URL(req.url).searchParams.get('force') === '1'

  let tenantIds: string[] | null = null
  if (userId) {
    const { data: memberships } = await sb
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', userId)
    tenantIds = (memberships ?? []).map((m) => m.tenant_id as string)
    if (tenantIds.length === 0) return json({ synced: 0 })
  }

  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  let query = sb
    .from('posts')
    .select('id, tenant_id, ig_media_id, social_accounts(auth_path, access_token_enc)')
    .eq('status', 'published')
    .not('ig_media_id', 'is', null)
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(50)
  if (tenantIds) query = query.in('tenant_id', tenantIds)

  const { data: posts, error } = await query
  if (error) return json({ error: error.message }, 500)

  const ids = (posts ?? []).map((p) => p.id as string)
  const recent = new Map<string, string>()
  if (ids.length > 0 && !force) {
    const { data: existing } = await sb
      .from('post_insights')
      .select('post_id, fetched_at')
      .in('post_id', ids)
    for (const row of existing ?? []) {
      recent.set(row.post_id as string, row.fetched_at as string)
    }
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const post of posts ?? []) {
    const id = post.id as string
    if (!force) {
      const fetchedAt = recent.get(id)
      if (fetchedAt && Date.now() - new Date(fetchedAt).getTime() < 12 * 3600_000) {
        continue
      }
    }
    const account = post.social_accounts as Record<string, unknown> | null
    if (!account?.access_token_enc) continue
    try {
      const token = await decryptToken(account.access_token_enc as string)
      const authPath = (account.auth_path as 'facebook' | 'instagram') ?? 'instagram'
      const metrics = await fetchMediaInsights(
        authPath,
        post.ig_media_id as string,
        token,
      )
      const { error: upErr } = await sb.from('post_insights').upsert({
        post_id: id,
        tenant_id: post.tenant_id,
        ...metrics,
        fetched_at: new Date().toISOString(),
      })
      if (upErr) throw upErr
      results.push({ id, ok: true })
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return json({ synced: results.filter((r) => r.ok).length, results })
})
