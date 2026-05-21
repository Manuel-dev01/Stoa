import { privateKeyToAccount } from "viem/accounts"
import { createWalletClient, http } from "viem"
import { polygon } from "viem/chains"

const MSG = "I am creating a CLOB API key for Polymarket"

async function main() {
  const key = "0x153b71f7828cc77190c80d7f7c1b66ec6ec33988ac32566015ba5bdef5d0fa40"
  const account = privateKeyToAccount(key as `0x${string}`)
  const PROXY = "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a"

  const signer = createWalletClient({ account, transport: http("https://polygon-bor-rpc.publicnode.com") })

  const ts = Math.floor(Date.now() / 1000).toString()
  const nonce = 0

  console.log("EOA:", account.address)
  console.log("Proxy:", PROXY)
  console.log()

  // Sign L1 auth with proxy wallet address in the message
  console.log("Signing L1 auth with proxy address in message...")
  const sig = await signer.signTypedData({
    domain: { name: "ClobAuthDomain", version: "1", chainId: 137 },
    types: {
      ClobAuth: [
        { name: "address", type: "address" },
        { name: "timestamp", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "message", type: "string" },
      ],
    },
    primaryType: "ClobAuth",
    message: { address: PROXY as `0x${string}`, timestamp: ts, nonce: BigInt(nonce), message: MSG },
  })

  console.log("Signature:", sig.slice(0, 20) + "...")

  const headers = {
    POLY_ADDRESS: PROXY,
    POLY_SIGNATURE: sig,
    POLY_TIMESTAMP: ts,
    POLY_NONCE: nonce.toString(),
    "Content-Type": "application/json",
  }

  // Try derive-api-key
  console.log("\nCalling derive-api-key with proxy address...")
  const resp = await fetch("https://clob.polymarket.com/derive-api-key", { headers })
  console.log("Status:", resp.status)
  const body = await resp.text()
  console.log("Response:", body.slice(0, 500))

  // Try create-api-key
  console.log("\nCalling create-api-key with proxy address...")
  const resp2 = await fetch("https://clob.polymarket.com/create-api-key", { method: "POST", headers })
  console.log("Status:", resp2.status)
  const body2 = await resp2.text()
  console.log("Response:", body2.slice(0, 500))
}

main().catch((e) => console.error("Fatal:", e.message))
