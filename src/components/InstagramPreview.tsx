import { useMemo } from 'react'
import { Bookmark, Heart, MessageCircle, Play, Send } from 'lucide-react'
import type { MediaAsset, PostKind } from '../lib/types'

const MIN_FEED_RATIO = 4 / 5
const MAX_FEED_RATIO = 1.91

function Avatar({ username, size = 8 }: { username: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-xs font-semibold text-white"
      style={{ width: size * 4, height: size * 4 }}
    >
      {username.slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function InstagramPreview({
  kind,
  caption,
  media,
  username,
}: {
  kind: PostKind
  caption: string
  media: MediaAsset[]
  username: string
}) {
  const first = media[0]
  const isStory = kind === 'story'
  const isReels = kind === 'reels'
  const isVertical = isStory || isReels

  // Stories and Reels are always full-screen 9:16. Feed images keep their own
  // aspect ratio, clamped to Instagram's allowed 4:5 - 1.91:1 window so the
  // preview matches what the app will actually show.
  const ratio = useMemo(() => {
    if (isVertical) return 9 / 16
    if (first?.width && first?.height) {
      return Math.min(MAX_FEED_RATIO, Math.max(MIN_FEED_RATIO, first.width / first.height))
    }
    return MIN_FEED_RATIO
  }, [isVertical, first?.width, first?.height])

  const mediaEl = first ? (
    first.kind === 'video' ? (
      <video
        src={first.public_url}
        className="h-full w-full object-cover"
        muted
        playsInline
      />
    ) : (
      <img src={first.public_url} alt="" className="h-full w-full object-cover" />
    )
  ) : (
    <p className="px-4 text-center text-xs text-slate-500">
      Selecione uma midia para ver a previa
    </p>
  )

  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-4 border-black bg-black shadow-xl">
      {isVertical ? (
        <div
          className="relative flex items-center justify-center overflow-hidden bg-[#0b0b0f]"
          style={{ aspectRatio: String(ratio) }}
        >
          {mediaEl}

          {isStory && first ? (
            <>
              <div className="absolute inset-x-0 top-0 space-y-2 p-3">
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/30">
                  <div className="h-full w-1/3 rounded-full bg-white" />
                </div>
                <div className="flex items-center gap-2">
                  <Avatar username={username} />
                  <span className="text-xs font-medium text-white">{username}</span>
                  <span className="text-[10px] text-white/60">agora</span>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="flex h-8 items-center rounded-full border border-white/50 px-3 text-xs text-white/70">
                  Enviar mensagem
                </div>
              </div>
            </>
          ) : null}

          {isReels && first ? (
            <>
              <Play
                size={40}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/85 drop-shadow"
                fill="currentColor"
              />
              <div className="absolute bottom-16 right-2 flex flex-col items-center gap-4 text-white">
                <Heart size={20} />
                <MessageCircle size={20} />
                <Send size={20} />
                <Bookmark size={20} />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="flex items-center gap-2">
                  <Avatar username={username} size={6} />
                  <span className="text-xs font-semibold text-white">{username}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-200">
                  {caption || 'Sem legenda'}
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar username={username} />
            <span className="text-xs font-medium text-white">{username}</span>
          </div>

          <div
            className="relative flex items-center justify-center overflow-hidden bg-[#0b0b0f]"
            style={{ aspectRatio: String(ratio) }}
          >
            {mediaEl}

            {kind === 'carousel' && media.length > 1 ? (
              <>
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                  1/{media.length}
                </span>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                  {media.slice(0, 8).map((m, i) => (
                    <span
                      key={m.id}
                      className={
                        'h-1.5 w-1.5 rounded-full ' +
                        (i === 0 ? 'bg-white' : 'bg-white/40')
                      }
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="px-3 py-2">
            <div className="mb-1.5 flex items-center gap-3 text-white">
              <Heart size={18} />
              <MessageCircle size={18} />
              <Send size={18} />
              <Bookmark size={18} className="ml-auto" />
            </div>
            <p className="text-[11px] text-slate-300">
              <span className="font-semibold text-white">{username}</span>{' '}
              <span className="line-clamp-3 whitespace-pre-wrap">
                {caption || 'Sem legenda'}
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
