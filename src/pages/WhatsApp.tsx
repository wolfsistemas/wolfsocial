import { useEffect, useMemo, useState } from 'react'
import {
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  PageHeader,
  StatusBadge,
} from '../components/ui'
import {
  invokeFunction,
  listWhatsappAccounts,
  listWhatsappMessages,
  listWhatsappTemplates,
  removeWhatsappAccount,
} from '../lib/api'
import { useSession } from '../lib/session'
import { supabaseUrl } from '../lib/supabase'
import type {
  WhatsappAccount,
  WhatsappMessage,
  WhatsappTemplate,
} from '../lib/types'

export default function WhatsApp() {
  const { tenant } = useSession()
  const [account, setAccount] = useState<WhatsappAccount | null>(null)
  const [messages, setMessages] = useState<WhatsappMessage[]>([])
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])

  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [alertPhone, setAlertPhone] = useState('')
  const [notifyEnabled, setNotifyEnabled] = useState(false)

  const [testTo, setTestTo] = useState('')
  const [testText, setTestText] = useState(
    'Ola! Teste do WolfSocial via WhatsApp Cloud API.',
  )

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const webhookUrl = useMemo(
    () => `${supabaseUrl}/functions/v1/whatsapp-webhook`,
    [],
  )

  async function load() {
    if (!tenant) return
    try {
      const [accounts, msgs] = await Promise.all([
        listWhatsappAccounts(tenant.id),
        listWhatsappMessages(tenant.id),
      ])
      setAccount(accounts[0] ?? null)
      setMessages(msgs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar WhatsApp')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  useEffect(() => {
    if (!account) return
    setPhoneNumberId(account.phone_number_id)
    setWabaId(account.waba_id ?? '')
    setAlertPhone(account.alert_phone ?? '')
    setNotifyEnabled(account.notify_enabled)
    setTestTo((current) => current || account.alert_phone || '')
  }, [account])

  async function run(action: () => Promise<void>, okMessage: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await load()
      setNotice(okMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na operacao')
    } finally {
      setBusy(false)
    }
  }

  function connect() {
    if (!tenant) return
    void run(async () => {
      await invokeFunction('whatsapp-connect', {
        tenantId: tenant.id,
        phoneNumberId,
        wabaId,
        accessToken,
        alertPhone,
        notifyEnabled,
      })
      setAccessToken('')
    }, 'Conta WhatsApp conectada.')
  }

  function remove() {
    if (!tenant || !account) return
    if (!window.confirm('Desconectar e remover esta conta do WhatsApp?')) return
    void run(
      () => removeWhatsappAccount(tenant.id, account.id),
      'Conta removida.',
    )
  }

  function sendTest() {
    if (!tenant) return
    void run(async () => {
      await invokeFunction('whatsapp-send', {
        tenantId: tenant.id,
        to: testTo,
        text: testText,
      })
    }, 'Mensagem enviada.')
  }

  function loadTemplates() {
    if (!tenant) return
    void run(async () => {
      setTemplates(await listWhatsappTemplates(tenant.id))
    }, 'Templates atualizados.')
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Conecte um numero oficial (WhatsApp Cloud API) para envios e avisos."
      />

      <Card className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-300" />
          <p className="text-sm font-medium text-slate-200">
            Webhook (configure no painel da Meta)
          </p>
        </div>
        <code className="block break-all rounded-lg bg-black/40 px-3 py-2 text-xs text-emerald-200">
          {webhookUrl}
        </code>
        <p className="mt-2 text-xs text-slate-500">
          Verify token: definido no secret <code>WHATSAPP_VERIFY_TOKEN</code>.
          Assine o campo <code>messages</code>.
        </p>
      </Card>

      <Card className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle size={16} className="text-violet-300" />
          <p className="text-sm font-medium text-slate-200">
            {account ? 'Conta conectada' : 'Conectar conta'}
          </p>
          {account ? <StatusBadge status={account.status} /> : null}
        </div>

        {account ? (
          <p className="mb-3 text-sm text-slate-400">
            {account.verified_name ?? 'Sem nome'} ·{' '}
            {account.display_phone ?? account.phone_number_id}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Phone Number ID"
            hint="Painel do app > WhatsApp > API Setup (numero 'From')."
          >
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="123456789012345"
            />
          </Field>
          <Field
            label="WABA ID (Messaging account ID)"
            hint="No API Setup aparece como 'Messaging account ID'."
          >
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="987654321098765"
            />
          </Field>
          <Field
            label="Access token"
            hint="Botao 'Generate access token' (24h) para teste; System User para producao."
          >
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={account ? '•••••• (preencha para atualizar)' : 'EAAG...'}
            />
          </Field>
          <Field label="Telefone de alerta" hint="Com DDI+DDD. Ex.: 5562999999999">
            <Input
              value={alertPhone}
              onChange={(e) => setAlertPhone(e.target.value)}
              placeholder="5562999999999"
            />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={notifyEnabled}
            onChange={(e) => setNotifyEnabled(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          Avisar por WhatsApp quando um post for publicado ou falhar
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={connect}>
            <MessageCircle size={16} />
            {account ? 'Salvar conexao' : 'Conectar WhatsApp'}
          </Button>
          {account ? (
            <Button variant="danger" disabled={busy} onClick={remove}>
              <Trash2 size={16} />
              Remover
            </Button>
          ) : null}
        </div>
      </Card>

      {account ? (
        <Card className="mb-5">
          <p className="mb-3 text-sm font-medium text-slate-200">Enviar teste</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Para (DDI+DDD+numero)">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="5562999999999"
              />
            </Field>
            <Field label="Mensagem">
              <Input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={sendTest}>
              <Send size={16} />
              Enviar teste
            </Button>
            <Button variant="ghost" disabled={busy} onClick={loadTemplates}>
              <RefreshCw size={16} />
              Ver templates aprovados
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Texto livre so entrega dentro da janela de 24h ou para numeros de
            teste. Fora disso, e preciso usar um template aprovado.
          </p>
          {templates.length ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Idioma</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={`${tpl.name}-${tpl.language}`} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-200">{tpl.name}</td>
                      <td className="px-3 py-2 text-slate-400">{tpl.language}</td>
                      <td className="px-3 py-2 text-slate-400">{tpl.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <p className="mb-3 text-sm font-medium text-slate-200">
          Mensagens recentes
        </p>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma mensagem ainda.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={
                      msg.direction === 'in'
                        ? 'text-emerald-300'
                        : 'text-violet-300'
                    }
                  >
                    {msg.direction === 'in' ? 'Recebida' : 'Enviada'} ·{' '}
                    {msg.wa_from ?? msg.wa_to}
                  </span>
                  <span className="text-slate-500">
                    {new Date(msg.created_at).toLocaleString('pt-BR')}
                    {msg.status ? ` · ${msg.status}` : ''}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                  {msg.body ?? `(${msg.kind})`}
                </p>
                {msg.error ? (
                  <p className="mt-1 text-xs text-red-300">{msg.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {error ? (
        <div className="mt-4">
          <ErrorText>{error}</ErrorText>
        </div>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
