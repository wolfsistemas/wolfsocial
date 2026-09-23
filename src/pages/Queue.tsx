import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Send, XCircle } from 'lucide-react'
import { Button, Card, EmptyState, ErrorText, Modal, PageHeader, Select, StatusBadge } from '../components/ui'
import { invokeFunction, listLogs, listPosts, retryPost, setPostStatus } from '../lib/api'
import { formatDateTime, POST_KIND_LABEL, POST_STATUS_LABEL } from '../lib/format'
import { useSession } from '../lib/session'
import type { PostWithItems, PublishLog } from '../lib/types'

export default function Queue() {
  const { tenant } = useSession()
  const [posts, setPosts] = useState<PostWithItems[]>([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [logsFor, setLogsFor] = useState<PostWithItems | null>(null)
  const [logs, setLogs] = useState<PublishLog[]>([])
  const [busyId, setBusyId] = useState('')

  async function load() {
    if (!tenant) return
    try {
      setPosts(await listPosts(tenant.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar fila')
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

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
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acao falhou')
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

  const visible = posts.filter((p) => filter === 'all' || p.status === filter)

  return (
    <div>
      <PageHeader
        title="Fila"
        description="Acompanhe, publique agora, repita ou cancele."
        actions={
          <Button variant="ghost" onClick={() => void load()}>
            <RefreshCw size={15} /> Atualizar
          </Button>
        }
      />
      <ErrorText>{error}</ErrorText>

      <div className="my-4 max-w-xs">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="scheduled">Agendados</option>
          <option value="publishing">Publicando</option>
          <option value="published">Publicados</option>
          <option value="failed">Falhas</option>
          <option value="canceled">Cancelados</option>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Fila vazia"
          description="Crie um post para ele aparecer aqui."
          action={
            <Link to="/composer" className="mt-2 text-sm text-violet-300 hover:text-violet-200">
              Criar post
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((post) => (
            <Card key={post.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-100">
                      {POST_KIND_LABEL[post.kind]}
                    </p>
                    <StatusBadge status={post.status} label={POST_STATUS_LABEL[post.status]} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                    {post.caption || 'sem legenda'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(post.scheduled_at)} · {post.post_items.length} midia(s)
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
                    {formatDateTime(log.created_at)} · {log.level}
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
