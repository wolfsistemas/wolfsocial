import { Bookmark, Heart, MessageCircle, Play, Send } from 'lucide-react'
import type { MediaAsset, PostKind } from '../lib/types'

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

  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2rem] border-4 border-black bg-black shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-xs font-semibold text-white">
          {username.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-xs font-medium text-white">{username}</span>
        {isStory ? (
          <span className="ml-auto text-[10px] text-slate-400">Story</span>
        ) : null}
      </div>

      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-[#0b0b0f]">
        {!first ? (
          <p className="px-4 text-center text-xs text-slate-500">
            Selecione uma midia para ver a previa
          </p>
        ) : first.kind === 'video' ? (
          <video
            src={first.public_url}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <img
            src={first.public_url}
            alt=""
            className="h-full w-full object-cover"
          />
        )}

        {isReels && first ? (
          <Play
            size={40}
            className="absolute text-white/85 drop-shadow"
            fill="currentColor"
          />
        ) : null}

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

      {!isStory ? (
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
      ) : null}
    </div>
  )
}
