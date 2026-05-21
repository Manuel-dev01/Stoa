# Day 8 — May 23

## Polymarket V2 proxy wallet — resolved

The "maker address not allowed, please use the deposit wallet flow" error is resolved. The proxy wallet already existed — Polymarket's UI created it when the agent EOA first deposited.

### Proxy wallet

**Address:** `0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a`
**Owner EOA:** `0x5b92F8A222704d522Fb3dCf8d734C3DAF51Fc4f1` (AGENT_PRIVATE_KEY)
**Factory:** `0x00000000000Fb5C9ADea0298D729A0CB3823Cc07` (DepositWalletFactory)
**Contract type:** ERC-1967 minimal proxy (Solady LibClone)
**Relayer confirmation:** `GET https://relayer-v2.polymarket.com/deployed?address=0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a&type=WALLET` returns `{"deployed": true}`

**How it was found:** Queried the Polygonscan API for the agent EOA's transaction history. Found a 3 USDC.e transfer (tx `0xafff5ddc997a0283e6c5106748c9f632433750872f46b2d8e7a4a8b5888da284`, block 87188177, May 20) from the EOA to this address. Verified via the relayer API that it's a deployed Polymarket deposit wallet. The factory contract was confirmed as `DepositWalletFactory` deployed by "Polymarket: Deployer 1".

### Working ClobClient V2 config

```typescript
const PROXY = '0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a';

// API credentials derived from agent EOA (NOT the old signing wallet)
const creds = {
  key: '7a658867-2edc-cc92-7c35-9f36475cda38',
  secret: 'sPE9lD0JpLiJMg0XWFa11f21oxCkD4blayK-xH1m5is=',
  passphrase: '4a7972c29264098d3a9d3e1a207c61869f23c7d1e912ab3819fc88b23d036b9d',
};

const client = new ClobClient({
  host: 'https://clob.polymarket.com',
  chain: 137,
  signer,  // agent EOA wallet client
  creds,
  signatureType: SignatureTypeV2.POLY_1271,  // value 3
  funderAddress: PROXY,
  builderConfig: { builderCode: '0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6' },
});
```

Key details:
- `signatureType: 3` (POLY_1271) — the contract-wallet signature type
- `funderAddress` = proxy wallet address (where funds live and orders execute from)
- `signer` = agent EOA private key (signs on behalf of the proxy under ERC-1271)
- API credentials must be derived from the agent EOA, not the old signing wallet

### CTFExchangeV2 allowance — already set

The proxy wallet has MAX_UINT256 approvals already set for all three exchange contracts:
- CTFExchangeV2 (`0xE111180000d2663C0091e4f400237545B87B996B`): max approval
- NegRiskAdapter (`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`): max approval
- NegRiskCTFExchange (`0xe2222d279d744050d28e00520010520000310F59`): max approval

No approval transaction needed.

### Dry-run order — signed successfully

Signed order payload (no broadcast):
```json
{
  "salt": "876761313908",
  "maker": "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a",
  "signer": "0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a",
  "tokenId": "98022490269692409998126496127597032490334070080325855126491859374983463996227",
  "makerAmount": "50000",
  "takerAmount": "1000000",
  "side": "BUY",
  "signatureType": 3,
  "builder": "0xb4ac2a08f05f338f7f44db453902ad8ed287ca352047051d543152a96dcd66e6",
  "timestamp": "1779323705130",
  "expiration": "0",
  "signature": "0x6a3cfecb..."
}
```

Assertions passed:
- `maker` = proxy wallet address
- `signer` = proxy wallet address
- `signatureType` = 3 (POLY_1271)
- `builder` = registered builder code
- Signature valid (order constructed and signed without error)

### Remaining blocker: proxy wallet balance

The proxy wallet has 0 pUSD balance. The original 3 USDC.e deposit was likely consumed by earlier trading activity. To broadcast a real order:

1. Fund the proxy wallet with pUSD (not USDC.e — Polymarket V2 uses pUSD as collateral)
2. pUSD address: `0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB`
3. Send pUSD directly to the proxy wallet address: `0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a`
4. After funding, sync the CLOB balance cache: `GET /balance-allowance/update?asset_type=COLLATERAL&signature_type=3`

No approval transaction is needed (already set to max). The only real tx required is funding the proxy wallet with pUSD.

### Technical notes

- `npx tsx` hangs on network calls in this environment. Use `node --import tsx` instead for scripts that make HTTP requests.
- The CLOB API requires HMAC-SHA256 authentication with base64url encoding. The SDK handles this automatically.
- Polymarket V2 uses pUSD (`0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB`), not USDC.e directly. The `CollateralOnramp` contract handles conversion.
- The old signing wallet (`0x3F60d48E...`) has separate CLOB credentials that don't work with the agent EOA's proxy wallet.

### Files changed
- `docs/journal/day-08.md` — this file
- `docs/refactor-backlog.md` — updated proxy wallet status

### What this unblocks

The Polymarket V2 routing pipeline is now fully configured. The only remaining step before a real broadcast is funding the proxy wallet with pUSD. Once funded, the order flow is:
1. Sign order with POLY_1271 config (proxy as maker/funder, agent EOA as signer)
2. Post to CLOB
3. Builder fee accrues to `0xb4ac2a08...` on fill
