import { graphBase, readError } from './meta.ts'
import type { PublishContext, PublishItem } from './types.ts'

interface PublishResult {
  done: boolean
  containerId: string
  mediaId?: string
  note?: string
}

async function apiPost(
  base: string,
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(readError(data))
  return data
}

async function apiGet(
  base: string,
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${base}/${path}?${new URLSearchParams(params)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(readError(data))
  return data
}

async function containerStatus(
  base: string,
  containerId: string,
  token: string,
): Promise<string> {
  const data = await apiGet(base, containerId, {
    fields: 'status_code,status',
    access_token: token,
  })
  return String(data.status_code ?? 'UNKNOWN')
}

async function waitForContainer(
  base: string,
  containerId: string,
  token: string,
  attempts = 5,
  delayMs = 7000,
): Promise<string> {
  let status = 'IN_PROGRESS'
  for (let i = 0; i < attempts; i += 1) {
    status = await containerStatus(base, containerId, token)
    if (status !== 'IN_PROGRESS' && status !== 'UNKNOWN') return status
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return status
}

async function publishContainer(
  base: string,
  igUserId: string,
  containerId: string,
  token: string,
): Promise<string> {
  const data = await apiPost(base, `${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: token,
  })
  return String(data.id)
}

function isNotReady(message: string): boolean {
  return (
    message.includes('9007') ||
    message.includes('2207027') ||
    message.includes('Media ID is not available')
  )
}

async function publishContainerSafe(
  base: string,
  igUserId: string,
  containerId: string,
  token: string,
): Promise<{ mediaId?: string; notReady: boolean }> {
  try {
    const mediaId = await publishContainer(base, igUserId, containerId, token)
    return { mediaId, notReady: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (isNotReady(message)) return { notReady: true }
    throw err
  }
}

function baseParams(token: string): Record<string, string> {
  return { access_token: token }
}

// Params shared by feed-style containers (image, carousel, reels).
function feedExtras(ctx: PublishContext): Record<string, string> {
  return {
    ...(ctx.caption ? { caption: ctx.caption } : {}),
    ...(ctx.locationId ? { location_id: ctx.locationId } : {}),
    ...(ctx.collaborators && ctx.collaborators.length
      ? { collaborators: JSON.stringify(ctx.collaborators) }
      : {}),
  }
}

async function createSingleContainer(
  ctx: PublishContext,
): Promise<string> {
  const base = graphBase(ctx.authPath)
  const params = baseParams(ctx.accessToken)
  const item = ctx.items[0]
  if (!item) throw new Error('Post sem midia.')

  if (ctx.kind === 'reels') {
    const created = await apiPost(base, `${ctx.igUserId}/media`, {
      ...params,
      media_type: 'REELS',
      video_url: item.public_url,
      share_to_feed: String(ctx.shareToFeed),
      ...feedExtras(ctx),
      ...(ctx.coverUrl ? { cover_url: ctx.coverUrl } : {}),
      ...(ctx.thumbOffsetMs ? { thumb_offset: String(ctx.thumbOffsetMs) } : {}),
    })
    return String(created.id)
  }

  if (ctx.kind === 'story') {
    const key = item.kind === 'video' ? 'video_url' : 'image_url'
    const created = await apiPost(base, `${ctx.igUserId}/media`, {
      ...params,
      media_type: 'STORIES',
      [key]: item.public_url,
    })
    return String(created.id)
  }

  // image feed
  const created = await apiPost(base, `${ctx.igUserId}/media`, {
    ...params,
    image_url: item.public_url,
    ...(item.alt_text ? { alt_text: item.alt_text } : {}),
    ...feedExtras(ctx),
  })
  return String(created.id)
}

async function createCarouselContainer(ctx: PublishContext): Promise<string> {
  const base = graphBase(ctx.authPath)
  const params = baseParams(ctx.accessToken)
  const children: string[] = []

  for (const item of ctx.items as PublishItem[]) {
    const created = await apiPost(base, `${ctx.igUserId}/media`, {
      ...params,
      is_carousel_item: 'true',
      ...(item.kind === 'video'
        ? { media_type: 'VIDEO', video_url: item.public_url }
        : { image_url: item.public_url }),
      ...(item.kind === 'image' && item.alt_text ? { alt_text: item.alt_text } : {}),
    })
    children.push(String(created.id))
  }

  const parent = await apiPost(base, `${ctx.igUserId}/media`, {
    ...params,
    media_type: 'CAROUSEL',
    children: children.join(','),
    ...feedExtras(ctx),
  })
  return String(parent.id)
}

export async function runPublish(ctx: PublishContext): Promise<PublishResult> {
  const base = graphBase(ctx.authPath)

  // Resume: a container was already created on a previous attempt.
  if (ctx.containerId) {
    const status = await containerStatus(base, ctx.containerId, ctx.accessToken)
    if (status === 'PUBLISHED') {
      return { done: true, containerId: ctx.containerId }
    }
    if (status === 'FINISHED') {
      const res = await publishContainerSafe(
        base,
        ctx.igUserId,
        ctx.containerId,
        ctx.accessToken,
      )
      if (res.mediaId) {
        return { done: true, containerId: ctx.containerId, mediaId: res.mediaId }
      }
      return {
        done: false,
        containerId: ctx.containerId,
        note: 'Container pronto; aguardando publicacao.',
      }
    }
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Container invalido: ${status}`)
    }
    return {
      done: false,
      containerId: ctx.containerId,
      note: 'Container ainda em processamento.',
    }
  }

  const containerId =
    ctx.kind === 'carousel'
      ? await createCarouselContainer(ctx)
      : await createSingleContainer(ctx)

  const status = await waitForContainer(base, containerId, ctx.accessToken)
  if (status === 'ERROR' || status === 'EXPIRED') {
    throw new Error(`Processamento da midia falhou: ${status}`)
  }

  // Image/Story containers are usually ready at once; try to publish even when
  // the status is still UNKNOWN, and fall back to the worker if not ready yet.
  if (status === 'FINISHED' || (ctx.kind !== 'reels' && ctx.kind !== 'carousel' && status === 'UNKNOWN')) {
    const res = await publishContainerSafe(
      base,
      ctx.igUserId,
      containerId,
      ctx.accessToken,
    )
    if (res.mediaId) {
      return { done: true, containerId, mediaId: res.mediaId }
    }
  }

  return {
    done: false,
    containerId,
    note: 'Midia ainda processando; o worker vai concluir.',
  }
}
