import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { Card, PageHeader } from '../components/ui'
import { useSession } from '../lib/session'
import { isConfigured } from '../lib/supabase'

const checklist = [
  { label: 'Projeto Supabase criado', key: 'supabase' },
  { label: 'Variaveis VITE_SUPABASE_* configuradas', key: 'env' },
  { label: 'Migracao aplicada (tabelas + RLS + bucket)', key: 'migration' },
  { label: 'Edge Functions publicadas', key: 'functions' },
  { label: 'App Meta criado e secrets definidos', key: 'meta' },
  { label: 'Conta do Instagram conectada', key: 'account' },
]

export default function Settings() {
  const { tenant, email } = useSession()

  return (
    <div>
      <PageHeader title="Configuracoes" description="Estado do ambiente e do espaco." />

      <Card className="mb-5">
        <p className="text-sm text-slate-400">Espaco (tenant)</p>
        <p className="text-lg font-medium text-white">{tenant?.name ?? '-'}</p>
        <p className="mt-1 text-xs text-slate-500">
          slug {tenant?.slug ?? '-'} · usuario {email}
        </p>
      </Card>

      <Card className="mb-5">
        <p className="mb-3 text-sm font-medium text-slate-200">Checklist de configuracao</p>
        <ul className="space-y-2">
          {checklist.map((item) => {
            const done = item.key === 'env' || item.key === 'supabase' ? isConfigured : false
            const Icon = done ? CheckCircle2 : Circle
            return (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                <Icon
                  size={16}
                  className={done ? 'text-emerald-400' : 'text-slate-600'}
                />
                <span className={done ? 'text-slate-200' : 'text-slate-400'}>
                  {item.label}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium text-slate-200">Documentacao</p>
        <p className="text-sm text-slate-400">
          O passo a passo completo de configuracao (Meta, Supabase, GitHub Pages
          e as etapas de teste) esta no arquivo SETUP.md na raiz do repositorio.
        </p>
        <a
          href="https://developers.facebook.com/docs/instagram-platform/content-publishing/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200"
        >
          Documentacao oficial de publicacao <ExternalLink size={14} />
        </a>
      </Card>
    </div>
  )
}
