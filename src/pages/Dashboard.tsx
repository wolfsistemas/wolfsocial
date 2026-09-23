import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, CalendarClock, CheckCircle2, Images, XCircle } from 'lucide-react'
import { Card, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { listAccounts, listMedia, listPosts } from '../lib/api'
import { formatDateTime, POST_KIND_LABEL, POST_STATUS_LABEL } from '../lib/format'
import { useSession } from '../lib/session'
import type { PostWithItems, SocialAccount } from '../lib/types'

export default function Dashboard() {
  const { tenant } = useSession()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [posts, setPosts] = useState<PostWithItems[]>([])
  const [mediaCount, setMediaCount] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tenant) return
    let active = true
    Promise.all([listAccounts(tenant.id), listPosts(tenant.id), listMedia(tenant.id)])
      .then(([acc, post, media]) => {
        if (!active) return
        setAccounts(acc)
        setPosts(post)
        setMediaCount(media.length)
      })
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [tenant])

  const scheduled = posts.filter((p) => p.status === 'scheduled').length
  const published = posts.filter((p) => p.status === 'published').length
  const failed = posts.filter((p) => p.status === 'failed').length
  const upcoming = posts
    .filter((p) => p.status === 'scheduled')
    .slice(0, 5)

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
                    {formatDateTime(post.scheduled_at)}
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
