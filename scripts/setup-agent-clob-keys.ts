/**
 * setup-agent-clob-keys.ts
 *
 * Derives Polymarket CLOB API keys from the AGENT_PRIVATE_KEY.
 * These keys are needed for POLY_1271 signature type orders.
 *
 * Usage:
 *   npx tsx scripts/setup-agent-clob-keys.ts
 */

import { ClobClient } from "@polymarket/clob-client-v2";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function generateKeys() {
  // Use AGENT_PRIVATE_KEY for POLY_1271 orders
  const rawKey = process.env.AGENT_PRIVATE_KEY;
  if (!rawKey) {
    console.error("AGENT_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(key as `0x${string}`);
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-bor-rpc.publicnode.com";

  console.log("Deriving CLOB API keys for agent EOA:", account.address);
  console.log("Polygon RPC:", polygonRpc);
  console.log();

  const signer = createWalletClient({ account, transport: http(polygonRpc) });

  const client = new ClobClient({
    host: "https://clob.polymarket.com",
    chain: 137,
    signer,
  });

  try {
    const credentials = await client.createOrDeriveApiKey();
    console.log("=== AGENT CLOB API CREDENTIALS ===\n");
    console.log("Save these to your .env.local file:");
    console.log();
    console.log(`POLYMARKET_AGENT_API_KEY=${credentials.key}`);
    console.log(`POLYMARKET_AGENT_API_SECRET=${credentials.secret}`);
    console.log(`POLYMARKET_AGENT_API_PASSPHRASE=${credentials.passphrase}`);
    console.log();
    console.log("These keys are derived from AGENT_PRIVATE_KEY and will work with POLY_1271 signatures.");
  } catch (err) {
    console.error("Failed to derive API keys:", err instanceof Error ? err.message : err);
    console.error("\nThis might happen if the agent EOA hasn't deposited to Polymarket yet.");
    console.error("Try depositing USDC.e to the proxy wallet first.");
    process.exit(1);
  }
}

generateKeys();
