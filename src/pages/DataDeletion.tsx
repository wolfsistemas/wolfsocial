import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, Field, Input } from '../components/ui'
import LegalShell from '../components/LegalShell'
import { supabaseUrl } from '../lib/supabase'

interface Status {
  confirmation_code: string
  status: string
  created_at: string
}

export default function DataDeletion() {
  const [params, setParams] = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function lookup(value: string) {
    if (!value) return
    setBusy(true)
    setError('')
    setStatus(null)
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/data-deletion?code=${encodeURIComponent(value)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Nao encontrado')
      setStatus(data as Status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na consulta')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const initial = params.get('code')
    if (initial) void lookup(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LegalShell title="Exclusao de dados">
      <p>
        Esta pagina atende ao callback de exclusao de dados da Meta. Requisicoes
        recebidas pelo Instagram/Facebook sao registradas com um codigo de
        confirmacao, que pode ser consultado abaixo.
      </p>

      <Card className="mt-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            setParams({ code }, { replace: true })
            void lookup(code)
          }}
        >
          <div className="flex-1">
            <Field label="Codigo de confirmacao">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ex.: 0f1e2d3c-..."
              />
            </Field>
          </div>
          <Button type="submit" disabled={busy}>
            Consultar
          </Button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        {status ? (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
            <p className="text-slate-300">
              Status: <span className="text-white">{status.status}</span>
            </p>
            <p className="text-xs text-slate-500">
              Recebido em {new Date(status.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        ) : null}
      </Card>

      <p className="text-xs text-slate-500">
        Para excluir os dados diretamente, remova o acesso do WolfSocial nas
        configuracoes do seu Instagram e envie um pedido pelo email de suporte.
        Excluiremos tokens, midias e registros associados ao seu espaco.
      </p>
    </LegalShell>
  )
}
