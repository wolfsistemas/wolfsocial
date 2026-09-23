import { requireSupabase } from './supabase'
import type {
  AdAccount,
  AdCampaign,
  MediaAsset,
  Post,
  PostKind,
  PostStatus,
  PostWithItems,
  PublishLog,
  SocialAccount,
  Tenant,
} from './types'

export async function getMyTenant(): Promise<Tenant | null> {
  const sb = requireSupabase()
  const { data: memberships, error: mErr } = await sb
    .from('memberships')
    .select('tenant_id, tenants:tenant_id(id, name, slug, created_at)')
    .limit(1)
  if (mErr) throw mErr
  const first = memberships?.[0] as unknown as { tenants: Tenant | null } | undefined
  return first?.tenants ?? null
}

export async function listAccounts(tenantId: string): Promise<SocialAccount[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('social_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SocialAccount[]
}

export async function listMedia(tenantId: string): Promise<MediaAsset[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('media_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as MediaAsset[]
}

async function probeMedia(file: File): Promise<Partial<MediaAsset>> {
  const kind = file.type.startsWith('video') ? 'video' : 'image'
  if (kind === 'image') {
    try {
      const bitmap = await createImageBitmap(file)
      const dims = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return { kind, ...dims }
    } catch {
      return { kind }
    }
  }
  try {
    const url = URL.createObjectURL(file)
    const duration = await new Promise<number>((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(Number.isFinite(video.duration) ? video.duration : 0)
        URL.revokeObjectURL(url)
      }
      video.onerror = () => {
        resolve(0)
        URL.revokeObjectURL(url)
      }
      video.src = url
    })
    return { kind, duration_seconds: duration || null }
  } catch {
    return { kind }
  }
}

export async function uploadMedia(
  tenantId: string,
  file: File,
): Promise<MediaAsset> {
  const sb = requireSupabase()
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const path = `${tenantId}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await sb.storage
    .from('media')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) throw upErr

  const { data: pub } = sb.storage.from('media').getPublicUrl(path)
  const probe = await probeMedia(file)

  const { data, error } = await sb
    .from('media_assets')
    .insert({
      tenant_id: tenantId,
      storage_path: path,
      public_url: pub.publicUrl,
      kind: probe.kind ?? 'image',
      mime_type: file.type,
      size_bytes: file.size,
      width: probe.width ?? null,
      height: probe.height ?? null,
      duration_seconds: probe.duration_seconds ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as MediaAsset
}

export async function listPosts(tenantId: string): Promise<PostWithItems[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('posts')
    .select('*, post_items(*)')
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PostWithItems[]
}

export interface CreatePostInput {
  tenantId: string
  accountId: string
  kind: PostKind
  caption: string
  mediaIds: string[]
  scheduledAt: string
  altTexts?: string[]
  shareToFeed?: boolean
  coverUrl?: string | null
  thumbOffsetMs?: number | null
  collaborators?: string[] | null
  locationId?: string | null
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const sb = requireSupabase()
  const { data: post, error } = await sb
    .from('posts')
    .insert({
      tenant_id: input.tenantId,
      account_id: input.accountId,
      kind: input.kind,
      caption: input.caption || null,
      scheduled_at: input.scheduledAt,
      status: 'scheduled',
      idempotency_key: crypto.randomUUID(),
      share_to_feed: input.shareToFeed ?? true,
      cover_url: input.coverUrl ?? null,
      thumb_offset_ms: input.thumbOffsetMs ?? null,
      collaborators: input.collaborators?.length ? input.collaborators : null,
      location_id: input.locationId || null,
    })
    .select('*')
    .single()
  if (error) throw error

  const items = input.mediaIds.map((assetId, index) => ({
    post_id: post.id,
    media_asset_id: assetId,
    position: index,
    alt_text: input.altTexts?.[index]?.trim() || null,
  }))
  const { error: itemErr } = await sb.from('post_items').insert(items)
  if (itemErr) throw itemErr
  return post as Post
}

export async function setPostStatus(
  postId: string,
  status: PostStatus,
): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('posts').update({ status }).eq('id', postId)
  if (error) throw error
}

export async function retryPost(postId: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('posts')
    .update({
      status: 'scheduled',
      attempts: 0,
      last_error: null,
      scheduled_at: new Date().toISOString(),
    })
    .eq('id', postId)
  if (error) throw error
}

export async function listLogs(postId: string): Promise<PublishLog[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('publish_logs')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as PublishLog[]
}

export async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const sb = requireSupabase()
  const { data, error } = await sb.functions.invoke(name, { body })
  if (error) throw error
  return data as T
}

export async function startInstagramConnect(
  authPath: 'facebook' | 'instagram',
): Promise<string> {
  const data = await invokeFunction<{ url: string }>('meta-oauth-start', {
    authPath,
  })
  if (!data?.url) throw new Error('Nao foi possivel iniciar a conexao.')
  return data.url
}

export async function listAdAccounts(tenantId: string): Promise<AdAccount[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('ad_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdAccount[]
}

export async function listAdCampaigns(tenantId: string): Promise<AdCampaign[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('ad_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdCampaign[]
}
