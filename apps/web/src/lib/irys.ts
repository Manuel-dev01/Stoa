/**
 * Server-side Irys upload utility.
 * Uploads JSON data to Irys via the HTTP gateway.
 */

const IRYS_NODE = process.env.IRYS_NODE_URL || "https://node2.irys.xyz"
const IRYS_PRIVATE_KEY = process.env.IRYS_PRIVATE_KEY

interface IrysUploadResult {
  receipt: string
  id: string
}

/**
 * Upload JSON data to Irys. Returns the transaction ID (receipt).
 * Uses the Irys HTTP /tx/data endpoint — no Node.js SDK dependency.
 */
export async function uploadToIrys(data: Record<string, unknown>): Promise<IrysUploadResult> {
  if (!IRYS_PRIVATE_KEY) {
    throw new Error("IRYS_PRIVATE_KEY not configured")
  }

  const body = JSON.stringify(data)

  // Upload via Irys HTTP API
  const resp = await fetch(`${IRYS_NODE}/tx/data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    throw new Error(`Irys upload failed: ${resp.status} ${text}`)
  }

  const result = await resp.json()
  return {
    receipt: result.id || result.receipt,
    id: result.id || result.receipt,
  }
}

/**
 * Canonicalize JSON for hashing: sorted keys, no whitespace.
 */
export function canonicalizeJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort())
}
