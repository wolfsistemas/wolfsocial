import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function LegalShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm text-violet-300 hover:text-violet-200">
        WolfSocial
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-white">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-300">
        {children}
      </div>
      <div className="mt-10 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-sm">
        <Link to="/privacy" className="text-violet-300 hover:text-violet-200">
          Privacidade
        </Link>
        <Link to="/terms" className="text-violet-300 hover:text-violet-200">
          Termos
        </Link>
        <Link to="/data-deletion" className="text-violet-300 hover:text-violet-200">
          Exclusao de dados
        </Link>
      </div>
    </div>
  )
}
