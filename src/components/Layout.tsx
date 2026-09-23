import {
  BarChart3,
  CalendarClock,
  Home,
  AtSign,
  Images,
  Megaphone,
  Settings,
  LogOut,
  PlusSquare,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSession } from '../lib/session'

const nav = [
  { to: '/', label: 'Painel', icon: Home, end: true },
  { to: '/accounts', label: 'Contas', icon: AtSign },
  { to: '/media', label: 'Midias', icon: Images },
  { to: '/composer', label: 'Novo post', icon: PlusSquare },
  { to: '/queue', label: 'Fila', icon: CalendarClock },
  { to: '/ads', label: 'Anuncios', icon: Megaphone },
  { to: '/settings', label: 'Configuracoes', icon: Settings },
]

export default function Layout() {
  const { tenant, email, signOut } = useSession()

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0d1119] p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <BarChart3 className="text-violet-400" size={22} />
          <span className="text-lg font-semibold text-white">WolfSocial</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-violet-600/20 text-violet-200'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="truncate px-2 text-xs text-slate-500">
            {tenant?.name ?? 'Sem espaco'}
          </p>
          <p className="truncate px-2 text-xs text-slate-600">{email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-100"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
