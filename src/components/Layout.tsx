import { useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Home,
  AtSign,
  Images,
  Link2,
  LineChart,
  Megaphone,
  Settings,
  Users,
  LogOut,
  PlusSquare,
  Menu,
  X,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import NotificationsBell from './NotificationsBell'
import { useSession } from '../lib/session'

const nav = [
  { to: '/', label: 'Painel', icon: Home, end: true },
  { to: '/accounts', label: 'Contas', icon: AtSign },
  { to: '/media', label: 'Midias', icon: Images },
  { to: '/composer', label: 'Novo post', icon: PlusSquare },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/queue', label: 'Fila', icon: CalendarClock },
  { to: '/insights', label: 'Insights', icon: LineChart },
  { to: '/links', label: 'Link na bio', icon: Link2 },
  { to: '/team', label: 'Equipe', icon: Users },
  { to: '/ads', label: 'Anuncios', icon: Megaphone },
  { to: '/settings', label: 'Configuracoes', icon: Settings },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition md:py-2',
    isActive
      ? 'bg-violet-600/20 text-violet-200'
      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
  )

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={linkClass} onClick={onNavigate}>
          <Icon size={17} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function AccountFooter() {
  const { tenant, email, signOut } = useSession()
  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <p className="truncate px-2 text-xs text-slate-500">
        {tenant?.name ?? 'Sem espaco'}
      </p>
      <p className="truncate px-2 text-xs text-slate-600">{email}</p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-100 md:py-2"
      >
        <LogOut size={16} />
        Sair
      </button>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2">
      <BarChart3 className="text-violet-400" size={22} />
      <span className="text-lg font-semibold text-white">WolfSocial</span>
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-full">
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[#0d1119]/95 px-3 backdrop-blur md:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10"
          >
            <Menu size={20} />
          </button>
          <BarChart3 className="text-violet-400" size={20} />
          <span className="font-semibold text-white">WolfSocial</span>
        </div>
        <NotificationsBell />
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-white/10 bg-[#0d1119] p-4"
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <AccountFooter />
          </div>
        </div>
      ) : null}

      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0d1119] p-4 md:flex">
        <div className="mb-6 flex items-center justify-between">
          <Brand />
          <NotificationsBell />
        </div>
        <NavLinks />
        <AccountFooter />
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-[calc(4rem+env(safe-area-inset-top))] md:px-8 md:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
