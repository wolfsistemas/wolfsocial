import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Pencil, RefreshCw, Send, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
} from '../components/ui'
import {
  duplicatePost,
  invokeFunction,
  listAccounts,
  listLogs,
  listPosts,
  retryPost,
  setPostStatus,
} from '../lib/api'
import { formatDateTime, POST_KIND_LABEL, POST_STATUS_LABEL } from '../lib/format'
import { useSession } from '../lib/session'
import type { PostWithItems, PublishLog, SocialAccount } from '../lib/types'

const PAGE_SIZE = 15

export default function Queue() {
  const { tenant } = useSession()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<PostWithItems[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [filter, setFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [logsFor, setLogsFor] = useState<PostWithItems | null>(null)
  const [logs, setLogs] = useState<PublishLog[]>([])
  const [busyId, setBusyId] = useState('')

  const timezone = tenant?.timezone ?? undefined
  const ascending = filter === 'scheduled' || filter === 'draft'

  async function load(reset = true) {
    if (!tenant) return
    try {
      const offset = reset ? 0 : posts.length
      const [page, acc] = await Promise.all([
        listPosts(tenant.id, {
          status: filter === 'all' ? 'all' : (filter as never),
          accountId: accountFilter || undefined,
          limit: PAGE_SIZE,
          offset,
          ascending,
        }),
        reset ? listAccounts(tenant.id) : Promise.resolve(accounts),
      ])
      setPosts(reset ? page : [...posts, ...page])
      setHasMore(page.length === PAGE_SIZE)
      if (reset) setAccounts(acc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar fila')
    }
  }

  useEffect(() => {
    void load(true)
    const timer = window.setInterval(() => void load(true), 30_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, filter, accountFilter])

  async function act(post: PostWithItems, action: 'now' | 'retry' | 'cancel') {
    setBusyId(post.id)
    setError('')
    try {
      if (action === 'now') {
        await setPostStatus(post.id, 'scheduled')
        await invokeFunction('publish-post', { postId: post.id })
      } else if (action === 'retry') {
        await retryPost(post.id)
      } else {
        await setPostStatus(post.id, 'canceled')
      }
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acao falhou')
    } finally {
      setBusyId('')
    }
  }

  async function duplicate(post: PostWithItems) {
    setBusyId(post.id)
    setError('')
    try {
      await duplicatePost(post)
      setNotice('Post duplicado como rascunho.')
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao duplicar')
    } finally {
      setBusyId('')
    }
  }

  async function openLogs(post: PostWithItems) {
    setLogsFor(post)
    try {
      setLogs(await listLogs(post.id))
    } catch {
      setLogs([])
    }
  }

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.username ?? ''

  return (
    <div>
      <PageHeader
        title="Fila"
        description="Acompanhe, publique agora, edite, duplique ou cancele."
        actions={
          <Button variant="ghost" onClick={() => void load(true)}>
            <RefreshCw size={15} /> Atualizar
          </Button>
        }
      />
      <ErrorText>{error}</ErrorText>
      {notice ? (
        <p className="my-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      <div className="my-4 flex flex-wrap gap-3">
        <div className="w-full max-w-xs">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="draft">Rascunhos</option>
            <option value="scheduled">Agendados</option>
            <option value="publishing">Publicando</option>
            <option value="published">Publicados</option>
            <option value="failed">Falhas</option>
            <option value="canceled">Cancelados</option>
          </Select>
        </div>
        <div className="w-full max-w-xs">
          <Select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.username ?? a.ig_user_id} · Via{' '}
                {a.auth_path === 'facebook' ? 'Facebook' : 'Instagram'}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Nada por aqui"
          description="Crie um post para ele aparecer na fila."
          action={
            <Link to="/composer" className="mt-2 text-sm text-violet-300 hover:text-violet-200">
              Criar post
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-100">
                      {POST_KIND_LABEL[post.kind]}
                    </p>
                    <StatusBadge status={post.status} label={POST_STATUS_LABEL[post.status]} />
                    {accountName(post.account_id) ? (
                      <span className="text-xs text-slate-500">
                        @{accountName(post.account_id)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                    {post.caption || 'sem legenda'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(post.scheduled_at, timezone)} ·{' '}
                    {post.post_items.length} midia(s)
                    {post.attempts > 0 ? ` · ${post.attempts} tentativa(s)` : ''}
                  </p>
                  {post.last_error ? (
                    <p className="mt-1 text-xs text-red-400">{post.last_error}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    disabled={busyId === post.id}
                    onClick={() => void openLogs(post)}
                  >
                    Logs
                  </Button>
                  {post.status !== 'published' && post.status !== 'publishing' ? (
                    <Button
                      variant="ghost"
                      disabled={busyId === post.id}
                      onClick={() => navigate(`/composer?edit=${post.id}`)}
                    >
                      <Pencil size={15} /> Editar
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    disabled={busyId === post.id}
                    onClick={() => void duplicate(post)}
                  >
                    <Copy size={15} /> Duplicar
                  </Button>
                  {post.status !== 'published' && post.status !== 'publishing' ? (
                    <Button
                      variant="ghost"
                      disabled={busyId === post.id}
                      onClick={() => void act(post, 'now')}
                    >
                      <Send size={15} /> Agora
                    </Button>
                  ) : null}
                  {post.status === 'failed' ? (
                    <Button
                      variant="ghost"
                      disabled={busyId === post.id}
                      onClick={() => void act(post, 'retry')}
                    >
                      <RefreshCw size={15} /> Repetir
                    </Button>
                  ) : null}
                  {post.status === 'scheduled' ? (
                    <Button
                      variant="danger"
                      disabled={busyId === post.id}
                      onClick={() => void act(post, 'cancel')}
                    >
                      <XCircle size={15} /> Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" onClick={() => void load(false)}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {logsFor ? (
        <Modal title="Logs de publicacao" onClose={() => setLogsFor(null)}>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Sem registros ainda.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {logs.map((log) => (
                <li key={log.id} className="rounded-lg bg-black/30 p-2">
                  <p className="text-xs text-slate-500">
                    {formatDateTime(log.created_at, timezone)} · {log.level}
                  </p>
                  <p className="text-slate-200">{log.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
