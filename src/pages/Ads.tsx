import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { Card, EmptyState, PageHeader, StatusBadge } from '../components/ui'
import { listAdAccounts, listAdCampaigns } from '../lib/api'
import { useSession } from '../lib/session'
import type { AdAccount, AdCampaign } from '../lib/types'

export default function Ads() {
  const { tenant } = useSession()
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])

  useEffect(() => {
    if (!tenant) return
    let active = true
    Promise.all([listAdAccounts(tenant.id), listAdCampaigns(tenant.id)])
      .then(([acc, camp]) => {
        if (!active) return
        setAccounts(acc)
        setCampaigns(camp)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [tenant])

  return (
    <div>
      <PageHeader
        title="Anuncios"
        description="Estrutura pronta para trafego pago. Integracao com a Marketing API entra em uma etapa futura."
      />

      <Card className="mb-5">
        <div className="flex items-start gap-3">
          <Megaphone className="mt-0.5 shrink-0 text-violet-300" size={20} />
          <div>
            <p className="font-medium text-slate-100">Por que ainda nao publica anuncios</p>
            <p className="mt-1 text-sm text-slate-400">
              Gerenciar campanhas exige permissao <code>ads_management</code> com
              App Review, verificacao de negocio e conta de anuncios com
              pagamento. Nesta etapa os testes sao de conteudo organico. As
              tabelas de anuncios ja existem no banco, prontas para quando essa
              fase chegar.
            </p>
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-slate-300">Contas de anuncio</h2>
      {accounts.length === 0 ? (
        <EmptyState title="Nenhuma conta de anuncio registrada" />
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <Card key={a.id} className="flex items-center justify-between">
              <span className="text-sm text-slate-200">
                {a.name ?? a.meta_ad_account_id}
              </span>
              <StatusBadge status={a.status} />
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-6 text-sm font-medium text-slate-300">Campanhas</h2>
      {campaigns.length === 0 ? (
        <EmptyState title="Nenhuma campanha registrada" />
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="flex items-center justify-between">
              <span className="text-sm text-slate-200">{c.name}</span>
              <StatusBadge status={c.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
