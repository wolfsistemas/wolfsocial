import { adminClient, log, notify } from './db.ts'
import { decryptToken } from './crypto.ts'
import { runPublish } from './publish.ts'
import type { PublishContext, PostKind } from './types.ts'

const MAX_ATTEMPTS = 3

interface ItemRow {
  position: number
  media_assets: {
    public_url: string
    kind: 'image' | 'video'
    alt_text?: string | null
  } | null
}

export async function processPost(postId: string): Promise<void> {
  const sb = adminClient()
  const { data: post, error } = await sb
    .from('posts')
    .select('*, post_items(position, media_assets(*)), social_accounts(*)')
    .eq('id', postId)
    .single()
  if (error || !post) return

  const account = post.social_accounts as Record<string, unknown> | null
  if (!account) {
    await fail(sb, post, 'Conta nao encontrada.')
    return
  }

  try {
    const accessToken = await decryptToken(account.access_token_enc as string)
    const items = ((post.post_items as ItemRow[]) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => row.media_assets)
      .filter((m): m is NonNullable<ItemRow['media_assets']> => Boolean(m))
      .map((m) => ({
        public_url: m.public_url,
        kind: m.kind,
        alt_text: m.alt_text ?? null,
      }))

    const ctx: PublishContext = {
      postId: post.id,
      tenantId: post.tenant_id,
      kind: post.kind as PostKind,
      caption: post.caption,
      locationId: (post.location_id as string | null) ?? null,
      collaborators: (post.collaborators as string[] | null) ?? null,
      shareToFeed: post.share_to_feed,
      coverUrl: post.cover_url,
      thumbOffsetMs: post.thumb_offset_ms,
      authPath: (account.auth_path as 'facebook' | 'instagram') ?? 'facebook',
      accessToken,
      igUserId: account.ig_user_id as string,
      containerId: post.ig_container_id,
      items,
    }

    await log(post.id, post.tenant_id, 'info', 'Iniciando publicacao.', {
      kind: post.kind,
      items: items.length,
    })

    const result = await runPublish(ctx)

    await sb
      .from('posts')
      .update({
        status: result.done ? 'published' : 'publishing',
        ig_container_id: result.containerId,
        ig_media_id: result.mediaId ?? post.ig_media_id,
        published_at: result.done ? new Date().toISOString() : null,
        last_error: null,
        attempts: post.attempts + (result.done ? 1 : 0),
      })
      .eq('id', post.id)

    await log(
      post.id,
      post.tenant_id,
      result.done ? 'info' : 'warn',
      result.done
        ? 'Publicado com sucesso.'
        : result.note ?? 'Aguardando processamento.',
      { mediaId: result.mediaId, containerId: result.containerId },
    )

    if (result.warning) {
      await log(post.id, post.tenant_id, 'warn', result.warning, {
        mediaId: result.mediaId,
        containerId: result.containerId,
      })
      await notify(
        post.tenant_id,
        'warn',
        'Post publicado com aviso',
        result.warning,
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await handleError(sb, post, message)
  }
}

async function handleError(
  sb: ReturnType<typeof adminClient>,
  post: Record<string, unknown>,
  message: string,
): Promise<void> {
  const attempts = Number(post.attempts ?? 0) + 1
  const terminal = message.includes('2207042')
  const failed = terminal || attempts >= MAX_ATTEMPTS
  const backoffMinutes = Math.min(attempts * 5, 30)

  await sb
    .from('posts')
    .update({
      status: failed ? 'failed' : 'scheduled',
      attempts,
      last_error: message,
      scheduled_at: failed
        ? post.scheduled_at
        : new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
    })
    .eq('id', post.id as string)

  await log(
    post.id as string,
    post.tenant_id as string,
    failed ? 'error' : 'warn',
    `Falha na publicacao: ${message}`,
    { attempts, backoffMinutes, terminal },
  )

  if (failed) {
    await notify(
      post.tenant_id as string,
      'error',
      'Falha ao publicar',
      `O post ${post.id} falhou apos ${attempts} tentativa(s): ${message}`,
    )
  }
}

async function fail(
  sb: ReturnType<typeof adminClient>,
  post: Record<string, unknown>,
  message: string,
): Promise<void> {
  await sb.from('posts').update({ status: 'failed', last_error: message }).eq(
    'id',
    post.id as string,
  )
  await log(post.id as string, post.tenant_id as string, 'error', message)
  await notify(post.tenant_id as string, 'error', 'Falha ao publicar', message)
}
