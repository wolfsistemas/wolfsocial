import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return format(new Date(value), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })
}

export function formatDateInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export const POST_KIND_LABEL: Record<string, string> = {
  image: 'Imagem',
  carousel: 'Carrossel',
  reels: 'Reels',
  story: 'Story',
}

export const POST_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
  canceled: 'Cancelado',
}
