import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { getPublicBio, trackBioClick, type PublicBio } from '../lib/api'

export default function Bio() {
  const { slug = '' } = useParams()
  const [bio, setBio] = useState<PublicBio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let active = true
    getPublicBio(slug)
      .then((data) => active && setBio(data))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center px-5 py-12">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-2xl font-semibold text-white">
        {(bio?.tenant_name ?? 'W').slice(0, 1).toUpperCase()}
      </div>
      <h1 className="text-lg font-semibold text-white">
        {bio?.tenant_name ?? 'WolfSocial'}
      </h1>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Carregando...</p>
      ) : error ? (
        <p className="mt-8 text-sm text-red-400">{error}</p>
      ) : !bio || bio.links.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          Nenhum link publicado ainda.
        </p>
      ) : (
        <div className="mt-8 w-full space-y-3">
          {bio.links
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => void trackBioClick(link.id)}
                className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-violet-500/50 hover:bg-violet-500/10"
              >
                {link.label}
                <ExternalLink size={15} className="text-slate-400" />
              </a>
            ))}
        </div>
      )}

      <Link
        to="/"
        className="mt-10 text-xs text-slate-500 hover:text-slate-300"
      >
        Feito com WolfSocial
      </Link>
    </div>
  )
}
