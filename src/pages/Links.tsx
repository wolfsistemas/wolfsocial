import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  PageHeader,
} from '../components/ui'
import {
  createBioLink,
  deleteBioLink,
  listBioLinks,
  updateBioLink,
} from '../lib/api'
import { useSession } from '../lib/session'
import type { BioLink } from '../lib/types'

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

export default function Links() {
  const { tenant } = useSession()
  const [links, setLinks] = useState<BioLink[]>([])
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [base, setBase] = useState('https://wolfsaas.com.br')
  const [source, setSource] = useState('instagram')
  const [medium, setMedium] = useState('bio')
  const [campaign, setCampaign] = useState('')

  async function load() {
    if (!tenant) return
    try {
      setLinks(await listBioLinks(tenant.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar links')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  const publicUrl = tenant
    ? new URL(`${import.meta.env.BASE_URL}bio/${tenant.slug}`, window.location.origin).toString()
    : ''

  async function add() {
    if (!tenant || !label.trim() || !url.trim()) {
      setError('Informe nome e URL do link.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createBioLink({
        tenantId: tenant.id,
        label: label.trim(),
        url: url.trim(),
        position: links.length,
      })
      setLabel('')
      setUrl('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar')
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= links.length) return
    const a = links[index]
    const b = links[target]
    try {
      await Promise.all([
        updateBioLink(a.id, { position: target }),
        updateBioLink(b.id, { position: index }),
      ])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reordenar')
    }
  }

  async function remove(id: string) {
    try {
      await deleteBioLink(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover')
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice('Copiado!')
      window.setTimeout(() => setNotice(''), 1500)
    } catch {
      setError('Nao foi possivel copiar.')
    }
  }

  const utmPreview = buildUtm(base, source, medium, campaign)

  return (
    <div>
      <PageHeader
        title="Link na bio"
        description="Uma pagina publica com seus links mais importantes."
      />
      <ErrorText>{error}</ErrorText>
      {notice ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      <Card className="mb-5">
        <p className="text-sm text-slate-400">Sua pagina publica</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-xs text-violet-200">
            {publicUrl || '-'}
          </code>
          <Button variant="ghost" onClick={() => void copy(publicUrl)}>
            <Copy size={15} /> Copiar
          </Button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200"
          >
            Abrir <ExternalLink size={14} />
          </a>
        </div>
      </Card>

      <Card className="mb-5 space-y-3">
        <p className="text-sm font-medium text-slate-200">Adicionar link</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Teste gratis"
            />
          </Field>
          <Field label="URL">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
        <Button disabled={busy} onClick={() => void add()}>
          <Plus size={16} /> Adicionar
        </Button>
      </Card>

      {links.length === 0 ? (
        <EmptyState
          title="Nenhum link"
          description="Adicione os links que aparecerao na sua bio."
        />
      ) : (
        <div className="space-y-2">
          {links.map((link, index) => (
            <Card key={link.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">
                  {link.label}
                </p>
                <p className="truncate text-xs text-slate-500">{link.url}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">
                {link.clicks} clique(s)
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                  aria-label="Subir"
                  className="rounded p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void move(index, 1)}
                  disabled={index === links.length - 1}
                  aria-label="Descer"
                  className="rounded p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(link.id)}
                  aria-label="Remover"
                  className="rounded p-1.5 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 space-y-3">
        <p className="text-sm font-medium text-slate-200">
          Construtor de UTM
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="URL base">
            <Input value={base} onChange={(e) => setBase(e.target.value)} />
          </Field>
          <Field label="Campanha">
            <Input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="lancamento"
            />
          </Field>
          <Field label="Origem">
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <Field label="Midia">
            <Input value={medium} onChange={(e) => setMedium(e.target.value)} />
          </Field>
        </div>
        {utmPreview ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-xs text-emerald-200">
              {utmPreview}
            </code>
            <Button variant="ghost" onClick={() => void copy(utmPreview)}>
              <Copy size={15} /> Copiar
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
