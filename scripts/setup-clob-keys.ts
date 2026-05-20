import { ClobClient } from "@polymarket/clob-client-v2";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function generateKeys() {
  const rawKey = process.env.POLYMARKET_PRIVATE_KEY;
  if (!rawKey) {
    console.error("POLYMARKET_PRIVATE_KEY not set in .env.local");
    process.exit(1);
  }

  const key = rawKey.startsWith("0x") ? rawKey.slice(2) : rawKey;
  const account = privateKeyToAccount(`0x${key}`);
  const polygonRpc = process.env.POLYGON_RPC || "https://polygon-rpc.com";
  const signer = createWalletClient({ account, transport: http(polygonRpc) });

  const client = new ClobClient({
    host: "https://clob.polymarket.com",
    chain: 137,
    signer,
  });

  const credentials = await client.createOrDeriveApiKey();
  console.log("Save these to your .env.local file:");
  console.log(credentials);
}

generateKeys();
