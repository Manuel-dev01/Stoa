# Day 9 — May 23

## Polymarket POLY_1271 broadcast — dead end

Extensive debugging of the CLOB API's handling of POLY_1271 (smart contract wallet) orders. Every attempt rejected with "the order signer address has to be the address of the API KEY" — fires before signature validation.

### What was tested

- TS SDK with `ClobClient` configured for POLY_1271, `funderAddress` set to agent EOA
- Raw HTTP POST to `clob.polymarket.com/order` with manually constructed payload
- Python SDK with same configuration
- Every combination of signer (EOA, proxy) and maker (EOA, proxy) addresses
- Both `createApiKey` and `deriveApiKey` flows

### Root cause

The CLOB API enforces that the `signer` field in the order matches the API key's registered address. For POLY_1271 orders, the signer is the proxy wallet address. But the API key was derived from the EOA, not the proxy. The API rejects the order at the HTTP level before ever checking the EIP-1271 signature.

The proxy wallet at `0xC9dC89f3f15E02319Eea18647b2Daa8Fb1D87A1a` has an ERC-1967 implementation slot of `0x0` — it was not deployed through Polymarket's official relayer flow. The Polymarket UI created it via a different path that doesn't set up the implementation properly.

### Resolution path

1. Access Polymarket's relayer API from an unrestricted network environment to deploy a proper proxy via `WALLET-CREATE`
2. Or use Builder API credentials (separate from CLOB trading API) which may have different signer validation

### Archive

Full details in `docs/archive/phase-2-polymarket-broadcast.md`.
