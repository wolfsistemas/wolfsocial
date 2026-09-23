import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ErrorText, PageHeader } from '../components/ui'
import { acceptInvite } from '../lib/api'
import { useSession } from '../lib/session'
import Login from './Login'

export default function Join() {
  const { session, refreshTenant, setActiveTenant } = useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const attempted = useRef(false)
  const token = params.get('token') ?? ''

  useEffect(() => {
    if (!session || !token || attempted.current) return
    attempted.current = true
    acceptInvite(token)
      .then(async (tenantId) => {
        setNotice('Convite aceito. Bem-vindo ao espaco!')
        await refreshTenant()
        if (tenantId) setActiveTenant(tenantId)
        window.setTimeout(() => navigate('/'), 1200)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Falha ao aceitar convite'),
      )
  }, [session, token, refreshTenant, setActiveTenant, navigate])

  if (!session) {
    return (
      <div>
        <p className="mx-auto max-w-md px-4 pt-8 text-center text-sm text-slate-400">
          Entre com o email que recebeu o convite para aceita-lo.
        </p>
        <Login />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageHeader title="Aceitar convite" />
      {!token ? <ErrorText>Convite sem token.</ErrorText> : null}
      <ErrorText>{error}</ErrorText>
      {notice ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}
      <Button onClick={() => navigate('/')}>Ir para o painel</Button>
    </div>
  )
}
