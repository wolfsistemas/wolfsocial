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

  const { data: due } = await sb
    .from('posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date(now).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5)

  const staleCutoff = new Date(now - 2 * 60_000).toISOString()
  const { data: resumable } = await sb
    .from('posts')
    .select('id')
    .eq('status', 'publishing')
    .not('ig_container_id', 'is', null)
    .lt('updated_at', staleCutoff)
    .limit(5)

  const ids = [
    ...new Set([
      ...(due ?? []).map((p) => p.id as string),
      ...(resumable ?? []).map((p) => p.id as string),
    ]),
  ]

  const results: Array<{ id: string; ok: boolean }> = []
  for (const id of ids) {
    try {
      await processPost(id)
      results.push({ id, ok: true })
    } catch {
      results.push({ id, ok: false })
    }
  }

  return json({ processed: results.length, results })
})
