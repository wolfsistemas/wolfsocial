import { adminClient } from '../_shared/db.ts'
import { processPost } from '../_shared/process.ts'
import { handleOptions, json } from '../_shared/http.ts'

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
  const now = Date.now()
  const nowIso = new Date(now).toISOString()

  const { data: due } = await sb
    .from('posts')
    .select('id, status, updated_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(5)

  const staleCutoff = new Date(now - 2 * 60_000).toISOString()
  const { data: resumable } = await sb
    .from('posts')
    .select('id, status, updated_at')
    .eq('status', 'publishing')
    .lt('updated_at', staleCutoff)
    .limit(5)

  const candidates = new Map<string, string>()
  for (const post of due ?? []) {
    candidates.set(post.id as string, post.updated_at as string)
  }
  for (const post of resumable ?? []) {
    if (!candidates.has(post.id as string)) {
      candidates.set(post.id as string, post.updated_at as string)
    }
  }

  const results: Array<{ id: string; ok: boolean }> = []
  for (const [id, previousUpdatedAt] of candidates) {
    // Atomic claim: only the worker that moves updated_at from its observed
    // value may process the post. Prevents overlapping cron runs from
    // publishing the same post twice.
    const { data: claimed } = await sb
      .from('posts')
      .update({ status: 'publishing', updated_at: nowIso })
      .eq('id', id)
      .eq('updated_at', previousUpdatedAt)
      .select('id')
      .maybeSingle()
    if (!claimed) {
      results.push({ id, ok: false })
      continue
    }

    try {
      await processPost(id)
      results.push({ id, ok: true })
    } catch {
      results.push({ id, ok: false })
    }
  }

  return json({ processed: results.length, results })
})
