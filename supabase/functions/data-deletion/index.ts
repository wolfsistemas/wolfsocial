import { adminClient } from '../_shared/db.ts'
import { handleOptions, json } from '../_shared/http.ts'

const encoder = new TextEncoder()

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function parseSignedRequest(
  signed: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const [sigPart, payloadPart] = signed.split('.')
  if (!sigPart || !payloadPart) return null
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(sigPart),
    encoder.encode(payloadPart),
  )
  if (!valid) return null
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart)))
  } catch {
    return null
  }
}

function appUrl(): string {
  return (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method === 'GET') {
    const code = new URL(req.url).searchParams.get('code')
    if (!code) {
      return json({
        help: 'Informe ?code=CODIGO para consultar o status da exclusao.',
      })
    }
    const sb = adminClient()
    const { data } = await sb
      .from('data_deletion_requests')
      .select('confirmation_code, status, created_at')
      .eq('confirmation_code', code)
      .maybeSingle()
    if (!data) return json({ error: 'Codigo nao encontrado.' }, 404)
    return json(data)
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo nao suportado.' }, 405)
  }

  const secret = Deno.env.get('META_APP_SECRET')
  if (!secret) return json({ error: 'META_APP_SECRET nao configurado.' }, 500)

  let signed: string | null = null
  const contentType = req.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('application/json')) {
      const body = await req.json()
      signed = (body?.signed_request as string) ?? null
    } else {
      const form = await req.formData()
      signed = (form.get('signed_request') as string) ?? null
    }
  } catch {
    return json({ error: 'Payload invalido.' }, 400)
  }

  if (!signed) return json({ error: 'signed_request ausente.' }, 400)
  const payload = await parseSignedRequest(signed, secret)
  if (!payload) return json({ error: 'Assinatura invalida.' }, 401)

  const confirmationCode = crypto.randomUUID()
  const sb = adminClient()
  await sb.from('data_deletion_requests').insert({
    meta_user_id: payload.user_id ? String(payload.user_id) : null,
    confirmation_code: confirmationCode,
    status: 'received',
  })

  return json({
    url: `${appUrl()}/data-deletion?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
})
