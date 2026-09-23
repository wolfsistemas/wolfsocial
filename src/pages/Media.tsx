import { useEffect, useRef, useState } from 'react'
import { Copy, Film, Image as ImageIcon, Upload } from 'lucide-react'
import { Button, Card, EmptyState, ErrorText, PageHeader } from '../components/ui'
import { listMedia, uploadMedia } from '../lib/api'
import { formatBytes, formatDuration } from '../lib/format'
import { useSession } from '../lib/session'
import type { MediaAsset } from '../lib/types'

export default function Media() {
  const { tenant } = useSession()
  const inputRef = useRef<HTMLInputElement>(null)
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!tenant) return
    try {
      setAssets(await listMedia(tenant.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar midias')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant])

  async function onFiles(files: FileList | null) {
    if (!tenant || !files?.length) return
    setBusy(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        await uploadMedia(tenant.id, file)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setError('Nao foi possivel copiar a URL.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Midias"
        description="Envie imagens e videos. Eles ficam hospedados publicamente para o Instagram buscar."
        actions={
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload size={16} />
              {busy ? 'Enviando...' : 'Enviar midia'}
            </Button>
          </>
        }
      />
      <ErrorText>{error}</ErrorText>

      {assets.length === 0 ? (
        <EmptyState
          title="Nenhuma midia"
          description="Envie uma imagem ou video para usar nos posts."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden p-0">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-black/30">
                {asset.kind === 'video' ? (
                  <video
                    src={asset.public_url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    controls
                  />
                ) : (
                  <img
                    src={asset.public_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  {asset.kind === 'video' ? <Film size={13} /> : <ImageIcon size={13} />}
                  {asset.kind}
                </div>
                <p className="text-xs text-slate-500">
                  {asset.width && asset.height
                    ? `${asset.width}x${asset.height} · `
                    : ''}
                  {formatBytes(asset.size_bytes)}
                  {asset.kind === 'video'
                    ? ` · ${formatDuration(asset.duration_seconds)}`
                    : ''}
                </p>
                <button
                  type="button"
                  onClick={() => void copy(asset.public_url)}
                  className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
                >
                  <Copy size={12} /> Copiar URL
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
