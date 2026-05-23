/**
 * deploy-proxy-wallet.ts
 *
 * Deploys a Polymarket deposit wallet (POLY_1271) for the agent EOA
 * using the @polymarket/builder-relayer-client SDK with Relayer API Key auth.
 *
 * Usage:
 *   npx tsx scripts/deploy-proxy-wallet.ts
 */

import { RelayClient, RelayerTxType, RelayerTransactionState } from "@polymarket/builder-relayer-client"
import { createWalletClient, http } from "viem"
import { polygon } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

const RELAYER_URL = "https://relayer-v2.polymarket.com"

// ERC-1967 implementation slot
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

// Known proxy address from archive
const KNOWN_PROXY = "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a"

async function checkImplementationSlot(rpcUrl: string, address: string): Promise<string> {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getStorageAt",
      params: [address, IMPLEMENTATION_SLOT, "latest"],
      id: 1,
    }),
  })
  const data = await resp.json() as { result: string }
  return data.result
}

async function main() {
  // Use AGENT_PRIVATE_KEY for relayer (this is the EOA that owns the proxy)
  const rawKey = process.env.AGENT_PRIVATE_KEY
  if (!rawKey) {
    console.error("AGENT_PRIVATE_KEY not set")
    process.exit(1)
  }

  const apiKey = process.env.RELAYER_API_KEY
  const apiKeyAddress = process.env.RELAYER_API_KEY_ADDRESS

  if (!apiKey || !apiKeyAddress) {
    console.error("RELAYER_API_KEY and RELAYER_API_KEY_ADDRESS must be set in .env.local")
    process.exit(1)
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(key as `0x${string}`)
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-bor-rpc.publicnode.com"

  console.log("=== DEPLOYING POLYMARKET DEPOSIT WALLET ===\n")
  console.log("Owner EOA:", account.address)
  console.log("Relayer URL:", RELAYER_URL)
  console.log("Polygon RPC:", polygonRpc)
  console.log()

  // Step 1: Check implementation slot on-chain
  console.log("Checking proxy implementation slot on-chain...")
  console.log("Proxy address:", KNOWN_PROXY)

  const implValue = await checkImplementationSlot(polygonRpc, KNOWN_PROXY)
  console.log("Implementation slot value:", implValue)

  if (implValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("\nProxy is already deployed with implementation!")
    console.log("\nThe proxy wallet is ready to use.")
    console.log("\nUpdate packages/sdk/src/polymarket.ts:")
    console.log('   import { SignatureTypeV2 } from "@polymarket/clob-client-v2"')
    console.log('   signatureType: SignatureTypeV2.POLY_1271,')
    console.log(`   funderAddress: "${KNOWN_PROXY}",`)
    return
  }

  console.log("\nImplementation slot is 0x0 — proxy needs deployment via relayer.")

  // Step 2: Create wallet client for signing
  const signer = createWalletClient({
    account,
    chain: polygon,
    transport: http(polygonRpc),
  })

  // Step 3: Initialize RelayClient
  // We'll monkey-patch the httpClient to add API key headers
  const relayClient = new RelayClient(
    RELAYER_URL,
    polygon.id,
    signer,
    undefined,
    RelayerTxType.PROXY // Use PROXY type for deposit wallets
  )

  // Override the httpClient.send method to add API key headers
  const originalSend = relayClient.httpClient.send.bind(relayClient.httpClient)
  relayClient.httpClient.send = async function(endpoint: string, method: string, options?: any) {
    if (!options) options = {}
    if (!options.headers) options.headers = {}
    options.headers["RELAYER_API_KEY"] = apiKey
    options.headers["RELAYER_API_KEY_ADDRESS"] = apiKeyAddress
    return originalSend(endpoint, method, options)
  }

  // Step 4: Check if deposit wallet exists
  console.log("\nChecking if deposit wallet is deployed via relayer...")
  try {
    const isDeployed = await relayClient.getDeployed(account.address, "WALLET")
    console.log("Relayer reports deployed:", isDeployed)

    if (isDeployed) {
      console.log("\nRelayer says wallet exists, but implementation slot is 0x0.")
      console.log("This suggests the wallet was created but not properly initialized.")
      console.log("\nTrying to deploy deposit wallet anyway...")
    }
  } catch (err) {
    console.log("Could not check deployed status:", err instanceof Error ? err.message : err)
  }

  // Step 5: Deploy deposit wallet
  console.log("\nDeploying deposit wallet via relayer...")

  try {
    const response = await relayClient.deployDepositWallet()
    console.log("\nDeployment transaction submitted!")
    console.log("Transaction ID:", response.transactionID)
    console.log("Initial state:", response.state)

    // Step 6: Poll until confirmed
    console.log("\nWaiting for confirmation (polling every 5s, max 60 attempts)...")
    const confirmedTx = await relayClient.pollUntilState(
      response.transactionID,
      [RelayerTransactionState.STATE_CONFIRMED],
      RelayerTransactionState.STATE_FAILED,
      60,
      5000
    )

    if (confirmedTx) {
      console.log("\n=== DEPOSIT WALLET DEPLOYED ===")
      console.log("Transaction Hash:", confirmedTx.transactionHash)
      console.log("Proxy Address:", confirmedTx.proxyAddress || KNOWN_PROXY)

      // Verify implementation slot
      console.log("\nVerifying proxy implementation slot...")
      const newImplValue = await checkImplementationSlot(polygonRpc, confirmedTx.proxyAddress || KNOWN_PROXY)
      console.log("Implementation slot value:", newImplValue)

      if (newImplValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log("\n✓ Proxy is now deployed with implementation!")
        console.log("\n=== NEXT STEPS ===")
        console.log("1. Fund deposit wallet with USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)")
        console.log("2. Update packages/sdk/src/polymarket.ts:")
        console.log('   import { SignatureTypeV2 } from "@polymarket/clob-client-v2"')
        console.log('   signatureType: SignatureTypeV2.POLY_1271,')
        console.log(`   funderAddress: "${confirmedTx.proxyAddress || KNOWN_PROXY}",`)
        console.log("3. Run: npx tsx scripts/broadcast-one-order.ts --confirm-real-money")
      } else {
        console.log("\n⚠ Proxy deployed but implementation slot is still 0x0")
        console.log("This may indicate an issue with the deployment.")
      }
    } else {
      console.error("\nDeployment did not reach STATE_CONFIRMED within timeout.")
      console.error("Check transaction status manually with transaction ID:", response.transactionID)

      const txStatus = await relayClient.getTransaction(response.transactionID)
      console.log("Current transaction status:", JSON.stringify(txStatus, null, 2))
    }
  } catch (err) {
    console.error("\nDeployment failed:", err instanceof Error ? err.message : err)

    if (err instanceof Error) {
      if (err.message.includes("401") || err.message.includes("403")) {
        console.error("\nAuthentication failed. Check RELAYER_API_KEY in .env.local")
      } else if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch")) {
        console.error("\nConnection failed. The relayer may be unreachable.")
      }
    }

    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message)
  process.exit(1)
})
