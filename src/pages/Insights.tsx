import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button, Card, EmptyState, ErrorText, PageHeader } from '../components/ui'
import { invokeFunction, listAccounts, listInsights, listPosts } from '../lib/api'
import { formatDateTime, POST_KIND_LABEL } from '../lib/format'
import { useSession } from '../lib/session'
import type { PostInsight, PostWithItems, SocialAccount } from '../lib/types'

function metric(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toLocaleString('pt-BR')
}

export default function Insights() {
  const { tenant } = useSession()
  const [posts, setPosts] = useState<PostWithItems[]>([])
  const [map, setMap] = useState<Record<string, PostInsight>>({})
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const timezone = tenant?.timezone ?? undefined

  async function load() {
    if (!tenant) return
    try {
      const [allPosts, insights, acc] = await Promise.all([
        listPosts(tenant.id, { status: 'published', ascending: false }),
        listInsights(tenant.id),
        listAccounts(tenant.id),
      ])
      setPosts(allPosts)
      setAccounts(acc)
      const next: Record<string, PostInsight> = {}
      for (const row of insights) next[row.post_id] = row
      setMap(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar insights')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  async function sync() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await invokeFunction<{ synced: number }>('fetch-insights', {
        force: true,
      })
      setNotice(`${result?.synced ?? 0} post(s) atualizados.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar')
    } finally {
      setBusy(false)
    }
  }

  const totals = useMemo(() => {
    const rows = Object.values(map)
    const sum = (key: keyof PostInsight) =>
      rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0)
    return {
      reach: sum('reach'),
      impressions: sum('impressions'),
      likes: sum('likes'),
      comments: sum('comments'),
      saves: sum('saves'),
      shares: sum('shares'),
    }
  }, [map])

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.username ?? ''

  const stats = [
    { label: 'Alcance', value: totals.reach },
    { label: 'Impressoes', value: totals.impressions },
    { label: 'Curtidas', value: totals.likes },
    { label: 'Comentarios', value: totals.comments },
    { label: 'Salvamentos', value: totals.saves },
    { label: 'Compartilhamentos', value: totals.shares },
  ]

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Metricas dos posts publicados (ultimos 30 dias sincronizados automaticamente)."
        actions={
          <Button variant="ghost" disabled={busy} onClick={() => void sync()}>
            <RefreshCw size={15} /> {busy ? 'Atualizando...' : 'Atualizar agora'}
          </Button>
        }
      />
      <ErrorText>{error}</ErrorText>
      {notice ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value }) => (
          <Card key={label} className="p-4">
            <p className="text-xl font-semibold text-white">{metric(value)}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Nenhum post publicado ainda"
          description="Publique um post para comecar a coletar metricas."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                <th className="px-4 py-3">Post</th>
                <th className="px-3 py-3 text-right">Alcance</th>
                <th className="px-3 py-3 text-right">Curtidas</th>
                <th className="px-3 py-3 text-right">Coment.</th>
                <th className="px-3 py-3 text-right">Salvos</th>
                <th className="px-3 py-3 text-right">Compart.</th>
                <th className="px-4 py-3">Sincronizado</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const insight = map[post.id]
                return (
                  <tr key={post.id} className="border-b border-white/5">
                    <td className="px-4 py-3">
                      <p className="text-slate-200">
                        {POST_KIND_LABEL[post.kind]}
                        {accountName(post.account_id)
                          ? ` · @${accountName(post.account_id)}`
                          : ''}
                      </p>
                      <p className="line-clamp-1 text-xs text-slate-500">
                        {post.caption || 'sem legenda'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {metric(insight?.reach)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {metric(insight?.likes)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {metric(insight?.comments)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {metric(insight?.saves)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      {metric(insight?.shares)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {insight ? formatDateTime(insight.fetched_at, timezone) : 'pendente'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
