# Verifying Stoa's On-Chain Receipts

Every claim Stoa makes is verifiable on-chain. The root README cites a deployed contract, a registered agent, and four published reasoning traces, each with an Arc transaction hash and an Irys receipt. This document is the protocol that lets anyone independently confirm those claims using only `cast`, `curl`, and `python3`, no Stoa codebase required, no Stoa-issued credentials, no trust in this README's prose.

If you have 30 seconds, jump to [The one-liner](#the-one-liner). If you have 10 minutes, run the six steps in order.

## Prerequisites

You need:
- `cast` from [Foundry](https://book.getfoundry.sh), Solidity's canonical CLI
- `curl`, standard on every Unix system
- `python3` with standard library only, no external packages required
- An RPC endpoint for the Canteen-hosted Arc testnet, chain ID `5042002`

You can get the Arc testnet RPC two ways:

```bash
# Option A, the Canteen-hosted RPC (requires arc-canteen CLI login)
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
arc-canteen login
source ~/.arc-canteen/env   # exports $RPC

# Option B, Alchemy's Arc testnet endpoint (no Canteen login needed)
export RPC="https://arc-testnet.g.alchemy.com/v2/<your_alchemy_key>"
```

Both endpoints serve the same chain. Alchemy has archive history; the Canteen RPC prunes. If you plan to run Step 4 from genesis, use Alchemy.

## The receipts under verification

| What | Value |
|---|---|
| Network | Arc testnet (chain ID `5042002`) |
| StoaRegistry contract | [`0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b`](https://testnet.arcscan.app/address/0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b) (source verified) |
| StoaTreasury contract | [`0x7408923341F0ab2d66084f5a1957a9bFf0346360`](https://testnet.arcscan.app/address/0x7408923341F0ab2d66084f5a1957a9bFf0346360) (source verified) |
| Deployer wallet | `0xBCA6f82e240C6AC36B23b4f7D21adF17e03966Fe` |
| Agent wallet | `0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1` |
| Canonical agent ID (Day 3, used in the receipts table below) | `0x797badd2de144db6311a1f0f79a2d3e544021a003c7e96544cbc5441901e6be7` |
| Total registered agents | 25 (see `scripts/agents/wallets.json` for the full set) |
| Total traces indexed | 324+ (End of hackathon baseline; growing) |

The four published traces:

| # | Market | Rating | Confidence | Arc tx hash | Irys receipt |
|---|---|---|---|---|---|
| 1 | Will bitcoin hit $1m before GTA VI? | -2 SELL | 65% | `0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845` | `FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp` |
| 2 | Trump out as President before GTA VI? | -2 SELL | 65% | `0x79fa0395bfe44ecb43819c923d272743f9448e28a953cc301cf0f6962bf1cfe6` | `3g2LLiGPbATKPVMfBasogy86XAfkvkrv4xSrNhu8dgas` |
| 3 | Will MegaETH perform an airdrop by June 30? | 0 HOLD | 65% | `0xc10eb2609e1a38dde7bce02fa8e919a6d2bb57edb88f1a2eccb791d12decdf0f` | `3vf4qQtpSUfX93CFu7vasb1XMHrHk7ZwVjvjkk1rerci` |
| 4 | Will England win the 2026 FIFA World Cup? | 0 HOLD | 75% | `0x4feaa3447c53d1c1daae4494618d3a44355ef2f2fcead48fab457e4d3d0c2dd0` | `4vf8fzHpANbZipU5n28FxJXb1A5cNXvDSkV9Cm14dYNH` |

## Step 1, Confirm you're talking to the right chain

```bash
cast block-number --rpc-url $RPC
cast chain-id --rpc-url $RPC
```

**Expected output.** The block number is a positive integer in the tens of millions and the chain ID is exactly `5042002`. Example:

```
43041473
5042002
```

**What it proves.** You're talking to a live RPC connected to Arc testnet. If `chain-id` returns anything other than `5042002`, you're on the wrong network and nothing below this line is meaningful.

## Step 2, Confirm the StoaRegistry contract is deployed

```bash
cast code 0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b --rpc-url $RPC | head -c 100
```

**Expected output.** Real EVM bytecode beginning with `0x6080604052...` (the standard prefix for compiled Solidity contracts). Truncated example:

```
0x608060405234801561000f575f80fd5b506004361061004a575f3560e01c8063...
```

**What it proves.** The contract exists at the claimed address. If this returns just `0x` (empty), there is no contract there and the rest of the protocol is unfalsifiable theatre.

Both `StoaRegistry` and `StoaTreasury` are source-verified on Arcscan, so the same address page renders the full Solidity source, ABI, and decoded inputs for every historical `AgentRegistered`, `TracePublished`, `Subscribed`, and `Redeemed` event:

- StoaRegistry: https://testnet.arcscan.app/address/0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b
- StoaTreasury: https://testnet.arcscan.app/address/0x7408923341F0ab2d66084f5a1957a9bFf0346360

## Step 3, Confirm every claimed transaction exists

Run `cast tx` against each of the six hashes, the deploy, the registration, and four trace publications:

```bash
# Day 2, contract deployment
cast tx 0x9edfdd1f94022e3eb5a1de3ea6c859b84ea1eee1e5c5c563ae0830cfd41728b2 --rpc-url $RPC

# Day 3, agent registration (signed by 0x5b92F8A2...)
cast tx 0x2eb8f92135b71bed043fe339f0812c36c7b7d9357c035881fe5482457108c8a5 --rpc-url $RPC

# Day 3, first trace (BTC)
cast tx 0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845 --rpc-url $RPC

# Day 4 morning, three smoke-test traces
cast tx 0x79fa0395bfe44ecb43819c923d272743f9448e28a953cc301cf0f6962bf1cfe6 --rpc-url $RPC
cast tx 0xc10eb2609e1a38dde7bce02fa8e919a6d2bb57edb88f1a2eccb791d12decdf0f --rpc-url $RPC
cast tx 0x4feaa3447c53d1c1daae4494618d3a44355ef2f2fcead48fab457e4d3d0c2dd0 --rpc-url $RPC
```

**Expected output.** Each returns a key-value blob with `blockHash`, `blockNumber`, `from`, `to`, `input`, signature components, and a non-null transaction index. The `to` field on transactions 3–6 must be `0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b` (the StoaRegistry contract). The deploy transaction's `to` field is empty (contract creation has no recipient).

**What it proves.** Every claimed receipt is a real, mined, signed transaction. The `input` field of each trace transaction contains the on-chain `publishTrace` calldata, including the agent ID, market ID, trace hash, rating, confidence, and Irys receipt, exactly as the README claims.

You can decode any trace transaction's `input` field manually to verify the Irys receipt is embedded literally in the calldata:

```bash
# Decode the input of trace #1 to see the Irys receipt as raw ASCII
cast tx 0x760adefe7a4cf321520384afd0184008dd4d1a6c5a73ee6c3905466939240845 \
  --rpc-url $RPC --json | jq -r .input | tail -c 96 | xxd -r -p
```

You should see `FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp` in plain ASCII inside the calldata.

## Step 4, Confirm the events were emitted

Read the contract's event logs directly. Because the Canteen-hosted RPC prunes history, you cannot query from block `0`; use a recent starting block. The query is also capped at 100,000 blocks per request, so chunk over the range:

```bash
ADDRESS="0x19Ea8a442802065a61c69cbc03bE97724Ad8cd9b"
FROM_BLOCK=42930000
LATEST_BLOCK=$(cast block-number --rpc-url $RPC)
CHUNK=100000

for (( block=$FROM_BLOCK; block<=$LATEST_BLOCK; block+=$CHUNK )); do
    TO_BLOCK=$((block + CHUNK - 1))
    if [ "$TO_BLOCK" -gt "$LATEST_BLOCK" ]; then
        TO_BLOCK=$LATEST_BLOCK
    fi
    echo "Fetching blocks $block to $TO_BLOCK..."
    cast logs --rpc-url $RPC --address $ADDRESS --from-block $block --to-block $TO_BLOCK
done
```

**Expected output.** Six event log entries, distinguishable by their `topics[0]` (the event signature hash):

- **Two `AgentRegistered` events** with `topics[0] = 0x6054c1c53f51c68fd6a5221be39b6060a47666f8773d065cbf723f6c52230b38`. One of these has `topics[1]` matching the canonical agent ID `0x797badd2...`; the other is an earlier registration that remains owned by the same wallet but is unused.
- **Four `TracePublished` events** with `topics[0] = 0xd0bba7ce0d33b8be013de873880428e9fde12ebe03e63fa28e56a3269434fdc3`. Each has `topics[1] = 0x797badd2...` (the canonical agent) and `topics[2]` equal to the Polymarket condition ID of one of the four markets in the receipts table above.

**What it proves.** The contract emitted exactly the events the README claims. Each `TracePublished` event's `data` field contains the trace hash, rating, confidence, timestamp, and Irys receipt, the same payload visible in the transaction calldata from Step 3, now confirmed as having been actually emitted by the contract (not just submitted).

## Step 5, Confirm the Irys bodies are retrievable

```bash
curl -LsI https://gateway.irys.xyz/FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp
curl -LsI https://gateway.irys.xyz/3g2LLiGPbATKPVMfBasogy86XAfkvkrv4xSrNhu8dgas
curl -LsI https://gateway.irys.xyz/3vf4qQtpSUfX93CFu7vasb1XMHrHk7ZwVjvjkk1rerci
curl -LsI https://gateway.irys.xyz/4vf8fzHpANbZipU5n28FxJXb1A5cNXvDSkV9Cm14dYNH
```

**Expected output.** Each command produces a chain of two or three HTTP responses ending in `HTTP/2 200`:
1. First a `HTTP/2 302` redirect from `gateway.irys.xyz` to `devnet.irys.xyz`. All traces in this table were pinned to Irys devnet during the hackathon; mainnet migration is post-submission work and the trace's on-chain hash is the immutable anchor regardless.
2. Then a `HTTP/2 307` redirect from `devnet.irys.xyz` to a CDN host (Irys's content delivery layer).
3. Finally a `HTTP/2 200` response with `content-type: application/json` and a `content-length` of ~17–21 KB (the trace JSON).

If you want the JSON body itself, drop `-I` and add `-L` to follow the redirects:

```bash
curl -sL https://gateway.irys.xyz/FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp | python3 -m json.tool | head -40
```

You should see structured trace JSON with `marketId`, `reasoning.bull`, `reasoning.bear`, `reasoning.synthesis`, `decision.rating`, `decision.confidenceBps`, and `modelMetadata` fields.

**What it proves.** The on-chain Irys receipt actually points at a retrievable JSON document, and the document conforms to the trace schema. Without this step, the chain might be storing a pointer to nothing.

## Step 6, Confirm the on-chain hash equals the Irys body's canonical hash

This is the decisive check. Every other step proves something exists; this one proves the on-chain commitment is genuinely a commitment to the exact body served by Irys, byte for byte. The integrity assertion is bidirectional: a future Stoa cannot quietly substitute a different trace body and pretend the old hash applies, and a Stoa today cannot have backdated the on-chain hash to match an unrelated body.

We verify the BTC trace as a representative example. The on-chain hash for that trace is `0xd8ad17367fcc9e4e65c083e2be2af0d33e26e81326c59b22b1082001082109f1`, readable in the `data` field of the block 42937683 `TracePublished` event.

```bash
# 1. Download the Irys body (follow redirects)
curl -sL https://gateway.irys.xyz/FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp -o /tmp/btc-trace.json

# 2. Canonicalize the JSON exactly as Stoa's agent does, sort_keys, no whitespace separators
python3 -c "import sys, json; json.dump(json.load(open('/tmp/btc-trace.json')), sys.stdout, sort_keys=True, separators=(',', ':'))" > /tmp/canonical.txt

# 3. Compute keccak256 using cast
COMPUTED=$(cast keccak "$(cat /tmp/canonical.txt)")
ONCHAIN="0xd8ad17367fcc9e4e65c083e2be2af0d33e26e81326c59b22b1082001082109f1"

echo "computed hash: $COMPUTED"
echo "on-chain hash: $ONCHAIN"
[ "$COMPUTED" = "$ONCHAIN" ] && echo "match:         True" || echo "match:         False"
```

**Expected output.**

```
computed hash: 0xd8ad17367fcc9e4e65c083e2be2af0d33e26e81326c59b22b1082001082109f1
on-chain hash: 0xd8ad17367fcc9e4e65c083e2be2af0d33e26e81326c59b22b1082001082109f1
match:         True
```

**What it proves.** The on-chain hash is a true cryptographic commitment to the canonical Irys body. The trace served from Irys is identical, to the byte, to what the agent committed to publishing at the moment of the transaction. The integrity assertion isn't an off-chain assurance, it's a mathematical guarantee any third party can re-derive in seconds.

If `match: False`, either the canonicalization formula has drifted (Stoa uses Python's `json.dumps(..., sort_keys=True, separators=(',', ':'))` as the canonical form), or the body has been tampered with after upload. Both would be bugs to surface, not features to live with.

To verify a different trace, swap the Irys receipt in step 1 and the on-chain hash in step 3, read the on-chain hash from the corresponding `TracePublished` event's `data` field (first 32 bytes).

## The one-liner

For judges with no time to run six steps, here is a single block that verifies the BTC trace from end to end. If it prints `verified`, the most important property, on-chain hash equals Irys body, holds.

```bash
curl -sL https://gateway.irys.xyz/FZ9bu7FN6NwwXtQ4DAYaqP8hkGtQ76MKPw3SMXm1QvGp -o /tmp/trace.json && \
  COMPUTED=$(cast keccak "$(python3 -c "import sys, json; json.dump(json.load(open('/tmp/trace.json')), sys.stdout, sort_keys=True, separators=(',', ':'))")") && \
  [ "$COMPUTED" = "0xd8ad17367fcc9e4e65c083e2be2af0d33e26e81326c59b22b1082001082109f1" ] && echo "verified" || echo "FAILED"
```

## Common false positives, things that look like failures but aren't

A few network and RPC behaviours produce alarming outputs that don't actually indicate a problem. Each of these surfaced during the development of this protocol; documenting them keeps verifiers from bailing prematurely.

**HTTP/2 302 from `gateway.irys.xyz` is a redirect, not a 404.** Irys's gateway routes objects to whichever node holds them (mainnet, devnet, dedicated CDN). The 302 response includes a `location:` header pointing at the actual host. Use `curl -L` to follow the chain; the final response should be `HTTP/2 200`. A genuine missing body returns `HTTP/2 404`, not `302`.

**`error code 4444: pruned history unavailable` from a `cast logs` query starting at block 0.** The Canteen-hosted RPC is not an archive node, it prunes state older than its retention window. Use a recent `--from-block` (e.g., a few hundred thousand blocks before the most recent relevant block) or switch to an archive-capable RPC like Alchemy.

**`error code -32602: query exceeds max block range 100000` from a wide `cast logs` query.** The RPC caps single queries at 100,000 blocks. Chunk your query into 100K-block batches, as Step 4 demonstrates.

**`401 Authorization Required` when opening the Canteen RPC URL in a browser.** The path includes an auth token (e.g. `/v1/swrm_…`). Hitting the bare hostname returns 401; including the token in the URL is correct. The 401 is the auth layer working, not a sign the RPC is broken.

**`method not allowed` from a GET request to the Canteen RPC URL with the token.** JSON-RPC requires POST. `cast` and other RPC clients use POST automatically; browsers default to GET, which is invalid. The error is expected and harmless.

## Extending verification

Stoa's receipts will grow as new traces are published and as Phase 2's Polymarket order routing comes online. The protocol scales:

- **For any new trace**: copy the Step 6 block, substitute the new Irys receipt in step 1 and the new on-chain hash in step 3 (read it from the corresponding `TracePublished` event's `data` field).
- **For Polymarket order routing (Phase 2 onwards)**: an additional check will confirm that the `bytes32` builder field on the Polymarket `OrderFilled` event matches the agent's registered ID in StoaRegistry, and that the builder fee in pUSD lands in the registered owner's wallet. That extension will be appended to this document when Phase 2 ships.

Every credibility claim Stoa makes has, or will have, a corresponding line in this protocol. If a future claim cannot be added here, it cannot be made in the README.
