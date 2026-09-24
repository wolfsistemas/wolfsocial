export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-robot-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } })
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variavel de ambiente ausente: ${name}`)
  return value
}
