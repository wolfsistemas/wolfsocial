export type AuthPath = 'facebook' | 'instagram'

export type PostKind = 'image' | 'carousel' | 'reels' | 'story'

export interface PublishItem {
  public_url: string
  kind: 'image' | 'video'
  alt_text?: string | null
}

export interface PublishContext {
  postId: string
  tenantId: string
  kind: PostKind
  caption: string | null
  locationId: string | null
  collaborators: string[] | null
  shareToFeed: boolean
  coverUrl: string | null
  thumbOffsetMs: number | null
  authPath: AuthPath
  accessToken: string
  igUserId: string
  containerId: string | null
  items: PublishItem[]
}
