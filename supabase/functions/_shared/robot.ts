import { adminClient } from './db.ts'
import { sha256Hex } from './crypto.ts'

export interface RobotDevice {
  id: string
  tenant_id: string
  name: string
  status: string
}

export interface RobotContext {
  sb: ReturnType<typeof adminClient>
  device: RobotDevice
}

// Resolves the robot device from the `x-robot-token` header. Returns null when
// the token is missing, unknown or the device is disabled.
export async function deviceFromToken(req: Request): Promise<RobotContext | null> {
  const token = req.headers.get('x-robot-token') ?? ''
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const sb = adminClient()
  const { data: secret } = await sb
    .from('robot_device_secrets')
    .select('device_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (!secret?.device_id) return null
  const { data: device } = await sb
    .from('robot_devices')
    .select('id, tenant_id, name, status')
    .eq('id', secret.device_id)
    .maybeSingle()
  if (!device || device.status !== 'active') return null
  return { sb, device: device as RobotDevice }
}
