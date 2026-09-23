import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { clsx } from 'clsx'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/api'
import { formatDateTime } from '../lib/format'
import { useSession } from '../lib/session'
import type { AppNotification } from '../lib/types'

const levelStyles: Record<string, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
}

export default function NotificationsBell() {
  const { tenant } = useSession()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    if (!tenant) return
    try {
      setItems(await listNotifications(tenant.id))
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unread = items.filter((n) => !n.read).length

  async function readOne(item: AppNotification) {
    if (item.read) return
    setItems((current) =>
      current.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    )
    try {
      await markNotificationRead(item.id)
    } catch {
      // ignore
    }
  }

  async function readAll() {
    if (!tenant) return
    setItems((current) => current.map((n) => ({ ...n, read: true })))
    try {
      await markAllNotificationsRead(tenant.id)
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notificacoes"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-300 hover:bg-white/10"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#10141d] p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Notificacoes</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void readAll()}
                className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
              >
                <CheckCheck size={13} /> Marcar todas
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Nada por aqui.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void readOne(item)}
                    className={clsx(
                      'w-full rounded-lg border p-2 text-left transition',
                      levelStyles[item.level] ?? levelStyles.info,
                      item.read && 'opacity-60',
                    )}
                  >
                    <p className="text-xs font-medium">{item.title}</p>
                    {item.message ? (
                      <p className="mt-0.5 text-xs text-slate-300">{item.message}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-slate-500">
                      {formatDateTime(item.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
