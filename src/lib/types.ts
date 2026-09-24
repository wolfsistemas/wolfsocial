export type PostKind = 'image' | 'carousel' | 'reels' | 'story'
export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'canceled'
export type MediaKind = 'image' | 'video'
export type AuthPath = 'facebook' | 'instagram'
export type AccountStatus = 'connected' | 'expired' | 'revoked' | 'error'

export interface Tenant {
  id: string
  name: string
  slug: string
  timezone: string
  alert_webhook_url: string | null
  daily_publish_limit: number
  created_at: string
}

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface CaptionTemplate {
  id: string
  tenant_id: string
  name: string
  body: string
  hashtags: string
  kind: PostKind | null
  created_at: string
}

export interface AppNotification {
  id: string
  tenant_id: string
  level: 'info' | 'warn' | 'error'
  title: string
  message: string | null
  read: boolean
  created_at: string
}

export interface PostInsight {
  post_id: string
  tenant_id: string
  impressions: number | null
  reach: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
  fetched_at: string
}

export interface BioLink {
  id: string
  tenant_id: string
  label: string
  url: string
  position: number
  clicks: number
  created_at: string
}

export interface Invite {
  id: string
  tenant_id: string
  email: string
  role: MemberRole
  token: string
  revoked_at: string | null
  accepted_at: string | null
  created_at: string
}

export interface TeamMember {
  user_id: string
  email: string
  role: MemberRole
  created_at: string
}

export interface SocialAccount {
  id: string
  tenant_id: string
  platform: string
  auth_path: AuthPath
  ig_user_id: string
  username: string | null
  account_type: string | null
  fb_page_id: string | null
  token_expires_at: string | null
  scopes: string[] | null
  status: AccountStatus
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface MediaAsset {
  id: string
  tenant_id: string
  storage_path: string
  public_url: string
  kind: MediaKind
  mime_type: string | null
  size_bytes: number | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  created_at: string
}

export interface PostItem {
  id: string
  post_id: string
  media_asset_id: string
  position: number
  alt_text: string | null
}

export interface Post {
  id: string
  tenant_id: string
  account_id: string
  kind: PostKind
  caption: string | null
  location_id: string | null
  collaborators: string[] | null
  share_to_feed: boolean
  cover_url: string | null
  thumb_offset_ms: number | null
  scheduled_at: string
  status: PostStatus
  ig_media_id: string | null
  ig_container_id: string | null
  attempts: number
  last_error: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface PostWithItems extends Post {
  post_items: PostItem[]
}

export interface PublishLog {
  id: number
  post_id: string
  level: string
  message: string
  payload: unknown
  created_at: string
}

export interface AdAccount {
  id: string
  tenant_id: string
  meta_ad_account_id: string
  name: string | null
  status: string
  created_at: string
}

export interface AdCampaign {
  id: string
  tenant_id: string
  ad_account_id: string
  name: string
  objective: string | null
  status: string
  daily_budget_cents: number | null
  created_at: string
}

export type WhatsappStatus = 'connected' | 'error' | 'revoked'

export interface WhatsappAccount {
  id: string
  tenant_id: string
  waba_id: string | null
  phone_number_id: string
  display_phone: string | null
  verified_name: string | null
  status: WhatsappStatus
  notify_enabled: boolean
  alert_phone: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface WhatsappMessage {
  id: string
  tenant_id: string
  account_id: string | null
  meta_message_id: string | null
  direction: 'in' | 'out'
  wa_from: string | null
  wa_to: string | null
  kind: string
  body: string | null
  status: string | null
  error: string | null
  created_at: string
}

export interface WhatsappTemplate {
  name: string
  status: string
  language: string
  category?: string
}

export interface RobotDevice {
  id: string
  tenant_id: string
  name: string
  status: 'active' | 'disabled'
  last_seen_at: string | null
  last_error: string | null
  alert_phone: string | null
  notify_enabled: boolean
  created_at: string
  updated_at: string
}

export type WaOutboxStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'canceled'

export interface WaOutboxMessage {
  id: string
  tenant_id: string
  device_id: string | null
  to_phone: string
  body: string | null
  kind: 'text' | 'media'
  media_url: string | null
  status: WaOutboxStatus
  attempts: number
  max_attempts: number
  last_error: string | null
  scheduled_at: string
  claimed_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}
