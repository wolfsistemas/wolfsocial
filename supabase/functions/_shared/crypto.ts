export function b64encode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function b64decode(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encKey(): Uint8Array {
  const raw = Deno.env.get('TOKEN_ENC_KEY')
  if (!raw) throw new Error('TOKEN_ENC_KEY nao configurada')
  const key = b64decode(raw)
  if (key.length !== 32) {
    throw new Error('TOKEN_ENC_KEY deve ter 32 bytes (base64)')
  }
  return key
}

async function aesKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encKey(), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await aesKey()
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plain),
    ),
  )
  const combined = new Uint8Array(iv.length + cipher.length)
  combined.set(iv, 0)
  combined.set(cipher, iv.length)
  return b64encode(combined)
}

export async function decryptToken(payload: string): Promise<string> {
  const combined = b64decode(payload)
  const iv = combined.slice(0, 12)
  const cipher = combined.slice(12)
  const key = await aesKey()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  )
  return Array.from(digest)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function signState(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encKey(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)),
  )
  return `${data}.${b64encode(sig)}`
}

export async function verifyState(state: string): Promise<string | null> {
  const idx = state.lastIndexOf('.')
  if (idx < 0) return null
  const data = state.slice(0, idx)
  const expected = await signState(data)
  return expected === state ? data : null
}
