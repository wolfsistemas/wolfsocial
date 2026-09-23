import { useState, type FormEvent } from 'react'
import { BarChart3 } from 'lucide-react'
import { Button, ErrorText, Field, Input } from '../components/ui'
import { useSession } from '../lib/session'

export default function Login() {
  const { signIn, signUp } = useSession()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setInfo(
          'Conta criada. Se a confirmacao por e-mail estiver ativa, confirme antes de entrar.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticacao')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <BarChart3 className="text-violet-400" size={26} />
          <span className="text-2xl font-semibold text-white">WolfSocial</span>
        </div>
        <p className="mb-6 text-center text-sm text-slate-400">
          Agende e publique conteudo no seu Instagram.
        </p>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"
        >
          <Field label="E-mail">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </Field>
          <Field label="Senha">
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="minimo 6 caracteres"
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          {info ? (
            <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">
              {info}
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? 'Aguarde...' : mode === 'in' ? 'Entrar' : 'Criar conta'}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
          >
            {mode === 'in'
              ? 'Nao tem conta? Criar uma'
              : 'Ja tem conta? Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
