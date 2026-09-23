import { graphVersion, readError } from './meta.ts'

function graphBase(): string {
  return `https://graph.facebook.com/${graphVersion()}`
}

export interface PhoneInfo {
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
}

export interface SendResult {
  messageId: string | null
}

async function postMessage(
  phoneNumberId: string,
  token: string,
  payload: Record<string, unknown>,
): Promise<SendResult> {
  const res = await fetch(`${graphBase()}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json))
  const id = (json as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null
  return { messageId: id ?? null }
}

// Free-form text. Only deliverable inside the 24h customer service window
// (or to test recipients of a test number).
export function sendWhatsappText(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
): Promise<SendResult> {
  return postMessage(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body },
  })
}

// Approved template. Required for business-initiated messages outside the
// 24h window.
export function sendWhatsappTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  name: string,
  language: string,
  params: string[] = [],
): Promise<SendResult> {
  return postMessage(phoneNumberId, token, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name,
      language: { code: language },
      ...(params.length
        ? {
            components: [
              {
                type: 'body',
                parameters: params.map((text) => ({ type: 'text', text })),
              },
            ],
          }
        : {}),
    },
  })
}

export async function fetchPhoneInfo(
  phoneNumberId: string,
  token: string,
): Promise<PhoneInfo> {
  const res = await fetch(
    `${graphBase()}/${phoneNumberId}?${new URLSearchParams({
      fields: 'display_phone_number,verified_name,quality_rating',
    })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json))
  return json as PhoneInfo
}

export interface MessageTemplate {
  name: string
  status: string
  language: string
  category?: string
}

export async function listMessageTemplates(
  wabaId: string,
  token: string,
): Promise<MessageTemplate[]> {
  const res = await fetch(
    `${graphBase()}/${wabaId}/message_templates?${new URLSearchParams({
      limit: '200',
      fields: 'name,status,language,category',
    })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(readError(json))
  return ((json as { data?: MessageTemplate[] }).data ?? []).map((t) => ({
    name: t.name,
    status: t.status,
    language: t.language,
    category: t.category,
  }))
}

// Keeps only digits (with optional country code) as required by the Cloud API.
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '')
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Validates the X-Hub-Signature-256 header against the raw request body.
export async function verifyWebhookSignature(
  appSecret: string,
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!header || !header.startsWith('sha256=')) return false
  const expected = header.slice(7).toLowerCase()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)),
  )
  const hex = toHex(sig)
  if (hex.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i += 1) {
    diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
