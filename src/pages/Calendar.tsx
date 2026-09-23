import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Button, Card, ErrorText, PageHeader, StatusBadge } from '../components/ui'
import { listAccounts, listPosts, reschedulePost } from '../lib/api'
import { isoToZonedInput, POST_KIND_LABEL, POST_STATUS_LABEL, zonedToIso } from '../lib/format'
import { useSession } from '../lib/session'
import type { PostWithItems, SocialAccount } from '../lib/types'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

const statusDot: Record<string, string> = {
  draft: 'border-slate-500/50 bg-slate-500/10',
  scheduled: 'border-sky-500/50 bg-sky-500/10',
  publishing: 'border-amber-500/50 bg-amber-500/10',
  published: 'border-emerald-500/50 bg-emerald-500/10',
  failed: 'border-red-500/50 bg-red-500/10',
  canceled: 'border-slate-600/50 bg-slate-600/10',
}

export default function Calendar() {
  const { tenant } = useSession()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [posts, setPosts] = useState<PostWithItems[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState('')
  const [busyDay, setBusyDay] = useState('')

  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'
  const dayKey = (date: Date) => format(date, 'yyyy-MM-dd')
  const keyOfPost = (iso: string) => isoToZonedInput(iso, timezone).slice(0, 10)
  const todayKey = isoToZonedInput(new Date().toISOString(), timezone).slice(0, 10)

  async function load() {
    if (!tenant) return
    try {
      const [all, acc] = await Promise.all([
        listPosts(tenant.id, { ascending: true }),
        listAccounts(tenant.id),
      ])
      setPosts(all)
      setAccounts(acc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  function postsForDay(day: Date) {
    const key = dayKey(day)
    return posts.filter((p) => keyOfPost(p.scheduled_at) === key)
  }

  async function dropOn(day: Date) {
    if (!dragging) return
    const post = posts.find((p) => p.id === dragging)
    setDragging('')
    if (!post) return
    const key = dayKey(day)
    const time = isoToZonedInput(post.scheduled_at, timezone).slice(11)
    const nextIso = zonedToIso(`${key}T${time}`, timezone)
    if (nextIso === post.scheduled_at) return
    setBusyDay(key)
    setError('')
    try {
      await reschedulePost(post.id, nextIso)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reagendar')
    } finally {
      setBusyDay('')
    }
  }

  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.username ?? ''

  return (
    <div>
      <PageHeader
        title="Calendario"
        description="Visao mensal. Arraste um post para reagendar (mantem o horario)."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" onClick={() => setMonth(startOfMonth(new Date()))}>
              Hoje
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              aria-label="Proximo mes"
            >
              <ChevronRight size={16} />
            </Button>
            <Button variant="ghost" onClick={() => void load()}>
              <RefreshCw size={15} />
            </Button>
          </div>
        }
      />
      <ErrorText>{error}</ErrorText>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium capitalize text-white">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Link to="/composer" className="text-sm text-violet-300 hover:text-violet-200">
          Novo post
        </Link>
      </div>

      <Card className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayPosts = postsForDay(day)
            const inMonth = isSameMonth(day, month)
            const key = dayKey(day)
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  if (dragging) e.preventDefault()
                }}
                onDrop={() => void dropOn(day)}
                className={
                  'min-h-24 rounded-lg border p-1.5 transition ' +
                  (inMonth ? 'border-white/10 bg-black/20' : 'border-transparent bg-transparent opacity-40') +
                  (busyDay === key ? ' ring-1 ring-violet-500' : '')
                }
              >
                <div
                  className={
                    'mb-1 text-right text-xs ' +
                    (key === todayKey
                      ? 'font-semibold text-violet-300'
                      : 'text-slate-500')
                  }
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 4).map((post) => (
                    <div
                      key={post.id}
                      draggable={
                        post.status === 'scheduled' ||
                        post.status === 'draft' ||
                        post.status === 'failed'
                      }
                      onDragStart={() => setDragging(post.id)}
                      onDragEnd={() => setDragging('')}
                      title={`${POST_KIND_LABEL[post.kind]} · ${POST_STATUS_LABEL[post.status]}`}
                      className={
                        'cursor-grab truncate rounded border px-1.5 py-0.5 text-[10px] text-slate-200 ' +
                        (statusDot[post.status] ?? statusDot.draft)
                      }
                    >
                      <span className="font-medium">
                        {isoToZonedInput(post.scheduled_at, timezone).slice(11)}
                      </span>{' '}
                      {POST_KIND_LABEL[post.kind]}
                      {accountName(post.account_id)
                        ? ` @${accountName(post.account_id)}`
                        : ''}
                    </div>
                  ))}
                  {dayPosts.length > 4 ? (
                    <p className="text-[10px] text-slate-500">
                      +{dayPosts.length - 4}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
        {(['scheduled', 'draft', 'published', 'failed'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className={
                'inline-block h-2.5 w-2.5 rounded-sm border ' +
                (statusDot[s] ?? '')
              }
            />
            <StatusBadge status={s} label={POST_STATUS_LABEL[s]} />
          </span>
        ))}
      </div>
    </div>
  )
}
