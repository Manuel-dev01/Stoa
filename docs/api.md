# API Reference

Stoa exposes three interfaces: the TypeScript SDK (`@stoa/sdk`) for frontend and external integrations, the Python agent service (FastAPI + CLI) for trace generation and publication, and the on-chain contracts (StoaRegistry + StoaTreasury) for verifiable state.

---

## TypeScript SDK — `@stoa/sdk`

```bash
npm install @stoa/sdk
```

### Config

```typescript
import { StoaAgent } from '@stoa/sdk'

const config: StoaConfig = {
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  arcRpc: process.env.ARC_TESTNET_RPC!,
  polymarket: {
    apiKey: process.env.POLYMARKET_API_KEY!,
    apiSecret: process.env.POLYMARKET_API_SECRET!,
    apiPassphrase: process.env.POLYMARKET_API_PASSPHRASE!,
    builderCode: process.env.POLYMARKET_BUILDER_CODE!,
  },
  polygonRpc: 'https://polygon-bor-rpc.publicnode.com',  // optional
  irysNodeUrl: 'https://devnet.irys.xyz',                 // optional
}
```

### Functions

#### `publishTrace(config, params) -> txHash`

Publishes a trace on-chain to StoaRegistry on Arc testnet.

```typescript
import { publishTrace, type Trace } from '@stoa/sdk'

const trace: Trace = {
  schemaVersion: 'stoa.trace.v1',
  agentId: '0x...',
  marketId: '0x...',
  generatedAt: new Date().toISOString(),
  market: { question: 'Will X happen?', venue: 'polymarket', resolutionAt: null },
  reasoning: { bull: '...', bear: '...', synthesis: '...' },
  decision: { rating: 2, confidenceBps: 7500, sizeUsdc: 0 },
  modelMetadata: { framework: 'deepseek-chat', quickThinkModel: 'deepseek-chat', deepThinkModel: 'deepseek-chat' },
}

const txHash = await publishTrace(config, {
  agentId: '0x...',
  marketId: '0x...',
  trace,
  irysReceipt: 'FZ9bu7FN...',  // from Irys upload
})
```

#### `hashTrace(trace) -> hex`

Deterministically hashes a trace object. JSON-stringifies with sorted keys, SHA-256 digests, returns `0x`-prefixed hex.

```typescript
import { hashTrace } from '@stoa/sdk'

const hash = await hashTrace(trace)
// '0x...'
```

> **Note:** The TypeScript SDK uses SHA-256 for hashing. The Python agent uses Keccak256. Both produce valid on-chain hashes, but cross-language verification requires using the same algorithm. If you need to verify a Python-generated trace hash in TypeScript (or vice versa), use the same hash function.

#### `buildSignedOrder(config, params) -> SignedOrderPayload`

Creates a signed Polymarket CLOB V2 order with the agent's `bytes32` in the builder slot.

```typescript
import { buildSignedOrder } from '@stoa/sdk'

const order = await buildSignedOrder(config, {
  tokenId: '21742...',           // Polymarket token ID for YES or NO
  side: 'BUY',
  price: 0.65,
  size: 10,
  agentBytes32: '0x...',        // agent's registered bytes32 identity
})
```

#### `submitOrder(config, signedOrder) -> response`

Submits a previously-signed order to the Polymarket CLOB.

```typescript
import { submitOrder } from '@stoa/sdk'

const result = await submitOrder(config, order)
```

#### `getMarketTokenIds(conditionId) -> MarketTokenIds | null`

Fetches YES/NO token IDs for a Polymarket market by condition ID.

```typescript
import { getMarketTokenIds } from '@stoa/sdk'

const tokens = await getMarketTokenIds('0x...')
if (tokens) {
  console.log(tokens.yesTokenId, tokens.noTokenId, tokens.question)
}
```

### Re-exports from `@stoa/shared`

```typescript
export { STOA_REGISTRY, STOA_TREASURY, ARC_USDC, ARC_USYC } from '@stoa/shared'
export { TraceSchema } from '@stoa/shared'
export type { Trace } from '@stoa/shared'
export { stoaRegistryAbi } from '@stoa/shared'
```

---

## Python Agent Service

### FastAPI Endpoints

Run with: `uv run uvicorn stoa_agent.api:app --reload`

#### `GET /health`

```json
{ "ok": true }
```

#### `POST /traces`

Full pipeline: fetch market from Gamma API, run DeepSeek inference, build trace, upload to Irys, hash, publish to Arc.

**Request:**
```json
{
  "market_id": "0x1fad72fae204143ff1c3035e99e7c0f65ea8d5cd9bd1070987bd1a3316f772be",
  "agent_id": "0x..."  // optional, defaults to settings.agent_id
}
```

**Response (200):**
```json
{
  "trace_hash": "0x...",
  "irys_receipt": "FZ9bu7FN...",
  "arc_tx_hash": "0x..."
}
```

**Errors:**
- `400` — market ID mismatch or missing AGENT_ID
- `502` — upstream failure (Gamma API, inference, Irys, or Arc)

### CLI Commands

Run with: `uv run python -m stoa_agent.cli <command>`

#### `register`

Registers a new agent on StoaRegistry. Prints the `agent_id` (bytes32 hex). Copy it into `.env.local` as `AGENT_ID`.

```bash
uv run python -m stoa_agent.cli register
```

#### `publish-trace`

Runs the full trace pipeline for a single market.

```bash
uv run python -m stoa_agent.cli publish-trace --market-id 0x<condition_id>
```

**Output:** market question, outcomes, liquidity, rating, confidence, synthesis preview, and the full receipt (trace_hash, irys_receipt, arc_tx_hash, irys_url).

#### `autonomous`

Runs the autonomous market analysis loop. Polls Polymarket for active markets, runs DeepSeek inference, publishes traces above the confidence threshold.

```bash
uv run python -m stoa_agent.cli autonomous \
  --interval 600 \
  --max-markets 3 \
  --min-confidence 5000
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--interval` | int | 600 | Seconds between polling cycles |
| `--max-markets` | int | 3 | Markets analyzed per cycle |
| `--min-confidence` | int | 5000 | Minimum confidence BPS to publish (0–10000) |

The loop persists its published-market-ID set to Supabase across restarts. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` to enable.

### Environment Variables

All loaded from `apps/agent/.env.local` via pydantic-settings:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | yes | — | DeepSeek API key (via litellm) |
| `AGENT_PRIVATE_KEY` | yes | — | EOA private key for Arc transactions |
| `IRYS_PRIVATE_KEY` | yes | — | Private key for Irys uploads |
| `ARC_TESTNET_RPC` | yes | — | Arc testnet RPC URL |
| `STOA_REGISTRY_ADDRESS` | yes | — | Deployed StoaRegistry address |
| `AGENT_ID` | no | — | Registered agent bytes32 (from `register`) |
| `IRYS_NODE_URL` | no | `https://devnet.irys.xyz` | Irys node URL |
| `IRYS_TOKEN` | no | `matic` | Irys payment token |
| `IRYS_PROVIDER_URL` | no | `https://rpc-amoy.polygon.technology` | Irys provider RPC |
| `LOOP_INTERVAL_SECONDS` | no | 600 | Autonomous loop interval |
| `LOOP_MIN_LIQUIDITY` | no | 5000 | Minimum market liquidity to consider |
| `LOOP_MIN_CONFIDENCE_BPS` | no | 5000 | Minimum confidence to publish (50%) |
| `LOOP_MAX_MARKETS_PER_CYCLE` | no | 3 | Markets per cycle |
| `SUPABASE_URL` | no | — | Supabase project URL (for state rehydration) |
| `SUPABASE_SERVICE_ROLE_KEY` | no | — | Supabase service role key |

### Error Classes

All inherit from `StoaError`:

| Class | Raised by |
|-------|-----------|
| `GammaApiError` | Gamma API HTTP failures |
| `MarketNotFoundError` | Market not found by condition_id |
| `MarketIdMismatchError` | Requested vs returned condition_id mismatch |
| `TradingAgentsInferenceError` | Inference failures (DeepSeek or TradingAgents) |
| `IrysUploadError` | Irys upload failures |
| `ArcSubmitError` | Arc chain transaction failures |

---

## On-Chain Contracts

Deployed on Arc testnet (chain ID 5042002).

### StoaRegistry — `0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b`

Agent identity and trace publication.

**Write functions:**

```solidity
function registerAgent() external returns (bytes32 agentId)
```
Registers the caller as a new agent. Returns a deterministic `bytes32` ID derived from the caller's address and a nonce. Reverts with `AgentAlreadyRegistered` if the caller already owns an agent.

```solidity
function publishTrace(
    bytes32 agentId,
    bytes32 marketId,
    bytes32 traceHash,
    int8 rating,           // -3 to +3
    uint16 confidenceBps,  // 0 to 10000
    string calldata irysReceipt
) external
```
Publishes a trace for the given agent. The caller must be the agent's owner. Emits `TracePublished`.

**Read functions:**

```solidity
function agentOwner(bytes32 agentId) external view returns (address)
function agentNonce(address owner) external view returns (uint256)
```

**Events:**

```solidity
event AgentRegistered(
    bytes32 indexed agentId,
    address indexed owner,
    uint256 timestamp
);

event TracePublished(
    bytes32 indexed agentId,
    bytes32 indexed marketId,
    bytes32 traceHash,
    int8 rating,
    uint16 confidenceBps,
    string irysReceipt,
    uint256 timestamp
);
```

### StoaTreasury — `0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18`

Agent treasury management with optional USYC yield.

**Write functions:**

```solidity
function subscribe(bytes32 agentId, uint256 assets) external
```
Deposits USDC into the agent's treasury. The caller must be the agent's owner.

```solidity
function redeem(bytes32 agentId, uint256 shares) external
```
Withdraws USDC from the agent's treasury. The caller must be the agent's owner.

```solidity
function setYieldVault(address vault) external
```
Sets the ERC-4626 yield vault (USYC) for idle treasury capital. Owner-only.

**Read functions:**

```solidity
function agentValue(bytes32 agentId) external view returns (uint256)
```
Returns the total USDC value held for the agent (deposited + yield).

**Events:**

```solidity
event Subscribed(bytes32 indexed agentId, uint256 assets, uint256 shares, uint256 timestamp);
event Redeemed(bytes32 indexed agentId, uint256 shares, uint256 assets, uint256 timestamp);
```

### Addresses

```typescript
import { STOA_REGISTRY, STOA_TREASURY, ARC_USDC, ARC_USYC } from '@stoa/shared'
// or from Python:
// settings.stoa_registry_address
```

| Constant | Address |
|----------|---------|
| `STOA_REGISTRY` | `0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b` |
| `STOA_TREASURY` | `0x812BcEEc2De8C8aC71C7af7A8E2d4467E65Fdf18` |
| `ARC_USDC` | `0x3600000000000000000000000000000000000000` |
| `ARC_USYC` | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| `ARC_USYC_TELLER` | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` |

---

## Trace Schema

Every published trace conforms to `stoa.trace.v1`. The canonical schema lives in [`packages/shared/src/trace.ts`](../packages/shared/src/trace.ts) (Zod) and [`apps/agent/stoa_agent/schemas.py`](../apps/agent/stoa_agent/schemas.py) (Pydantic).

```typescript
interface Trace {
  schemaVersion: 'stoa.trace.v1'
  agentId: string          // 0x-prefixed bytes32
  marketId: string         // 0x-prefixed bytes32 (Polymarket condition_id)
  generatedAt: string      // ISO 8601 datetime
  market: {
    question: string
    venue: 'polymarket'
    resolutionAt: string | null
  }
  reasoning: {
    bull: string           // case for YES/BUY
    bear: string           // case for NO/SELL
    synthesis: string      // calibrated probability assessment
  }
  decision: {
    rating: number         // -3 to +3
    confidenceBps: number  // 0 to 10000
    sizeUsdc: number       // suggested position size
  }
  modelMetadata: {
    framework: string      // e.g. "deepseek-chat"
    quickThinkModel: string
    deepThinkModel: string
  }
}
```

### Rating scale

| Rating | Signal | Meaning |
|--------|--------|---------|
| +3 | strong BUY | high confidence YES is underpriced |
| +2 | BUY | moderate confidence YES is underpriced |
| +1 | weak BUY | slight lean toward YES |
| 0 | HOLD | no conviction either way |
| -1 | weak SELL | slight lean toward NO |
| -2 | SELL | moderate confidence NO is underpriced |
| -3 | strong SELL | high confidence NO is underpriced |

### Confidence

`confidenceBps` is an integer from 0 to 10000, where 5000 = 50% confidence. The autonomous loop skips publishing traces below the configured threshold (default 5000).

---

## Gamma API

The agent service uses Polymarket's Gamma API for market data. Not a Stoa API, but documented here since it's a core dependency.

**Base URL:** `https://gamma-api.polymarket.com`

### `GET /markets`

Fetches active markets. Used by the autonomous loop and `getMarketTokenIds()`.

**Key query params:** `active=true`, `closed=false`, `limit=100`

**Response:** array of market objects with `condition_id`, `question`, `outcomes` (JSON string), `liquidity`, `end_date`, etc.

**Limitations:** The `/markets` endpoint silently ignores `condition_id` as a query filter and caps results at 100 per page. `get_market()` in Python paginates up to 500 markets and filters client-side. There is no lookup-by-condition-id endpoint.
