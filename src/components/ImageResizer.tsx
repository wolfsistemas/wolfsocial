import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Crop, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from './ui'
import type { MediaAsset } from '../lib/types'

interface Preset {
  id: string
  label: string
  width: number
  height: number
}

const PRESETS: Preset[] = [
  { id: 'story', label: 'Story / Reels 9:16', width: 810, height: 1440 },
  { id: 'feed45', label: 'Feed 4:5', width: 1152, height: 1440 },
  { id: 'square', label: 'Feed 1:1', width: 1440, height: 1440 },
  { id: 'landscape', label: 'Paisagem 1.91:1', width: 1440, height: 754 },
]

const MAX_FRAME_HEIGHT = 380

export default function ImageResizer({
  asset,
  onClose,
  onApply,
}: {
  asset: MediaAsset
  onClose: () => void
  onApply: (file: File, presetLabel: string) => Promise<void>
}) {
  const [presetId, setPresetId] = useState('story')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  )

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const aspect = preset.width / preset.height
  const frameWidth = Math.min(320, MAX_FRAME_HEIGHT * aspect)
  const frameHeight = frameWidth / aspect

  useEffect(() => {
    setError('')
    setImage(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.onerror = () =>
      setError('Nao foi possivel carregar a imagem para recorte.')
    img.src = asset.public_url
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [asset.public_url])

  const dims = useMemo(() => {
    if (!image) return null
    const iw = image.naturalWidth
    const ih = image.naturalHeight
    if (!iw || !ih) return null
    const ratio = iw / ih
    let baseW: number
    let baseH: number
    if (ratio > aspect) {
      baseH = ih
      baseW = ih * aspect
    } else {
      baseW = iw
      baseH = iw / aspect
    }
    const cropW = baseW / zoom
    const cropH = baseH / zoom
    return {
      iw,
      ih,
      cropW,
      cropH,
      maxX: Math.max(0, (iw - cropW) / 2),
      maxY: Math.max(0, (ih - cropH) / 2),
    }
  }, [image, aspect, zoom])

  useEffect(() => {
    if (!dims) return
    setOffset((current) => ({
      x: Math.max(-dims.maxX, Math.min(dims.maxX, current.x)),
      y: Math.max(-dims.maxY, Math.min(dims.maxY, current.y)),
    }))
  }, [dims])

  const preview = useMemo(() => {
    if (!image || !dims) return null
    const scale = frameWidth / dims.cropW
    const cropX = dims.iw / 2 - dims.cropW / 2 + offset.x
    const cropY = dims.ih / 2 - dims.cropH / 2 + offset.y
    return {
      scale,
      cropX,
      cropY,
      cropW: dims.cropW,
      cropH: dims.cropH,
      left: -cropX * scale,
      top: -cropY * scale,
      width: dims.iw * scale,
      height: dims.ih * scale,
    }
  }, [image, dims, offset, frameWidth])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!preview) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || !dims || !preview) return
    const dx = (event.clientX - drag.x) / preview.scale
    const dy = (event.clientY - drag.y) / preview.scale
    setOffset({
      x: Math.max(-dims.maxX, Math.min(dims.maxX, drag.ox - dx)),
      y: Math.max(-dims.maxY, Math.min(dims.maxY, drag.oy - dy)),
    })
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  async function apply() {
    if (!image || !preview) return
    setBusy(true)
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = preset.width
      canvas.height = preset.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponivel neste navegador.')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        image,
        preview.cropX,
        preview.cropY,
        preview.cropW,
        preview.cropH,
        0,
        0,
        canvas.width,
        canvas.height,
      )
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      )
      if (!blob) throw new Error('Falha ao gerar a imagem recortada.')
      const base =
        asset.storage_path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'imagem'
      const file = new File([blob], `${base}-${preset.id}.jpg`, {
        type: 'image/jpeg',
      })
      await onApply(file, preset.label)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao recortar imagem.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d1119] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop size={16} className="text-violet-300" />
            <p className="text-sm font-medium text-slate-200">Redimensionar imagem</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-slate-400 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPresetId(item.id)
                setZoom(1)
                setOffset({ x: 0, y: 0 })
              }}
              className={
                'rounded-lg border px-2.5 py-1 text-xs transition ' +
                (item.id === preset.id
                  ? 'border-violet-500 bg-violet-500/15 text-violet-200'
                  : 'border-white/15 text-slate-300 hover:bg-white/5')
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex justify-center">
          <div
            className="relative overflow-hidden rounded-lg bg-black/40"
            style={{
              width: frameWidth,
              height: frameHeight,
              touchAction: 'none',
              cursor: preview ? 'grab' : 'default',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {preview ? (
              <img
                src={asset.public_url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  left: preview.left,
                  top: preview.top,
                  width: preview.width,
                  height: preview.height,
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Carregando...
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-white/20" />
          </div>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <ZoomOut size={15} className="shrink-0 text-slate-400" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-violet-500"
            aria-label="Zoom"
          />
          <ZoomIn size={15} className="shrink-0 text-slate-400" />
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Arraste a imagem para enquadrar e use o zoom. Saida em{' '}
          {preset.width}x{preset.height}px (JPEG).
        </p>

        {error ? (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void apply()} disabled={busy || !preview}>
            {busy ? 'Gerando...' : 'Usar este recorte'}
          </Button>
        </div>
      </div>
    </div>
  )
}
