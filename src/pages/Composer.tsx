import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Send } from 'lucide-react'
import { Button, Card, EmptyState, ErrorText, Field, PageHeader, Select, Textarea } from '../components/ui'
import { createPost, invokeFunction, listAccounts, listMedia } from '../lib/api'
import { formatDateInput } from '../lib/format'
import { useSession } from '../lib/session'
import type { MediaAsset, PostKind, SocialAccount } from '../lib/types'

const kindRules: Record<PostKind, { min: number; max: number; media: 'image' | 'video' | 'any' }> = {
  image: { min: 1, max: 1, media: 'image' },
  carousel: { min: 2, max: 10, media: 'any' },
  reels: { min: 1, max: 1, media: 'video' },
  story: { min: 1, max: 1, media: 'any' },
}

const DEFAULT_SCHEDULE = formatDateInput(new Date(Date.now() + 3600_000))

export default function Composer() {
  const { tenant } = useSession()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [accountId, setAccountId] = useState('')
  const [kind, setKind] = useState<PostKind>('image')
  const [selected, setSelected] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [scheduledAt, setScheduledAt] = useState(DEFAULT_SCHEDULE)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!tenant) return
    let active = true
    Promise.all([listAccounts(tenant.id), listMedia(tenant.id)])
      .then(([acc, media]) => {
        if (!active) return
        setAccounts(acc)
        setAssets(media)
        if (acc[0]) setAccountId(acc[0].id)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [tenant])

  const rule = kindRules[kind]
  const eligible = useMemo(
    () =>
      assets.filter((a) =>
        rule.media === 'any' ? true : a.kind === rule.media,
      ),
    [assets, rule.media],
  )

  function toggle(assetId: string) {
    setSelected((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId)
      }
      if (current.length >= rule.max) return current
      return [...current, assetId]
    })
  }

  function changeKind(next: PostKind) {
    setKind(next)
    setSelected([])
  }

  function validate(): string | null {
    if (!accountId) return 'Conecte uma conta antes de agendar.'
    if (selected.length < rule.min || selected.length > rule.max) {
      return `Este formato exige de ${rule.min} a ${rule.max} midia(s).`
    }
    if (kind !== 'story' && !caption.trim()) {
      return 'Escreva uma legenda.'
    }
    return null
  }

  async function submit(now: boolean) {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    if (!tenant) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const post = await createPost({
        tenantId: tenant.id,
        accountId,
        kind,
        caption,
        mediaIds: selected,
        scheduledAt: now ? new Date().toISOString() : new Date(scheduledAt).toISOString(),
      })
      if (now) {
        await invokeFunction('publish-post', { postId: post.id })
        setNotice('Publicacao iniciada. Acompanhe na fila.')
      } else {
        setNotice('Post agendado com sucesso.')
      }
      setTimeout(() => navigate('/queue'), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar o post')
    } finally {
      setBusy(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Novo post" />
        <EmptyState
          title="Conecte uma conta primeiro"
          description="Va em Contas e vincule seu Instagram para publicar."
          action={
            <Button className="mt-3" onClick={() => navigate('/accounts')}>
              Ir para Contas
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Novo post"
        description="Monte o post, escolha as midias e agende."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-4">
          <Field label="Conta">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username ?? a.ig_user_id}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Formato">
            <Select value={kind} onChange={(e) => changeKind(e.target.value as PostKind)}>
              <option value="image">Imagem (feed)</option>
              <option value="carousel">Carrossel (2 a 10)</option>
              <option value="reels">Reels (video)</option>
              <option value="story">Story (limitado)</option>
            </Select>
          </Field>
          {kind !== 'story' ? (
            <Field
              label="Legenda"
              hint={kind === 'reels' ? 'Reels aceitam legenda normalmente.' : undefined}
            >
              <Textarea
                rows={5}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Texto do post..."
              />
            </Field>
          ) : (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Stories via API nao aceitam legenda, stickers, enquetes nem links.
            </p>
          )}
          <Field label="Agendar para">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#0d1119] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-500"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          {notice ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => void submit(false)}>
              <CalendarPlus size={16} />
              Agendar
            </Button>
            <Button disabled={busy} onClick={() => void submit(true)}>
              <Send size={16} />
              Publicar agora
            </Button>
          </div>
        </Card>

        <Card>
          <p className="mb-2 text-sm font-medium text-slate-200">
            Midias ({selected.length}/{rule.max})
          </p>
          {eligible.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma midia compativel. Envie em Midias.
            </p>
          ) : (
            <div className="grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto">
              {eligible.map((asset) => {
                const active = selected.includes(asset.id)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggle(asset.id)}
                    className={
                      'relative aspect-square overflow-hidden rounded-lg border-2 transition ' +
                      (active ? 'border-violet-500' : 'border-transparent opacity-80 hover:opacity-100')
                    }
                  >
                    {asset.kind === 'video' ? (
                      <video src={asset.public_url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={asset.public_url} alt="" className="h-full w-full object-cover" />
                    )}
                    {active ? (
                      <span className="absolute right-1 top-1 rounded bg-violet-600 px-1 text-[10px] text-white">
                        {selected.indexOf(asset.id) + 1}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
