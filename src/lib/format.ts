import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Format an instant in a specific IANA time zone. Falls back to the browser
// zone when none is provided.
export function formatDateTime(
  value: string | null | undefined,
  timeZone?: string | null,
): string {
  if (!value) return '-'
  const date = new Date(value)
  if (!timeZone) {
    return format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })
  }
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} as ${get('hour')}:${get('minute')}`
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - date.getTime()
}

// Convert a "YYYY-MM-DDTHH:mm" wall-clock string in `timeZone` to a UTC ISO.
export function zonedToIso(localInput: string, timeZone: string): string {
  const [datePart, timePart = '00:00'] = localInput.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const offset = zoneOffsetMs(new Date(guess), timeZone)
  return new Date(guess - offset).toISOString()
}

// Convert a UTC ISO instant to a "YYYY-MM-DDTHH:mm" value for datetime-local.
export function isoToZonedInput(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

// Current wall-clock in `timeZone`, in datetime-local format.
export function nowZonedInput(timeZone: string): string {
  return isoToZonedInput(new Date().toISOString(), timeZone)
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

export function countHashtags(text: string): number {
  const matches = text.match(/(^|\s)#[^\s#]+/g)
  return matches ? matches.length : 0
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

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietario',
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Visualizador',
}
