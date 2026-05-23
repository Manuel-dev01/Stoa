/**
 * Irys HTTP upload utility for the SDK.
 * Uploads JSON data to Irys via the HTTP gateway — no Node.js SDK dependency.
 */

const DEFAULT_IRYS_NODE = 'https://node2.irys.xyz'

export interface IrysUploadResult {
  id: string
  receipt: string
}

/**
 * Upload JSON data to Irys via the HTTP /tx/data endpoint.
 */
export async function uploadToIrys(
  data: Record<string, unknown>,
  irysNodeUrl?: string,
): Promise<IrysUploadResult> {
  const nodeUrl = irysNodeUrl || DEFAULT_IRYS_NODE

  const resp = await fetch(`${nodeUrl}/tx/data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Irys upload failed: ${resp.status} ${text}`)
  }

  const result = await resp.json()
  return {
    id: result.id || result.receipt,
    receipt: result.id || result.receipt,
  }
}
