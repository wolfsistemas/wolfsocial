import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AtSign, Link2, RefreshCw, ShieldCheck, Trash2, Unlink } from 'lucide-react'
import { Button, Card, ErrorText, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import {
  disconnectAccount,
  listAccounts,
  removeAccount,
  startInstagramConnect,
} from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useSession } from '../lib/session'
import type { SocialAccount } from '../lib/types'

export default function Accounts() {
  const { tenant } = useSession()
  const [params, setParams] = useSearchParams()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const connected = params.get('connected')
  const oauthError = params.get('error')

  async function load() {
    if (!tenant) return
    try {
      setAccounts(await listAccounts(tenant.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar contas')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  useEffect(() => {
    if (connected) {
      setNotice('Conta conectada com sucesso.')
      setParams({}, { replace: true })
    }
    if (oauthError) {
      setError(`A conexao falhou: ${oauthError}`)
      setParams({}, { replace: true })
    }
  }, [connected, oauthError, setParams])

  async function connect(authPath: 'facebook' | 'instagram') {
    setError('')
    setBusy(true)
    try {
      const url = await startInstagramConnect(authPath)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar conexao')
      setBusy(false)
    }
  }

  async function unlink(id: string) {
    if (
      !window.confirm(
        'Desconectar esta conta? Os agendamentos dela deixam de ser publicados. Voce pode reconectar depois.',
      )
    ) {
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await disconnectAccount(id)
      await load()
      setNotice('Conta desconectada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (
      !window.confirm(
        'Remover esta conta e todo o historico de posts dela? Esta acao nao pode ser desfeita.',
      )
    ) {
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await removeAccount(id)
      await load()
      setNotice('Conta removida.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Contas"
        description="Vincule a conta profissional do Instagram que vai publicar."
      />
      {notice ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}
      <ErrorText>{error}</ErrorText>

      <div className="my-5 grid gap-3 sm:grid-cols-2">
        <Card className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-violet-300" size={20} />
          <div className="flex-1">
            <p className="font-medium text-slate-100">
              Facebook Login (recomendado)
            </p>
            <p className="mb-3 mt-1 text-sm text-slate-400">
              Usa a Pagina vinculada no Portifolio Empresarial. Prepara o caminho
              para anuncios e da acesso a mais recursos.
            </p>
            <Button disabled={busy} onClick={() => void connect('facebook')}>
              <Link2 size={16} />
              Conectar via Facebook
            </Button>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <AtSign className="mt-0.5 shrink-0 text-pink-300" size={20} />
          <div className="flex-1">
            <p className="font-medium text-slate-100">Instagram Login</p>
            <p className="mb-3 mt-1 text-sm text-slate-400">
              Conexao direta, sem Pagina. Mais simples, porem nao serve para
              anuncios.
            </p>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void connect('instagram')}
            >
              <AtSign size={16} />
              Conectar via Instagram
            </Button>
          </div>
        </Card>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta conectada"
          description="Escolha um dos caminhos acima para vincular seu Instagram."
        />
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AtSign className="mt-0.5 text-pink-300" size={20} />
                <div>
                  <p className="font-medium text-slate-100">
                    @{account.username ?? account.ig_user_id}
                  </p>
                  <p className="text-xs text-slate-500">
                    Via {account.auth_path === 'facebook' ? 'Facebook' : 'Instagram'} ·
                    tipo {account.account_type ?? 'desconhecido'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Token expira em {formatDateTime(account.token_expires_at)}
                  </p>
                  {account.last_error ? (
                    <p className="mt-1 text-xs text-red-400">{account.last_error}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={account.status} />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    <RefreshCw size={13} /> Atualizar
                  </button>
                  {account.status === 'connected' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void unlink(account.id)}
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
                    >
                      <Unlink size={13} /> Desconectar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(account.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
