import { requireSupabase } from './supabase'
import { randomId } from './format'
import type {
  AdAccount,
  AdCampaign,
  AppNotification,
  BioLink,
  CaptionTemplate,
  Invite,
  MediaAsset,
  MemberRole,
  Post,
  PostInsight,
  PostKind,
  PostStatus,
  PostWithItems,
  PublishLog,
  RobotDevice,
  SocialAccount,
  TeamMember,
  Tenant,
  WaOutboxMessage,
  WhatsappAccount,
  WhatsappMessage,
  WhatsappTemplate,
} from './types'

const TENANT_COLUMNS =
  'id, name, slug, timezone, alert_webhook_url, daily_publish_limit, created_at'

export async function listMyTenants(): Promise<Tenant[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('memberships')
    .select(`tenant_id, tenants:tenant_id(${TENANT_COLUMNS})`)
    .order('created_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{ tenants: Tenant | null }>
  return rows
    .map((row) => row.tenants)
    .filter((t): t is Tenant => Boolean(t))
}

export async function getMyTenant(): Promise<Tenant | null> {
  const tenants = await listMyTenants()
  return tenants[0] ?? null
}

export async function updateTenantSettings(
  tenantId: string,
  patch: Partial<Pick<Tenant, 'name' | 'timezone' | 'alert_webhook_url' | 'daily_publish_limit'>>,
): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('tenants').update(patch).eq('id', tenantId)
  if (error) throw error
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

export async function disconnectAccount(id: string): Promise<void> {
  const sb = requireSupabase()
  // access_token_enc is NOT NULL and status only accepts connected/expired/
  // revoked/error, so we revoke instead of nulling the token.
  const { error } = await sb
    .from('social_accounts')
    .update({ status: 'revoked', last_error: null })
    .eq('id', id)
  if (error) throw error
}

export async function removeAccount(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('social_accounts').delete().eq('id', id)
  if (error) throw error
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

// Instagram's content publishing API only accepts JPEG images, so we normalise
// client-side: resize to at most 1440px on the long edge and re-encode.
async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const maxEdge = 1440
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const needsResize = scale < 1
    const needsConvert = file.type !== 'image/jpeg'
    if (!needsResize && !needsConvert && file.size <= 1_500_000) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    // Non-JPEG formats must always become JPEG, even if slightly larger,
    // because the Instagram publishing API only accepts JPEG images.
    if (!blob) return file
    if (!needsConvert && blob.size >= file.size && !needsResize) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
    })
  } catch {
    return file
  }
}

export function validateMediaFile(file: File): string | null {
  if (file.type.startsWith('image/')) {
    if (file.type === 'image/gif') return 'GIF nao e suportado pelo Instagram.'
    if (file.size > MAX_IMAGE_BYTES) return 'Imagem acima de 8 MB.'
    return null
  }
  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_BYTES) return 'Video acima de 100 MB.'
    return null
  }
  return 'Formato nao suportado. Envie imagem ou video.'
}

export async function uploadMedia(
  tenantId: string,
  file: File,
): Promise<MediaAsset> {
  const problem = validateMediaFile(file)
  if (problem) throw new Error(problem)
  const sb = requireSupabase()
  const prepared = file.type.startsWith('image/') ? await optimizeImage(file) : file
  const ext = prepared.name.includes('.') ? prepared.name.split('.').pop() : 'bin'
  const path = `${tenantId}/${randomId()}.${ext}`
  const { error: upErr } = await sb.storage
    .from('media')
    .upload(path, prepared, { contentType: prepared.type, upsert: false })
  if (upErr) throw upErr

  const { data: pub } = sb.storage.from('media').getPublicUrl(path)
  const probe = await probeMedia(prepared)

  const { data, error } = await sb
    .from('media_assets')
    .insert({
      tenant_id: tenantId,
      storage_path: path,
      public_url: pub.publicUrl,
      kind: probe.kind ?? 'image',
      mime_type: prepared.type,
      size_bytes: prepared.size,
      width: probe.width ?? null,
      height: probe.height ?? null,
      duration_seconds: probe.duration_seconds ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as MediaAsset
}

export interface ListPostsOptions {
  status?: PostStatus | 'all'
  accountId?: string
  limit?: number
  offset?: number
  ascending?: boolean
}

export async function listPosts(
  tenantId: string,
  options: ListPostsOptions = {},
): Promise<PostWithItems[]> {
  const sb = requireSupabase()
  const from = options.offset ?? 0
  const to = from + (options.limit ?? 1000) - 1
  let query = sb
    .from('posts')
    .select('*, post_items(*)')
    .eq('tenant_id', tenantId)
    .order('scheduled_at', { ascending: options.ascending ?? true })
    .range(from, to)
  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status)
  }
  if (options.accountId) {
    query = query.eq('account_id', options.accountId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PostWithItems[]
}

export async function getPost(postId: string): Promise<PostWithItems | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('posts')
    .select('*, post_items(*)')
    .eq('id', postId)
    .maybeSingle()
  if (error) throw error
  return (data as PostWithItems) ?? null
}

export interface CreatePostInput {
  tenantId: string
  accountId: string
  kind: PostKind
  caption: string
  mediaIds: string[]
  scheduledAt: string
  status?: PostStatus
  altTexts?: string[]
  shareToFeed?: boolean
  coverUrl?: string | null
  thumbOffsetMs?: number | null
  collaborators?: string[] | null
  locationId?: string | null
}

function postColumns(input: CreatePostInput) {
  return {
    tenant_id: input.tenantId,
    account_id: input.accountId,
    kind: input.kind,
    caption: input.caption || null,
    scheduled_at: input.scheduledAt,
    status: input.status ?? 'scheduled',
    idempotency_key: randomId(),
    share_to_feed: input.shareToFeed ?? true,
    cover_url: input.coverUrl ?? null,
    thumb_offset_ms: input.thumbOffsetMs ?? null,
    collaborators: input.collaborators?.length ? input.collaborators : null,
    location_id: input.locationId || null,
  }
}

function postItemRows(postId: string, input: CreatePostInput) {
  return input.mediaIds.map((assetId, index) => ({
    post_id: postId,
    media_asset_id: assetId,
    position: index,
    alt_text: input.altTexts?.[index]?.trim() || null,
  }))
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const sb = requireSupabase()
  const { data: post, error } = await sb
    .from('posts')
    .insert(postColumns(input))
    .select('*')
    .single()
  if (error) throw error

  const { error: itemErr } = await sb
    .from('post_items')
    .insert(postItemRows(post.id, input))
  if (itemErr) throw itemErr
  return post as Post
}

export async function updatePost(
  postId: string,
  input: CreatePostInput,
): Promise<Post> {
  const sb = requireSupabase()
  const { data: post, error } = await sb
    .from('posts')
    .update({
      account_id: input.accountId,
      kind: input.kind,
      caption: input.caption || null,
      scheduled_at: input.scheduledAt,
      status: input.status ?? 'scheduled',
      share_to_feed: input.shareToFeed ?? true,
      cover_url: input.coverUrl ?? null,
      thumb_offset_ms: input.thumbOffsetMs ?? null,
      collaborators: input.collaborators?.length ? input.collaborators : null,
      location_id: input.locationId || null,
      attempts: 0,
      last_error: null,
    })
    .eq('id', postId)
    .select('*')
    .single()
  if (error) throw error

  const { error: delErr } = await sb
    .from('post_items')
    .delete()
    .eq('post_id', postId)
  if (delErr) throw delErr
  const { error: itemErr } = await sb
    .from('post_items')
    .insert(postItemRows(postId, input))
  if (itemErr) throw itemErr
  return post as Post
}

export async function duplicatePost(post: PostWithItems): Promise<Post> {
  return createPost({
    tenantId: post.tenant_id,
    accountId: post.account_id,
    kind: post.kind,
    caption: post.caption ?? '',
    mediaIds: post.post_items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.media_asset_id),
    altTexts: post.post_items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.alt_text ?? ''),
    scheduledAt: post.scheduled_at,
    status: 'draft',
    shareToFeed: post.share_to_feed,
    coverUrl: post.cover_url,
    thumbOffsetMs: post.thumb_offset_ms,
    collaborators: post.collaborators,
    locationId: post.location_id,
  })
}

export async function reschedulePost(
  postId: string,
  scheduledAt: string,
): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('posts')
    .update({ scheduled_at: scheduledAt, status: 'scheduled', last_error: null, attempts: 0 })
    .eq('id', postId)
  if (error) throw error
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
  if (error) {
    let message = error.message
    const res = (error as { context?: Response }).context
    if (res && typeof res.json === 'function') {
      try {
        const parsed = (await res.clone().json()) as { error?: string }
        if (parsed && typeof parsed.error === 'string') message = parsed.error
      } catch {
        // mantem a mensagem generica
      }
    }
    throw new Error(message)
  }
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

// ---------------------------------------------------------------------------
// Caption templates
// ---------------------------------------------------------------------------
export async function listCaptionTemplates(
  tenantId: string,
): Promise<CaptionTemplate[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('caption_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CaptionTemplate[]
}

export async function createCaptionTemplate(input: {
  tenantId: string
  name: string
  body: string
  hashtags: string
  kind?: PostKind | null
}): Promise<CaptionTemplate> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('caption_templates')
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      body: input.body,
      hashtags: input.hashtags,
      kind: input.kind ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CaptionTemplate
}

export async function deleteCaptionTemplate(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('caption_templates').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function listNotifications(
  tenantId: string,
): Promise<AppNotification[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(tenantId: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('notifications')
    .update({ read: true })
    .eq('tenant_id', tenantId)
    .eq('read', false)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------
export async function listInsights(tenantId: string): Promise<PostInsight[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('post_insights')
    .select('*')
    .eq('tenant_id', tenantId)
  if (error) throw error
  return (data ?? []) as PostInsight[]
}

export async function listPublishedSince(
  tenantId: string,
  sinceIso: string,
): Promise<PostWithItems[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('posts')
    .select('*, post_items(*)')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .gte('published_at', sinceIso)
    .order('published_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PostWithItems[]
}

// ---------------------------------------------------------------------------
// Link in bio
// ---------------------------------------------------------------------------
export async function listBioLinks(tenantId: string): Promise<BioLink[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('bio_links')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as BioLink[]
}

export async function createBioLink(input: {
  tenantId: string
  label: string
  url: string
  position: number
}): Promise<BioLink> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('bio_links')
    .insert({
      tenant_id: input.tenantId,
      label: input.label,
      url: input.url,
      position: input.position,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as BioLink
}

export async function updateBioLink(
  id: string,
  patch: Partial<Pick<BioLink, 'label' | 'url' | 'position'>>,
): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('bio_links').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteBioLink(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('bio_links').delete().eq('id', id)
  if (error) throw error
}

export interface PublicBio {
  tenant_name: string
  links: Array<{ id: string; label: string; url: string; position: number }>
}

export async function getPublicBio(slug: string): Promise<PublicBio | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('get_public_bio', { p_slug: slug })
  if (error) throw error
  const row = (data as PublicBio[] | null)?.[0]
  return row ?? null
}

export async function trackBioClick(linkId: string): Promise<void> {
  const sb = requireSupabase()
  await sb.rpc('increment_bio_click', { p_link: linkId })
}

// ---------------------------------------------------------------------------
// Team and invites
// ---------------------------------------------------------------------------
export async function listTeamMembers(tenantId: string): Promise<TeamMember[]> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('list_tenant_members', {
    p_tenant: tenantId,
  })
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

export async function myRole(tenantId: string): Promise<MemberRole | null> {
  const sb = requireSupabase()
  const { data: userData } = await sb.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return null
  const { data, error } = await sb
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return (data?.role as MemberRole) ?? null
}

export async function listInvites(tenantId: string): Promise<Invite[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('invites')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Invite[]
}

export async function createInvite(input: {
  tenantId: string
  email: string
  role: MemberRole
}): Promise<Invite> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('invites')
    .insert({
      tenant_id: input.tenantId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Invite
}

export async function revokeInvite(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function acceptInvite(token: string): Promise<string> {
  const sb = requireSupabase()
  const { data, error } = await sb.rpc('accept_invite', { invite_token: token })
  if (error) throw error
  return data as string
}

const WHATSAPP_ACCOUNT_COLUMNS =
  'id, tenant_id, waba_id, phone_number_id, display_phone, verified_name, status, notify_enabled, alert_phone, last_error, created_at, updated_at'

export async function listWhatsappAccounts(
  tenantId: string,
): Promise<WhatsappAccount[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('whatsapp_accounts')
    .select(WHATSAPP_ACCOUNT_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WhatsappAccount[]
}

export async function removeWhatsappAccount(
  tenantId: string,
  accountId: string,
): Promise<void> {
  await invokeFunction('whatsapp-connect', {
    tenantId,
    accountId,
    action: 'remove',
  })
}

export async function listWhatsappMessages(
  tenantId: string,
  limit = 50,
): Promise<WhatsappMessage[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('whatsapp_messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as WhatsappMessage[]
}

export async function listWhatsappTemplates(
  tenantId: string,
): Promise<WhatsappTemplate[]> {
  const data = await invokeFunction<{ templates: WhatsappTemplate[] }>(
    'whatsapp-templates',
    { tenantId },
  )
  return data?.templates ?? []
}

// ---------------------------------------------------------------------------
// Local robot (WhatsApp Web) bridge - pull-only queue
// ---------------------------------------------------------------------------
export async function listRobotDevices(tenantId: string): Promise<RobotDevice[]> {
  const data = await invokeFunction<{ devices: RobotDevice[] }>('robot-device', {
    tenantId,
    action: 'list',
  })
  return data?.devices ?? []
}

export async function createRobotDevice(
  tenantId: string,
  name: string,
): Promise<{ device: RobotDevice; token: string }> {
  return invokeFunction<{ device: RobotDevice; token: string }>('robot-device', {
    tenantId,
    action: 'create',
    name,
  })
}

export async function rotateRobotDevice(
  tenantId: string,
  deviceId: string,
): Promise<string> {
  const data = await invokeFunction<{ token: string }>('robot-device', {
    tenantId,
    action: 'rotate',
    deviceId,
  })
  return data.token
}

export async function removeRobotDevice(
  tenantId: string,
  deviceId: string,
): Promise<void> {
  await invokeFunction('robot-device', { tenantId, action: 'remove', deviceId })
}

export async function updateRobotNotify(
  tenantId: string,
  alertPhone: string,
  notifyEnabled: boolean,
): Promise<void> {
  await invokeFunction('robot-device', {
    tenantId,
    action: 'settings',
    alertPhone,
    notifyEnabled,
  })
}

export async function listOutbox(
  tenantId: string,
  limit = 50,
): Promise<WaOutboxMessage[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('wa_outbox')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as WaOutboxMessage[]
}

export async function enqueueOutbox(input: {
  tenantId: string
  to: string
  body: string
  mediaUrl?: string | null
  deviceId?: string | null
}): Promise<void> {
  const sb = requireSupabase()
  const to = input.to.replace(/\D/g, '')
  const { error } = await sb.from('wa_outbox').insert({
    tenant_id: input.tenantId,
    to_phone: to,
    body: input.body,
    kind: input.mediaUrl ? 'media' : 'text',
    media_url: input.mediaUrl ?? null,
    device_id: input.deviceId ?? null,
  })
  if (error) throw error
}

export async function cancelOutbox(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('wa_outbox')
    .update({ status: 'canceled' })
    .eq('id', id)
  if (error) throw error
}
