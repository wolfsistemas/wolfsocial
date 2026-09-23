import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AtSign,
  CalendarClock,
  CheckCircle2,
  Images,
  LineChart,
  XCircle,
} from 'lucide-react'
import { Card, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { listAccounts, listInsights, listMedia, listPosts } from '../lib/api'
import { formatDateTime, POST_KIND_LABEL, POST_STATUS_LABEL } from '../lib/format'
import { useSession } from '../lib/session'
import type { PostInsight, PostWithItems, SocialAccount } from '../lib/types'

export default function Dashboard() {
  const { tenant } = useSession()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [posts, setPosts] = useState<PostWithItems[]>([])
  const [publishedRecently, setPublishedRecently] = useState<PostWithItems[]>([])
  const [insights, setInsights] = useState<PostInsight[]>([])
  const [mediaCount, setMediaCount] = useState(0)
  const [error, setError] = useState('')

  const timezone = tenant?.timezone ?? undefined
  const dailyLimit = tenant?.daily_publish_limit ?? 50

  useEffect(() => {
    if (!tenant) return
    let active = true
    Promise.all([
      listAccounts(tenant.id),
      listPosts(tenant.id, { ascending: false }),
      listMedia(tenant.id),
      listInsights(tenant.id),
    ])
      .then(([acc, post, media, ins]) => {
        if (!active) return
        const cutoff = Date.now() - 24 * 3600_000
        setAccounts(acc)
        setPosts(post)
        setPublishedRecently(
          post.filter(
            (p) => p.published_at && new Date(p.published_at).getTime() >= cutoff,
          ),
        )
        setMediaCount(media.length)
        setInsights(ins)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [tenant])

  const scheduled = posts.filter((p) => p.status === 'scheduled').length
  const published = posts.filter((p) => p.status === 'published').length
  const failed = posts.filter((p) => p.status === 'failed').length
  const drafts = posts.filter((p) => p.status === 'draft').length
  const upcoming = posts
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 5)

  const reachTotal = insights.reduce((acc, i) => acc + (Number(i.reach) || 0), 0)
  const likesTotal = insights.reduce((acc, i) => acc + (Number(i.likes) || 0), 0)

  const stats = [
    { label: 'Contas conectadas', value: accounts.length, icon: AtSign },
    { label: 'Midias', value: mediaCount, icon: Images },
    { label: 'Agendados', value: scheduled, icon: CalendarClock },
    { label: 'Publicados', value: published, icon: CheckCircle2 },
    { label: 'Falhas', value: failed, icon: XCircle },
  ]

  return (
    <div>
      <PageHeader
        title="Painel"
        description="Visao geral do seu conteudo no Instagram."
      />
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-4">
            <Icon className="mb-2 text-violet-300" size={18} />
            <p className="text-2xl font-semibold text-white">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-100">Cota de publicacao (24h)</h2>
            <span className="text-xs text-slate-500">limite {dailyLimit}</span>
          </div>
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma conta conectada.</p>
          ) : (
            <ul className="space-y-3">
              {accounts.map((account) => {
                const used = publishedRecently.filter(
                  (p) => p.account_id === account.id,
                ).length
                const pct = Math.min(100, Math.round((used / dailyLimit) * 100))
                return (
                  <li key={account.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        @{account.username ?? account.ig_user_id}
                      </span>
                      <span className="text-slate-500">
                        {used}/{dailyLimit}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={
                          'h-full rounded-full ' +
                          (pct >= 90 ? 'bg-red-500' : 'bg-violet-500')
                        }
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {drafts > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {drafts} rascunho(s) guardado(s) na{' '}
              <Link to="/queue" className="text-violet-300 hover:text-violet-200">
                fila
              </Link>
              .
            </p>
          ) : null}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-100">Desempenho</h2>
            <Link
              to="/insights"
              className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
            >
              <LineChart size={13} /> Insights
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xl font-semibold text-white">
                {reachTotal.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-slate-500">Alcance</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">
                {likesTotal.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-slate-500">Curtidas</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {insights.length} post(s) com metricas sincronizadas.
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-slate-100">Atalhos</h2>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/calendar" className="text-violet-300 hover:text-violet-200">
              Ver calendario
            </Link>
            <Link to="/composer" className="text-violet-300 hover:text-violet-200">
              Criar post
            </Link>
            <Link to="/links" className="text-violet-300 hover:text-violet-200">
              Editar link na bio
            </Link>
            <Link to="/team" className="text-violet-300 hover:text-violet-200">
              Gerenciar equipe
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-slate-100">Proximos agendamentos</h2>
          <Link to="/queue" className="text-sm text-violet-300 hover:text-violet-200">
            Ver fila
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nada agendado"
            description="Crie um post para comecar a divulgar seus produtos."
            action={
              <Link
                to="/composer"
                className="mt-2 text-sm text-violet-300 hover:text-violet-200"
              >
                Criar post
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {upcoming.map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-200">
                    {POST_KIND_LABEL[post.kind]} · {post.caption || 'sem legenda'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(post.scheduled_at, timezone)}
                  </p>
                </div>
                <StatusBadge
                  status={post.status}
                  label={POST_STATUS_LABEL[post.status]}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
