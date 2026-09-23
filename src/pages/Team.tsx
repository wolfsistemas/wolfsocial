import { useEffect, useState } from 'react'
import { Copy, Mail, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  PageHeader,
  Select,
} from '../components/ui'
import {
  createInvite,
  listInvites,
  listTeamMembers,
  myRole,
  revokeInvite,
} from '../lib/api'
import { formatDateTime, ROLE_LABEL } from '../lib/format'
import { useSession } from '../lib/session'
import type { Invite, MemberRole, TeamMember } from '../lib/types'

export default function Team() {
  const { tenant } = useSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [role, setRole] = useState<MemberRole | null>(null)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('editor')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const timezone = tenant?.timezone ?? undefined

  async function load() {
    if (!tenant) return
    try {
      const [m, i, r] = await Promise.all([
        listTeamMembers(tenant.id),
        listInvites(tenant.id),
        myRole(tenant.id),
      ])
      setMembers(m)
      setInvites(i)
      setRole(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar equipe')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  const canManage = role === 'owner' || role === 'admin'

  function joinLink(token: string): string {
    return new URL(
      `${import.meta.env.BASE_URL}join?token=${token}`,
      window.location.origin,
    ).toString()
  }

  async function invite() {
    if (!tenant || !email.trim()) {
      setError('Informe o email.')
      return
    }
    setError('')
    try {
      const created = await createInvite({
        tenantId: tenant.id,
        email,
        role: inviteRole,
      })
      setEmail('')
      setNotice('Convite criado. Copie o link abaixo e envie para a pessoa.')
      await navigator.clipboard.writeText(joinLink(created.token)).catch(() => {})
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao convidar')
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(joinLink(token))
      setNotice('Link copiado!')
      window.setTimeout(() => setNotice(''), 1500)
    } catch {
      setError('Nao foi possivel copiar.')
    }
  }

  async function revoke(id: string) {
    try {
      await revokeInvite(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao revogar')
    }
  }

  const pending = invites.filter((i) => !i.accepted_at && !i.revoked_at)

  return (
    <div>
      <PageHeader
        title="Equipe"
        description="Convide pessoas e defina papeis de acesso ao espaco."
      />
      <ErrorText>{error}</ErrorText>
      {notice ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      {canManage ? (
        <Card className="mb-5 space-y-3">
          <p className="text-sm font-medium text-slate-200">Convidar pessoa</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@email.com"
              />
            </Field>
            <Field label="Papel">
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              >
                <option value="admin">Administrador</option>
                <option value="editor">Editor</option>
                <option value="viewer">Visualizador</option>
              </Select>
            </Field>
            <Button onClick={() => void invite()}>
              <UserPlus size={16} /> Convidar
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            O convite exige que a pessoa crie conta com exatamente este email.
          </p>
        </Card>
      ) : null}

      <h2 className="mb-2 text-sm font-medium text-slate-200">Membros</h2>
      {members.length === 0 ? (
        <EmptyState title="Nenhum membro" />
      ) : (
        <div className="mb-6 space-y-2">
          {members.map((member) => (
            <Card key={member.user_id} className="flex items-center gap-3">
              <ShieldCheck className="text-violet-300" size={18} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{member.email}</p>
                <p className="text-xs text-slate-500">
                  desde {formatDateTime(member.created_at, timezone)}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-slate-300">
                {ROLE_LABEL[member.role] ?? member.role}
              </span>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium text-slate-200">Convites</h2>
      {pending.length === 0 ? (
        <EmptyState title="Nenhum convite pendente" />
      ) : (
        <div className="space-y-2">
          {pending.map((inviteRow) => (
            <Card key={inviteRow.id} className="flex flex-wrap items-center gap-3">
              <Mail className="text-slate-400" size={16} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-100">{inviteRow.email}</p>
                <p className="text-xs text-slate-500">
                  {ROLE_LABEL[inviteRow.role] ?? inviteRow.role} · expira no uso
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => void copy(inviteRow.token)}>
                  <Copy size={14} /> Link
                </Button>
                {canManage ? (
                  <Button variant="danger" onClick={() => void revoke(inviteRow.id)}>
                    <XCircle size={14} /> Revogar
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
