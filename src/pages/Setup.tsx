import { BarChart3, KeyRound, Server, Workflow } from 'lucide-react'
import { Card } from '../components/ui'

const steps = [
  {
    icon: Server,
    title: '1. Criar o projeto no Supabase',
    body: 'Em supabase.com, crie um projeto. Copie a Project URL e a anon public key em Project Settings > API.',
  },
  {
    icon: KeyRound,
    title: '2. Definir as variaveis do frontend',
    body: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Localmente em .env; no GitHub em Settings > Secrets and variables > Actions > Variables.',
  },
  {
    icon: Workflow,
    title: '3. Rodar a migracao e as Edge Functions',
    body: 'Aplique supabase/migrations e publique as funcoes em supabase/functions. O passo a passo completo esta em SETUP.md.',
  },
]

export default function Setup() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8 flex items-center gap-2">
        <BarChart3 className="text-violet-400" size={28} />
        <span className="text-2xl font-semibold text-white">WolfSocial</span>
      </div>
      <Card className="mb-6">
        <h1 className="text-lg font-semibold text-white">
          Backend ainda nao configurado
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          O frontend esta no ar, mas ainda nao encontrou as credenciais do
          Supabase. Enquanto isso, o app nao consegue autenticar nem acessar
          dados. Siga os passos abaixo para conectar.
        </p>
      </Card>
      <div className="space-y-4">
        {steps.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="flex gap-4">
            <Icon className="mt-0.5 shrink-0 text-violet-300" size={20} />
            <div>
              <p className="font-medium text-slate-100">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{body}</p>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <p className="text-sm font-medium text-slate-200">Exemplo de .env</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-slate-300">
{`VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key`}
        </pre>
      </Card>
    </div>
  )
}
