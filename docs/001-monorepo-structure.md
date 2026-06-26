# ADR 001: TypeScript monorepo with pnpm + Foundry contracts

**Status:** accepted
**Date:** 2026-05-26
**Author:** Emmanuel
**Supersedes:** none

---

## Context

Stoa spans four distinct runtime concerns: Solidity smart contracts on Arc, a TypeScript stack (SDK, frontend, API routes, indexer, persona daemon), a Python SDK (Phase 1 P1.2), and shared schemas that have to stay byte-stable across both SDKs because they're used in keccak256 hashing of the trace canonical JSON.

Three forces pushed the structure decision during the hackathon:

1. **Cross-cutting changes are the norm, not the exception.** Adding a contract event means: updating the Solidity, regenerating ABIs, updating the indexer to parse the new event, updating the SDK to expose it, updating the frontend to display it, updating the shared types so both TS and Py SDKs see it the same way. That's six packages touched in one logical change. Any structure that turns this into six coordinated PRs across six repos is friction the team cannot afford.

2. **The trace canonical JSON must hash to the same value from TS and Python.** This is a non-negotiable design property (CLAUDE.md §X.10, §7.1). If the TS SDK and the Python SDK drift on field ordering, whitespace normalization, or schema versioning, every trace published from a Python agent verifies differently than the same logical trace published from a TS agent. Hash-stable serialization requires one authoritative schema definition with both SDKs reading from it.

3. **Single-founder velocity.** One person is making every decision and writing every line of code for the first 90 days. The fastest setup is the one where `git clone` brings down everything, `pnpm install && forge install` makes everything buildable, and one PR can land an end-to-end feature.

The team needed to decide the repo layout, the JavaScript package manager, and the Solidity tooling — all before the 14-day hackathon clock ran out.

## Decision

**Single monorepo, pnpm for TypeScript packages, Foundry for Solidity contracts, uv for the Python SDK.**

Layout:

```
stoa/
├── apps/
│   ├── web/                  # Next.js frontend (landing + app)
│   └── api/                  # Next.js API routes
├── packages/
│   ├── sdk-ts/               # @stoa-agents/sdk
│   ├── sdk-py/               # stoa-sdk (Python, ships Phase 1 P1.2)
│   ├── contracts/            # Foundry project
│   ├── daemon/               # Persona daemon
│   ├── indexer/              # TracePublished event indexer
│   ├── classifier/           # DeepSeek persona classification worker
│   └── shared/               # Shared TS types + JSON Schema (authoritative for both SDKs)
├── docs/
│   ├── adr/                  # This file lives here
│   ├── roadmap.md
│   └── footguns.md           # Emergent operational gotchas (CLAUDE.md §X.8)
├── scripts/
├── .github/workflows/        # CI: lint, test, deploy
├── CLAUDE.md
├── pnpm-workspace.yaml
└── README.md
```

Concrete choices inside the decision:

- **pnpm**, not npm or yarn. Faster install, content-addressable disk store, stricter dependency hoisting.
- **Foundry**, not Hardhat. Faster test cycles, native Solidity test syntax, better fuzzing and invariant testing, the de-facto standard for new EVM projects in 2026.
- **viem** as the canonical TypeScript Ethereum client. ethers only where viem has explicit gaps.
- **Pydantic v2** for Python schemas. The JSON Schema in `packages/shared/` is the source of truth; Python types are generated from it.
- **One `package.json` per workspace package**, hoisted dependencies managed by pnpm's strict mode.
- **TypeScript project references** for incremental builds across packages, no Nx or Turborepo yet.

## Alternatives considered

**Polyrepo (one repo per language or per concern).** Rejected. The cross-cutting change pattern would force coordinated PRs across multiple repos for every meaningful feature. With a single founder, that's a recipe for drift and stale branches. Polyrepo can make sense at 20+ engineers; not at 1.

**Monorepo with npm workspaces.** Rejected. npm's workspace handling is functional but slow, and pnpm's symlink-based node_modules layout is significantly more robust on large monorepos.

**Monorepo with yarn (classic) workspaces.** Rejected. Yarn classic is unmaintained; yarn berry is plausible but pnpm has won mindshare in 2025–2026 for monorepo tooling.

**Hardhat for contracts.** Rejected. Hardhat's TypeScript-first test environment was attractive in 2021, but Foundry's native Solidity tests, faster execution, and better fuzzing have made it the obvious choice for new projects. Foundry's `forge script` deploys are also cleaner than Hardhat's deploy plugin ecosystem.

**Nx or Turborepo for build orchestration.** Deferred. At current scale, pnpm's filter syntax plus GitHub Actions path filters is enough. Revisit when build times routinely exceed 60 seconds or when there are 3+ contributors.

**Bun as a Node.js replacement.** Considered, deferred. Bun's package management and test runner are promising but the ecosystem isn't ready for production crypto infrastructure as of mid-2026. Revisit in 6 months.

## Consequences

**Positive:**

- One PR can land contract + SDK + frontend changes atomically. The "add an event end-to-end" workflow is one commit, one CI run, one deploy.
- Shared types in `packages/shared/` prevent SDK drift. The JSON Schema is authoritative; both SDKs read it.
- Single CI pipeline. Single deploy workflow on Vercel. Single dependency graph to reason about.
- New contributors (or future-Emmanuel returning to a cold subsystem) clone one repo and get the full picture.
- Documentation lives next to code, which makes it more likely to stay current. ADRs in `docs/adr/` live where engineers actually look.

**Negative:**

- Repo size grows over time. After 12–18 months this may become friction; mitigation is shallow clones and CI caching, neither expensive to set up.
- CI must be careful to test only changed packages. pnpm's filter syntax handles this; GitHub Actions path filters layer on top. Adds some YAML complexity.
- Local development requires the full toolchain: Node 20+, pnpm, Foundry, Python 3.11+, uv. Worth documenting in `CONTRIBUTING.md` so external contributors don't get stuck.
- If/when Stoa hires a contracts-only specialist, the monorepo's polyglot nature may justify a sub-repo split for contracts. Defer that decision until the second engineer joins.
- Foundry is fast-moving. Pinning a specific version in `foundry.toml` is essential; CI uses `foundry-rs/foundry-toolchain@v1` with an explicit version tag.

**Reversibility:** This is partially reversible. Splitting `packages/contracts/` into its own repo later is straightforward (git filter-repo, update CI references). Splitting the Python SDK out is similar. Splitting the TS SDK is harder because of the shared types dependency — that would require either duplicating the shared schema (bad) or extracting it into a published npm package (acceptable). Don't unwind without strong justification.

## References

- pnpm workspaces: `pnpm.io/workspaces`
- Foundry book: `book.getfoundry.sh`
- uv (Python env manager): `docs.astral.sh/uv`
- viem docs: `viem.sh`
- CLAUDE.md §2.2 (Directory structure)
- CLAUDE.md §4.1 (Stack reference)
- CLAUDE.md §4.2 (Code style & naming)

## Open questions

- When does the indexer need to leave Vercel cron functions for a dedicated host (Railway, Fly.io)? Likely answer: when Phase 4 CCTP V2 sweep keeper (CLAUDE.md §X.3) needs sub-2-minute lag and cron's per-invocation execution limits become a constraint.
- Does the Python SDK need its own changelog and release branch flow, or can it ride the monorepo's release tags with `sdk-py@vX.Y.Z`-style prefixed tags? Default to prefixed tags until volume justifies a separate flow.
