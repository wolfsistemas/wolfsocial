import { processPost } from '../_shared/process.ts'
import { getUserId, userClient } from '../_shared/db.ts'
import { handleOptions, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    const userId = await getUserId(req)
    if (!userId) return json({ error: 'Nao autenticado.' }, 401)

    const body = await req.json().catch(() => ({}))
    const postId = body.postId as string | undefined
    if (!postId) return json({ error: 'postId obrigatorio.' }, 400)

    // RLS: garante que o post pertence a um tenant do usuario.
    const sb = userClient(req)
    const { data: post } = await sb
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle()
    if (!post) return json({ error: 'Post nao encontrado.' }, 404)

    await processPost(postId)
    return json({ ok: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro' }, 500)
  }
})
