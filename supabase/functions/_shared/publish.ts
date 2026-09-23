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

function baseParams(token: string): Record<string, string> {
  return { access_token: token }
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
      ...(ctx.caption ? { caption: ctx.caption } : {}),
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
    ...(ctx.caption ? { caption: ctx.caption } : {}),
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
        ? { media_type: 'REELS', video_url: item.public_url }
        : { image_url: item.public_url }),
      ...(item.alt_text ? { alt_text: item.alt_text } : {}),
    })
    children.push(String(created.id))
  }

  const parent = await apiPost(base, `${ctx.igUserId}/media`, {
    ...params,
    media_type: 'CAROUSEL',
    children: children.join(','),
    ...(ctx.caption ? { caption: ctx.caption } : {}),
  })
  return String(parent.id)
}

export async function runPublish(ctx: PublishContext): Promise<PublishResult> {
  const base = graphBase(ctx.authPath)

  // Resume: a container was already created on a previous attempt.
  if (ctx.containerId) {
    const status = await containerStatus(base, ctx.containerId, ctx.accessToken)
    if (status === 'FINISHED') {
      const mediaId = await publishContainer(
        base,
        ctx.igUserId,
        ctx.containerId,
        ctx.accessToken,
      )
      return { done: true, containerId: ctx.containerId, mediaId }
    }
    if (status === 'IN_PROGRESS' || status === 'UNKNOWN') {
      return {
        done: false,
        containerId: ctx.containerId,
        note: 'Container ainda em processamento.',
      }
    }
    throw new Error(`Container invalido: ${status}`)
  }

  const containerId =
    ctx.kind === 'carousel'
      ? await createCarouselContainer(ctx)
      : await createSingleContainer(ctx)

  if (ctx.kind === 'story' || ctx.kind === 'image') {
    const mediaId = await publishContainer(
      base,
      ctx.igUserId,
      containerId,
      ctx.accessToken,
    )
    return { done: true, containerId, mediaId }
  }

  const status = await waitForContainer(base, containerId, ctx.accessToken)
  if (status === 'FINISHED') {
    const mediaId = await publishContainer(
      base,
      ctx.igUserId,
      containerId,
      ctx.accessToken,
    )
    return { done: true, containerId, mediaId }
  }
  if (status === 'ERROR' || status === 'EXPIRED') {
    throw new Error(`Processamento do video falhou: ${status}`)
  }
  return {
    done: false,
    containerId,
    note: 'Video ainda processando; o worker vai concluir.',
  }
}
