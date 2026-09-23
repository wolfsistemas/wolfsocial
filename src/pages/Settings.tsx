import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Download, ExternalLink, Save } from 'lucide-react'
import {
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  PageHeader,
  Select,
} from '../components/ui'
import { updateTenantSettings } from '../lib/api'
import { useSession } from '../lib/session'
import { isConfigured } from '../lib/supabase'

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Cuiaba',
  'America/Bahia',
  'America/Rio_Branco',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'UTC',
]

const checklist = [
  { label: 'Projeto Supabase criado', key: 'supabase' },
  { label: 'Variaveis VITE_SUPABASE_* configuradas', key: 'env' },
  { label: 'Migracao aplicada (tabelas + RLS + bucket)', key: 'migration' },
  { label: 'Edge Functions publicadas', key: 'functions' },
  { label: 'App Meta criado e secrets definidos', key: 'meta' },
  { label: 'Conta do Instagram conectada', key: 'account' },
]

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export default function Settings() {
  const { tenant, email, refreshTenant } = useSession()
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [webhook, setWebhook] = useState('')
  const [limit, setLimit] = useState('50')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (!tenant) return
    setTimezone(tenant.timezone)
    setWebhook(tenant.alert_webhook_url ?? '')
    setLimit(String(tenant.daily_publish_limit))
  }, [tenant])

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function save() {
    if (!tenant) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateTenantSettings(tenant.id, {
        timezone,
        alert_webhook_url: webhook.trim() || null,
        daily_publish_limit: Number(limit) || 50,
      })
      await refreshTenant()
      setNotice('Configuracoes salvas.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Configuracoes" description="Estado do ambiente e do espaco." />

      <Card className="mb-5">
        <p className="text-sm text-slate-400">Espaco (tenant)</p>
        <p className="text-lg font-medium text-white">{tenant?.name ?? '-'}</p>
        <p className="mt-1 text-xs text-slate-500">
          slug {tenant?.slug ?? '-'} · usuario {email}
        </p>
      </Card>

      <Card className="mb-5 space-y-3">
        <p className="text-sm font-medium text-slate-200">Preferencias</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fuso horario" hint="Usado no calendario e agendamento.">
            <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Limite diario de publicacao" hint="Cota de seguranca por conta (24h).">
            <Input
              type="number"
              min="1"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Webhook de alertas (opcional)"
          hint="Recebe um POST JSON quando uma publicacao falhar."
        >
          <Input
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/..."
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        {notice ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}
        <Button disabled={busy} onClick={() => void save()}>
          <Save size={16} /> Salvar preferencias
        </Button>
      </Card>

      <Card className="mb-5">
        <p className="mb-3 text-sm font-medium text-slate-200">Checklist de configuracao</p>
        <ul className="space-y-2">
          {checklist.map((item) => {
            const done = item.key === 'env' || item.key === 'supabase' ? isConfigured : false
            const Icon = done ? CheckCircle2 : Circle
            return (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                <Icon
                  size={16}
                  className={done ? 'text-emerald-400' : 'text-slate-600'}
                />
                <span className={done ? 'text-slate-200' : 'text-slate-400'}>
                  {item.label}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card className="mb-5">
        <p className="mb-2 text-sm font-medium text-slate-200">Aplicativo</p>
        <p className="text-sm text-slate-400">
          Instale o WolfSocial como app no seu celular ou computador para acesso
          rapido. Em celulares, use "Adicionar a tela inicial".
        </p>
        {installEvent ? (
          <Button
            className="mt-3"
            onClick={() => {
              void installEvent.prompt()
              setInstallEvent(null)
            }}
          >
            <Download size={16} /> Instalar aplicativo
          </Button>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/team" className="text-violet-300 hover:text-violet-200">
            Equipe
          </Link>
          <Link to="/links" className="text-violet-300 hover:text-violet-200">
            Link na bio
          </Link>
          <Link to="/privacy" className="text-violet-300 hover:text-violet-200">
            Privacidade
          </Link>
          <Link to="/terms" className="text-violet-300 hover:text-violet-200">
            Termos
          </Link>
          <Link to="/data-deletion" className="text-violet-300 hover:text-violet-200">
            Exclusao de dados
          </Link>
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium text-slate-200">Documentacao</p>
        <p className="text-sm text-slate-400">
          O passo a passo completo de configuracao (Meta, Supabase, GitHub Pages
          e as etapas de teste) esta no arquivo SETUP.md na raiz do repositorio.
        </p>
        <a
          href="https://developers.facebook.com/docs/instagram-platform/content-publishing/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200"
        >
          Documentacao oficial de publicacao <ExternalLink size={14} />
        </a>
      </Card>
    </div>
  )
}
