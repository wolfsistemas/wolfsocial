import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Bot,
  Check,
  Copy,
  KeyRound,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
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
  cancelOutbox,
  createRobotDevice,
  enqueueOutbox,
  invokeFunction,
  listOutbox,
  listRobotDevices,
  listWhatsappAccounts,
  listWhatsappMessages,
  listWhatsappTemplates,
  removeRobotDevice,
  removeWhatsappAccount,
  rotateRobotDevice,
  updateRobotNotify,
} from '../lib/api'
import { useSession } from '../lib/session'
import { supabaseUrl } from '../lib/supabase'
import type {
  RobotDevice,
  WaOutboxMessage,
  WhatsappAccount,
  WhatsappMessage,
  WhatsappTemplate,
} from '../lib/types'

export default function WhatsApp() {
  const { tenant } = useSession()
  // API oficial (Meta Cloud API) oculta por enquanto: o envio/avisos saem pelo
  // robo local (WhatsApp Web). Mude para true se for configurar a conta Meta.
  const SHOW_META_API = false
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

  const [devices, setDevices] = useState<RobotDevice[]>([])
  const [outbox, setOutbox] = useState<WaOutboxMessage[]>([])
  const [newDeviceName, setNewDeviceName] = useState('')
  const [deviceToken, setDeviceToken] = useState('')
  const [deviceAlertPhone, setDeviceAlertPhone] = useState('')
  const [deviceNotify, setDeviceNotify] = useState(false)
  const [queueTo, setQueueTo] = useState('')
  const [queueText, setQueueText] = useState('Mensagem de teste pelo robo local.')

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
      const [accounts, msgs, devs, queue] = await Promise.all([
        listWhatsappAccounts(tenant.id),
        listWhatsappMessages(tenant.id),
        listRobotDevices(tenant.id),
        listOutbox(tenant.id),
      ])
      setAccount(accounts[0] ?? null)
      setMessages(msgs)
      setDevices(devs)
      setDeviceAlertPhone(devs[0]?.alert_phone ?? '')
      setDeviceNotify(devs[0]?.notify_enabled ?? false)
      setOutbox(queue)
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

  function addDevice() {
    if (!tenant) return
    void run(async () => {
      const created = await createRobotDevice(
        tenant.id,
        newDeviceName.trim() || 'Meu computador',
      )
      setDeviceToken(created.token)
      setNewDeviceName('')
    }, 'Dispositivo criado. Copie o token agora.')
  }

  function rotateDevice(deviceId: string) {
    if (!tenant) return
    void run(async () => {
      setDeviceToken(await rotateRobotDevice(tenant.id, deviceId))
    }, 'Token renovado. Copie agora.')
  }

  function deleteDevice(deviceId: string) {
    if (!tenant) return
    if (!window.confirm('Remover este dispositivo? O robo para de receber a fila.')) return
    void run(() => removeRobotDevice(tenant.id, deviceId), 'Dispositivo removido.')
  }

  function enqueue() {
    if (!tenant) return
    void run(async () => {
      if (!queueTo.replace(/\D/g, '')) throw new Error('Informe o numero de destino.')
      await enqueueOutbox({ tenantId: tenant.id, to: queueTo, body: queueText })
      setQueueText('')
    }, 'Mensagem adicionada na fila.')
  }

  function cancel(id: string) {
    void run(() => cancelOutbox(id), 'Item cancelado.')
  }

  function saveRobotNotify() {
    if (!tenant) return
    void run(
      () => updateRobotNotify(tenant.id, deviceAlertPhone, deviceNotify),
      'Avisos do robo salvos.',
    )
  }

  function copyToken() {
    void navigator.clipboard?.writeText(deviceToken)
    setNotice('Token copiado.')
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Robo local (WhatsApp Web): envie e receba avisos pelo seu proprio numero."
      />

      {SHOW_META_API ? (
        <>
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
        </>
      ) : null}

      <Card className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <Bot size={16} className="text-violet-300" />
          <p className="text-sm font-medium text-slate-200">
            Robo local (WhatsApp Web)
          </p>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Para o seu numero pessoal/Business (nao oficial), o envio sai do seu
          computador via WhatsApp Web. O WolfSocial so enfileira as mensagens e o
          robo busca (sem expor porta). Use apenas para uso proprio e com
          mensagens pontuais.
        </p>

        <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Bell size={16} className="text-violet-300" />
            <p className="text-sm font-medium text-slate-200">
              Avisos de publicacao
            </p>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Receba no WhatsApp um aviso sempre que um post agendado for
            publicado (ou falhar).
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Telefone para avisos (DDI+DDD+numero)">
              <Input
                value={deviceAlertPhone}
                onChange={(e) => setDeviceAlertPhone(e.target.value)}
                placeholder="5562999999999"
              />
            </Field>
            <Button disabled={busy} onClick={saveRobotNotify}>
              <Check size={16} />
              Salvar
            </Button>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={deviceNotify}
              onChange={(e) => setDeviceNotify(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/30"
            />
            Ativar avisos por WhatsApp
          </label>
        </div>

        {deviceToken ? (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="mb-2 text-xs text-amber-200">
              Copie o token agora. Ele nao sera exibido de novo.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-black/40 px-2 py-1 text-xs text-amber-100">
                {deviceToken}
              </code>
              <Button variant="ghost" onClick={copyToken}>
                <Copy size={14} />
                Copiar
              </Button>
            </div>
          </div>
        ) : null}

        {devices.length ? (
          <div className="mb-3 space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-slate-200">{device.name}</p>
                  <p className="text-xs text-slate-500">
                    {device.last_seen_at
                      ? `Visto em ${new Date(device.last_seen_at).toLocaleString('pt-BR')}`
                      : 'Nunca conectou'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={busy} onClick={() => rotateDevice(device.id)}>
                    <KeyRound size={14} />
                    Novo token
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => deleteDevice(device.id)}>
                    <Trash2 size={14} />
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-slate-500">
            Nenhum dispositivo ainda. Crie um e cole o token no robo da sua maquina.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Nome do dispositivo" hint="Ex.: PC do escritorio">
            <Input
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="Meu computador"
            />
          </Field>
          <Button disabled={busy} onClick={addDevice}>
            <Plus size={16} />
            Criar dispositivo
          </Button>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-3 text-sm font-medium text-slate-200">
            Enfileirar mensagem
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Para (DDI+DDD+numero)">
              <Input
                value={queueTo}
                onChange={(e) => setQueueTo(e.target.value)}
                placeholder="5562999999999"
              />
            </Field>
            <Field label="Mensagem">
              <Input
                value={queueText}
                onChange={(e) => setQueueText(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button disabled={busy} onClick={enqueue}>
              <Send size={16} />
              Adicionar na fila
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-slate-200">Fila do robo</p>
          {outbox.length === 0 ? (
            <p className="text-sm text-slate-500">Fila vazia.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Para</th>
                    <th className="px-3 py-2">Mensagem</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {outbox.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-3 py-2 text-slate-300">{item.to_phone}</td>
                      <td className="max-w-[16rem] truncate px-3 py-2 text-slate-400">
                        {item.body ?? `(${item.kind})`}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={item.status} />
                        {item.status === 'failed' && item.last_error ? (
                          <span className="ml-1 text-red-300" title={item.last_error}>
                            !
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.status === 'queued' || item.status === 'sending' ? (
                          <button
                            className="text-slate-400 hover:text-red-300"
                            onClick={() => cancel(item.id)}
                            title="Cancelar"
                          >
                            <XCircle size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {SHOW_META_API ? (
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
      ) : null}

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
