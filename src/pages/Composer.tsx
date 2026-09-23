import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Copy,
  Crop,
  FileText,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui'
import InstagramPreview from '../components/InstagramPreview'
import ImageResizer from '../components/ImageResizer'
import {
  createCaptionTemplate,
  createPost,
  deleteCaptionTemplate,
  getPost,
  invokeFunction,
  listAccounts,
  listCaptionTemplates,
  listMedia,
  updatePost,
  uploadMedia,
} from '../lib/api'
import {
  countHashtags,
  isoToZonedInput,
  zonedToIso,
} from '../lib/format'
import { useSession } from '../lib/session'
import type {
  CaptionTemplate,
  MediaAsset,
  PostKind,
  SocialAccount,
} from '../lib/types'

const kindRules: Record<
  PostKind,
  { min: number; max: number; media: 'image' | 'video' | 'any'; caption: boolean }
> = {
  image: { min: 1, max: 1, media: 'image', caption: true },
  carousel: { min: 2, max: 10, media: 'any', caption: true },
  reels: { min: 1, max: 1, media: 'video', caption: true },
  story: { min: 1, max: 1, media: 'any', caption: false },
}

const KIND_HINT: Record<PostKind, string> = {
  image: 'Feed de imagem. Use JPEG; o Instagram recorta para ate 4:5.',
  carousel: 'De 2 a 10 itens. A primeira midia e a capa; use as setas para ordenar.',
  reels: 'Video vertical 9:16 (MP4). Aceita capa, segundo da capa e legenda.',
  story: 'Story some em 24h. Nao aceita legenda, stickers, enquetes nem links.',
}

function buildUtm(
  base: string,
  source: string,
  medium: string,
  campaign: string,
): string {
  if (!base) return ''
  try {
    const url = new URL(base.startsWith('http') ? base : `https://${base}`)
    if (source) url.searchParams.set('utm_source', source)
    if (medium) url.searchParams.set('utm_medium', medium)
    if (campaign) url.searchParams.set('utm_campaign', campaign)
    return url.toString()
  } catch {
    return ''
  }
}

export default function Composer() {
  const { tenant } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editId = params.get('edit')

  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [templates, setTemplates] = useState<CaptionTemplate[]>([])
  const [accountId, setAccountId] = useState('')
  const [kind, setKind] = useState<PostKind>('image')
  const [selected, setSelected] = useState<string[]>([])
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [altMap, setAltMap] = useState<Record<string, string>>({})
  const [collaborators, setCollaborators] = useState('')
  const [shareToFeed, setShareToFeed] = useState(true)
  const [coverAssetId, setCoverAssetId] = useState('')
  const [thumbOffsetSec, setThumbOffsetSec] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [utmBase, setUtmBase] = useState('https://wolfsaas.com.br')
  const [utmSource, setUtmSource] = useState('instagram')
  const [utmMedium, setUtmMedium] = useState('social')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [resizeTarget, setResizeTarget] = useState<MediaAsset | null>(null)

  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'

  useEffect(() => {
    if (!tenant) return
    let active = true
    Promise.all([
      listAccounts(tenant.id),
      listMedia(tenant.id),
      listCaptionTemplates(tenant.id),
    ])
      .then(async ([accAll, media, tpl]) => {
        if (!active) return
        const acc = accAll.filter((a) => a.status === 'connected')
        setAccounts(acc)
        setAssets(media)
        setTemplates(tpl)
        if (!editId) {
          const preferred =
            acc.find((a) => a.auth_path === 'instagram') ?? acc[0]
          if (preferred) setAccountId(preferred.id)
        }
        if (!editId) {
          setScheduledAt(
            isoToZonedInput(new Date(Date.now() + 3600_000).toISOString(), timezone),
          )
        }
        if (editId) {
          const post = await getPost(editId)
          if (!post || !active) return
          setAccountId(post.account_id)
          setKind(post.kind)
          setCaption(post.caption ?? '')
          setAltMap(
            Object.fromEntries(
              post.post_items.map((i) => [i.media_asset_id, i.alt_text ?? '']),
            ),
          )
          setSelected(
            post.post_items
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((i) => i.media_asset_id),
          )
          setCollaborators((post.collaborators ?? []).join(', '))
          setShareToFeed(post.share_to_feed)
          setThumbOffsetSec(
            post.thumb_offset_ms ? String(post.thumb_offset_ms / 1000) : '',
          )
          const cover = media.find((m) => m.public_url === post.cover_url)
          if (cover) setCoverAssetId(cover.id)
          setScheduledAt(isoToZonedInput(post.scheduled_at, timezone))
        }
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, editId])

  const rule = kindRules[kind]
  const eligible = useMemo(
    () => assets.filter((a) => (rule.media === 'any' ? true : a.kind === rule.media)),
    [assets, rule.media],
  )
  const imageAssets = useMemo(() => assets.filter((a) => a.kind === 'image'), [assets])

  const fullCaption = [caption.trim(), hashtags.trim()].filter(Boolean).join('\n\n')
  const hashtagCount = countHashtags(fullCaption)
  const selectedAssets = useMemo(
    () =>
      selected
        .map((id) => assets.find((a) => a.id === id))
        .filter((a): a is MediaAsset => Boolean(a)),
    [selected, assets],
  )
  const utmPreview = buildUtm(utmBase, utmSource, utmMedium, utmCampaign)
  const accountHandle = accounts.find((a) => a.id === accountId)?.username ?? 'wolfsaas'

  function toggle(assetId: string) {
    setSelected((current) => {
      if (current.includes(assetId)) return current.filter((id) => id !== assetId)
      if (current.length >= rule.max) return current
      return [...current, assetId]
    })
  }

  function move(index: number, dir: -1 | 1) {
    setSelected((current) => {
      const target = index + dir
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function changeKind(next: PostKind) {
    setKind(next)
    setSelected([])
    setCoverAssetId('')
    setThumbOffsetSec('')
  }

  async function applyCrop(file: File, presetLabel: string) {
    if (!tenant) return
    const asset = await uploadMedia(tenant.id, file)
    setAssets((prev) => [asset, ...prev])
    if (kind === 'reels') {
      setCoverAssetId(asset.id)
    } else if (rule.max === 1) {
      setSelected([asset.id])
    } else {
      setSelected((current) =>
        current.length >= rule.max ? current : [...current, asset.id],
      )
    }
    setResizeTarget(null)
    setError('')
    setNotice(`Recorte ${presetLabel} aplicado e midia adicionada.`)
  }

  function parseCollaborators(): string[] {
    return collaborators
      .split(',')
      .map((s) => s.trim().replace(/^@/, ''))
      .filter(Boolean)
  }

  function applyTemplate(id: string) {
    setSelectedTemplate(id)
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setCaption(tpl.body)
    setHashtags(tpl.hashtags)
    if (tpl.kind) setKind(tpl.kind)
  }

  async function saveTemplate() {
    setNotice('')
    if (!tenant || !templateName.trim()) {
      setError('Dê um nome para o template.')
      return
    }
    setError('')
    try {
      await createCaptionTemplate({
        tenantId: tenant.id,
        name: templateName.trim(),
        body: caption,
        hashtags,
        kind,
      })
      setTemplateName('')
      setTemplates(await listCaptionTemplates(tenant.id))
      setNotice('Template salvo.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar template')
    }
  }

  async function removeTemplate(id: string) {
    try {
      await deleteCaptionTemplate(id)
      if (selectedTemplate === id) setSelectedTemplate('')
      if (tenant) setTemplates(await listCaptionTemplates(tenant.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover template')
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice('Link UTM copiado.')
    } catch {
      setError('Nao foi possivel copiar.')
    }
  }

  function validate(): string | null {
    if (!accountId) return 'Conecte uma conta antes de agendar.'
    if (selected.length < rule.min || selected.length > rule.max) {
      return `Este formato exige de ${rule.min} a ${rule.max} midia(s).`
    }
    if (rule.caption && !caption.trim()) return 'Escreva uma legenda.'
    if (kind === 'reels' && thumbOffsetSec) {
      const value = Number(thumbOffsetSec)
      if (Number.isNaN(value) || value < 0) return 'Segundo da capa invalido.'
    }
    return null
  }

  async function submit(mode: 'schedule' | 'now' | 'draft') {
    const problem = mode === 'draft' ? null : validate()
    if (problem) {
      setError(problem)
      return
    }
    if (!tenant) return
    if (mode === 'draft' && selected.length === 0) {
      setError('Selecione ao menos uma midia.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const coverAsset = assets.find((a) => a.id === coverAssetId)
      const offset = thumbOffsetSec ? Math.round(Number(thumbOffsetSec) * 1000) : null
      const scheduledIso =
        mode === 'now'
          ? new Date().toISOString()
          : scheduledAt
            ? zonedToIso(scheduledAt, timezone)
            : new Date().toISOString()
      const payload = {
        tenantId: tenant.id,
        accountId,
        kind,
        caption: fullCaption,
        mediaIds: selected,
        scheduledAt: scheduledIso,
        status: mode === 'draft' ? ('draft' as const) : ('scheduled' as const),
        altTexts: selected.map((id) => altMap[id] ?? ''),
        shareToFeed,
        coverUrl: kind === 'reels' ? (coverAsset?.public_url ?? null) : null,
        thumbOffsetMs: kind === 'reels' ? offset : null,
        collaborators: parseCollaborators(),
      }

      const post = editId
        ? await updatePost(editId, payload)
        : await createPost(payload)

      if (mode === 'now') {
        await invokeFunction('publish-post', { postId: post.id })
        setNotice('Publicacao iniciada. Acompanhe na fila.')
      } else if (mode === 'draft') {
        setNotice('Rascunho salvo.')
      } else {
        setNotice('Post agendado com sucesso.')
      }
      window.setTimeout(() => navigate('/queue'), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o post')
    } finally {
      setBusy(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <div>
        <PageHeader title={editId ? 'Editar post' : 'Novo post'} />
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
        title={editId ? 'Editar post' : 'Novo post'}
        description="Monte o post, escolha as midias e agende."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-4">
          <Field label="Conta">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.username ?? a.ig_user_id} · Via{' '}
                  {a.auth_path === 'facebook' ? 'Facebook' : 'Instagram'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Formato" hint={KIND_HINT[kind]}>
            <Select value={kind} onChange={(e) => changeKind(e.target.value as PostKind)}>
              <option value="image">Imagem (feed)</option>
              <option value="carousel">Carrossel (2 a 10)</option>
              <option value="reels">Reels (video)</option>
              <option value="story">Story (limitado)</option>
            </Select>
          </Field>

          {templates.length > 0 ? (
            <Field label="Template de legenda">
              <div className="flex gap-2">
                <Select
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">Escolher template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                {selectedTemplate ? (
                  <button
                    type="button"
                    onClick={() => void removeTemplate(selectedTemplate)}
                    aria-label="Remover template"
                    className="shrink-0 rounded-lg border border-white/15 px-2.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            </Field>
          ) : null}

          {rule.caption ? (
            <>
              <Field label="Legenda">
                <Textarea
                  rows={5}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Texto do post..."
                />
              </Field>
              <Field label="Hashtags">
                <Textarea
                  rows={2}
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#saas #gestao #wolfsistemas"
                />
              </Field>
              <p className="text-xs text-slate-500">
                {hashtagCount} hashtag(s){hashtagCount > 30 ? ' - acima do recomendado (30).' : ''}
              </p>
            </>
          ) : (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Stories via API nao aceitam legenda, stickers, enquetes nem links.
            </p>
          )}

          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={15} className="text-violet-300" />
              <p className="text-sm font-medium text-slate-300">
                Salvar legenda como template
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nome do template"
              />
              <Button variant="ghost" onClick={() => void saveTemplate()}>
                <Save size={15} /> Salvar
              </Button>
            </div>
          </div>

          {selected.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">
                {kind === 'carousel' ? 'Ordem e alt text' : 'Alt text (opcional)'}
              </p>
              {selected.map((id, index) => {
                const asset = assets.find((a) => a.id === id)
                return (
                  <div key={id} className="flex items-center gap-2">
                    {asset ? (
                      <img
                        src={asset.public_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <Input
                      value={altMap[id] ?? ''}
                      onChange={(e) =>
                        setAltMap((m) => ({ ...m, [id]: e.target.value }))
                      }
                      placeholder="Descricao para acessibilidade (opcional)"
                    />
                    {kind === 'carousel' ? (
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="rounded p-1 text-slate-400 hover:bg-white/10 disabled:opacity-30"
                          aria-label="Mover para cima"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={index === selected.length - 1}
                          onClick={() => move(index, 1)}
                          className="rounded p-1 text-slate-400 hover:bg-white/10 disabled:opacity-30"
                          aria-label="Mover para baixo"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}

          {kind === 'reels' ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-medium text-slate-300">Opcoes de Reels</p>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={shareToFeed}
                  onChange={(e) => setShareToFeed(e.target.checked)}
                  className="h-4 w-4 accent-violet-500"
                />
                Compartilhar tambem no feed
              </label>
              <Field label="Capa (opcional)">
                <Select
                  value={coverAssetId}
                  onChange={(e) => setCoverAssetId(e.target.value)}
                >
                  <option value="">Usar frame do video</option>
                  {imageAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.storage_path.split('/').pop() ?? a.id}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Segundo da capa (opcional)" hint="Ex.: 1.5 (ignora se escolher uma capa).">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={thumbOffsetSec}
                  onChange={(e) => setThumbOffsetSec(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
          ) : null}

          <Field
            label="Colaboradores (opcional)"
            hint="Usuarios do Instagram separados por virgula. Ex.: fulano, beltrano"
          >
            <Input
              value={collaborators}
              onChange={(e) => setCollaborators(e.target.value)}
              placeholder="@fulano, @beltrano"
            />
          </Field>

          <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-sm font-medium text-slate-300">Link com UTM</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={utmBase}
                onChange={(e) => setUtmBase(e.target.value)}
                placeholder="URL base"
              />
              <Input
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="campanha"
              />
              <Input
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                placeholder="origem"
              />
              <Input
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                placeholder="midia"
              />
            </div>
            {utmPreview ? (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-black/40 px-2 py-1.5 text-xs text-emerald-200">
                  {utmPreview}
                </code>
                <button
                  type="button"
                  onClick={() => void copy(utmPreview)}
                  className="rounded p-1.5 text-slate-400 hover:bg-white/10"
                  aria-label="Copiar UTM"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCaption((c) => (c ? `${c}\n\n${utmPreview}` : utmPreview))
                  }
                  className="rounded px-2 py-1.5 text-xs text-violet-300 hover:bg-white/10"
                >
                  Inserir na legenda
                </button>
              </div>
            ) : null}
          </div>

          <Field label={`Agendar para (${timezone})`}>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#0d1119] px-3 py-2 text-base text-slate-100 outline-none focus:border-violet-500 sm:text-sm"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          {notice ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => void submit('draft')}>
              <FileText size={16} />
              Salvar rascunho
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void submit('schedule')}>
              <CalendarPlus size={16} />
              {editId ? 'Salvar' : 'Agendar'}
            </Button>
            <Button disabled={busy} onClick={() => void submit('now')}>
              <Send size={16} />
              Publicar agora
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="mb-3 text-sm font-medium text-slate-200">Previa do post</p>
            <InstagramPreview
              kind={kind}
              caption={fullCaption}
              media={selectedAssets}
              username={accountHandle}
            />
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
                    <div key={asset.id} className="relative">
                      <button
                        type="button"
                        onClick={() => toggle(asset.id)}
                        className={
                          'relative aspect-square w-full overflow-hidden rounded-lg border-2 transition ' +
                          (active
                            ? 'border-violet-500'
                            : 'border-transparent opacity-80 hover:opacity-100')
                        }
                      >
                        {asset.kind === 'video' ? (
                          <video
                            src={asset.public_url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={asset.public_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                        {active ? (
                          <span className="absolute right-1 top-1 rounded bg-violet-600 px-1 text-[10px] text-white">
                            {selected.indexOf(asset.id) + 1}
                          </span>
                        ) : null}
                      </button>
                      {asset.kind === 'image' ? (
                        <button
                          type="button"
                          onClick={() => setResizeTarget(asset)}
                          aria-label="Redimensionar imagem"
                          title="Redimensionar / recortar"
                          className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-1 text-[10px] text-slate-200 transition hover:bg-violet-600"
                        >
                          <Crop size={12} /> Cortar
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {resizeTarget ? (
        <ImageResizer
          asset={resizeTarget}
          onClose={() => setResizeTarget(null)}
          onApply={applyCrop}
        />
      ) : null}
    </div>
  )
}
