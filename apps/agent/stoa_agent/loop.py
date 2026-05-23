from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone

import httpx

from stoa_agent.chain.client import create_client, ArcClient
from stoa_agent.config import Settings
from stoa_agent.storage.supabase import get_agent_wallet
from stoa_agent.errors import (
    ArcSubmitError,
    GammaApiError,
    IrysUploadError,
)
from stoa_agent.polymarket.gamma import Market, get_active_markets
from stoa_agent.kalshi.client import get_kalshi_markets
from stoa_agent.reasoning.runner import run_inference_direct
from stoa_agent.schemas import (
    Trace,
    TraceDecision,
    TraceMarket,
    TraceModelMetadata,
    TraceReasoning,
)
from stoa_agent.storage.irys import compute_trace_hash, upload_trace


def _to_bytes32(value: str) -> str:
    """Convert a string to a bytes32 hex value using Keccak-256."""
    # Python's hashlib.sha3_256 is NOT Keccak-256. Use pysha3 or manual impl.
    # For simplicity, use the same approach as the Solidity contract: abi.encodePacked + keccak256
    from eth_utils import keccak
    return "0x" + keccak(text=value).hex()


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


class AgentLoop:
    _MAX_FAILURES = 3  # skip markets that have failed this many times

    def __init__(
        self,
        settings: Settings,
        interval_seconds: int = 600,
        min_liquidity: float = 5000,
        min_confidence_bps: int = 5000,
        max_markets_per_cycle: int = 5,
        persona: str | None = None,
    ) -> None:
        self._settings = settings
        self._interval = interval_seconds
        self._min_liquidity = min_liquidity
        self._min_confidence_bps = min_confidence_bps
        self._max_markets = max_markets_per_cycle
        self._persona = persona or settings.agent_persona or None
        self._arc_client = create_client(settings)
        # Fallback: direct ArcClient if Circle fails and agent has a private key
        self._arc_fallback: ArcClient | None = None
        if settings.use_circle_wallets and settings.agent_private_key:
            try:
                self._arc_fallback = ArcClient(settings)
            except Exception:
                pass
        self._published: set[str] = set()
        self._failed: dict[str, int] = {}  # condition_id -> failure count
        self._cycle_count = 0
        self._agent_wallet_id: str | None = None  # resolved on first cycle

    def _resolve_agent_wallet(self) -> None:
        """Look up per-agent Circle wallet from Supabase. Cached for the session."""
        agent_id = self._settings.agent_id
        if not agent_id or not self._settings.use_circle_wallets:
            return
        try:
            wallet = get_agent_wallet(self._settings, agent_id)
            if wallet:
                self._agent_wallet_id = wallet["wallet_id"]
                _log(f"Using per-agent Circle wallet: {self._agent_wallet_id}")
            else:
                _log("No per-agent wallet found, using global CIRCLE_WALLET_ID.")
        except Exception as e:
            _log(f"Warning: Could not look up agent wallet: {e}")

    async def run(self) -> None:
        await self._load_state()
        self._resolve_agent_wallet()
        _log(f"Agent {self._settings.agent_id} starting. {len(self._published)} markets already published.")
        _log(f"Config: interval={self._interval}s, min_confidence={self._min_confidence_bps / 100:.0f}%, max_markets={self._max_markets}")

        while True:
            self._cycle_count += 1
            try:
                await self._cycle()
            except Exception as e:
                _log(f"FATAL: Cycle {self._cycle_count} failed: {e}")
            _log(f"Sleeping {self._interval}s until next cycle...")
            await asyncio.sleep(self._interval)

    async def _cycle(self) -> None:
        _log(f"Cycle {self._cycle_count} starting.")

        # Fetch from both Polymarket Gamma and Kalshi
        polymarket_markets: list[Market] = []
        kalshi_markets: list[Market] = []

        try:
            polymarket_markets = await get_active_markets(
                min_liquidity=self._min_liquidity, limit=30
            )
        except GammaApiError as e:
            _log(f"WARNING: Gamma API failed: {e}")

        try:
            kalshi_markets = await get_kalshi_markets(limit=30)
        except Exception as e:
            _log(f"WARNING: Kalshi API failed: {e}")

        all_markets = polymarket_markets + kalshi_markets
        if not all_markets:
            _log("No markets available from any source.")
            return

        _log(f"Fetched {len(polymarket_markets)} Polymarket + {len(kalshi_markets)} Kalshi markets.")

        available = [
            m for m in all_markets
            if m.condition_id.lower() not in self._published
            and self._failed.get(m.condition_id.lower(), 0) < self._MAX_FAILURES
        ]

        selected = self._select_markets(available)
        _log(f"{len(all_markets)} markets available, {len(available)} not yet published, {len(selected)} selected.")

        published = 0
        skipped = 0
        errors = 0

        for market in selected:
            result = await self._process_market(market)
            if result == "published":
                published += 1
            elif result == "skipped":
                skipped += 1
            else:
                errors += 1

        _log(f"Cycle {self._cycle_count} complete. {published} published, {skipped} skipped, {errors} errors.")

    def _select_markets(self, markets: list[Market]) -> list[Market]:
        scored: list[tuple[float, Market]] = []
        for m in markets:
            score = m.liquidity / 10_000
            if len(m.outcomes) == 2:
                score += 2
            if m.end_date:
                try:
                    from datetime import date
                    end = date.fromisoformat(m.end_date[:10])
                    days_left = (end - date.today()).days
                    if 0 < days_left <= 7:
                        score += 1
                except (ValueError, TypeError):
                    pass
            scored.append((score, m))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in scored[: self._max_markets]]

    async def _process_market(self, market: Market) -> str:
        venue = "kalshi" if market.condition_id.startswith("kalshi:") else "polymarket"
        _log(f"Analyzing [{venue}]: {market.question} (liquidity=${market.liquidity:,.0f})")

        # For Kalshi, hash the ticker to bytes32 for on-chain anchoring
        # For Polymarket, condition_id is already bytes32
        on_chain_market_id = _to_bytes32(market.condition_id) if venue == "kalshi" else market.condition_id

        try:
            inference = await asyncio.to_thread(run_inference_direct, market, self._persona)
        except Exception as e:
            _log(f"ERROR: Inference failed for '{market.question}': {e}")
            self._mark_failed(market.condition_id)
            return "error"

        if inference["confidence_bps"] < self._min_confidence_bps:
            _log(f"Skipping: confidence {inference['confidence_bps'] / 100:.0f}% below threshold {self._min_confidence_bps / 100:.0f}%")
            return "skipped"

        trace = Trace(
            agent_id=self._settings.agent_id,
            market_id=on_chain_market_id,
            generated_at=datetime.now(timezone.utc),
            market=TraceMarket(question=market.question, venue=venue, resolution_at=None),
            reasoning=TraceReasoning(
                bull=inference["bull"],
                bear=inference["bear"],
                synthesis=inference["synthesis"],
            ),
            decision=TraceDecision(
                rating=inference["rating"],
                confidence_bps=inference["confidence_bps"],
            ),
            model_metadata=TraceModelMetadata(),
        )
        trace_dict = trace.model_dump(mode="json")

        try:
            irys_receipt = await upload_trace(trace_dict, self._settings)
            _log(f"Irys receipt: {irys_receipt}")
        except IrysUploadError as e:
            _log(f"ERROR: Irys upload failed: {e}")
            self._mark_failed(market.condition_id)
            return "error"

        trace_hash = compute_trace_hash(trace_dict)

        # Publish on-chain (both Polymarket and Kalshi traces are anchored on Arc)
        arc_tx = None
        try:
            publish_kwargs: dict = dict(
                agent_id=self._settings.agent_id,
                market_id=on_chain_market_id,
                trace_hash=trace_hash,
                rating=inference["rating"],
                confidence_bps=inference["confidence_bps"],
                irys_receipt=irys_receipt,
            )
            if self._agent_wallet_id:
                publish_kwargs["wallet_id"] = self._agent_wallet_id

            arc_tx = await asyncio.to_thread(
                self._arc_client.publish_trace,
                **publish_kwargs,
            )
            _log(f"Arc tx: {arc_tx}")
        except ArcSubmitError as e:
            _log(f"ERROR: Arc publish failed (Circle): {e}")
            # Try direct ArcClient fallback
            if self._arc_fallback:
                _log("Attempting direct ArcClient fallback...")
                try:
                    arc_tx = await asyncio.to_thread(
                        self._arc_fallback.publish_trace,
                        agent_id=self._settings.agent_id,
                        market_id=on_chain_market_id,
                        trace_hash=trace_hash,
                        rating=inference["rating"],
                        confidence_bps=inference["confidence_bps"],
                        irys_receipt=irys_receipt,
                    )
                    _log(f"Arc tx (fallback): {arc_tx}")
                except ArcSubmitError as e2:
                    _log(f"ERROR: Fallback also failed: {e2}")
                    self._mark_failed(market.condition_id)
                    return "error"
            else:
                self._mark_failed(market.condition_id)
                return "error"

        # Write to Supabase directly (indexer will also pick up on-chain events, but this ensures immediate availability)
        # Store original market_id (e.g., "kalshi:KXBTCD-...") for querying, bytes32 is on-chain only
        await self._write_trace_to_supabase(
            trace_hash=trace_hash,
            agent_id=self._settings.agent_id,
            market_id=market.condition_id,
            rating=inference["rating"],
            confidence_bps=inference["confidence_bps"],
            irys_receipt=irys_receipt,
            arc_tx_hash=arc_tx,
            venue=venue,
        )

        self._published.add(market.condition_id.lower())
        # Clear failure count on success
        self._failed.pop(market.condition_id.lower(), None)
        _log(f"PUBLISHED: {market.question} | rating={inference['rating']:+d} confidence={inference['confidence_bps'] / 100:.0f}%")
        return "published"

    def _mark_failed(self, condition_id: str) -> None:
        cid = condition_id.lower()
        self._failed[cid] = self._failed.get(cid, 0) + 1
        count = self._failed[cid]
        if count >= self._MAX_FAILURES:
            _log(f"Market {cid[:16]}... reached {count} failures, will be skipped.")
        else:
            _log(f"Market {cid[:16]}... failure #{count}.")

    async def _load_state(self) -> None:
        url = self._settings.supabase_url
        key = self._settings.supabase_service_role_key
        agent_id = self._settings.agent_id

        if not url or not key or not agent_id:
            _log("Supabase not configured, starting with empty published set.")
            return

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(
                    f"{url}/rest/v1/traces",
                    params={
                        "agent_id": f"eq.{agent_id}",
                        "select": "market_id",
                    },
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                    },
                )
                if resp.status_code != 200:
                    _log(f"Warning: Supabase returned {resp.status_code}, starting fresh.")
                    return

                rows = resp.json()
                self._published = {row["market_id"].lower() for row in rows}
                _log(f"Loaded {len(self._published)} published market IDs from Supabase.")
        except Exception as e:
            _log(f"Warning: Could not load state from Supabase: {e}")

    async def _write_trace_to_supabase(
        self,
        trace_hash: str,
        agent_id: str,
        market_id: str,
        rating: int,
        confidence_bps: int,
        irys_receipt: str,
        arc_tx_hash: str | None,
        venue: str,
    ) -> None:
        url = self._settings.supabase_url
        key = self._settings.supabase_service_role_key
        if not url or not key:
            return

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{url}/rest/v1/traces",
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                        "Prefer": "resolution=merge-duplicates",
                    },
                    json={
                        "trace_hash": trace_hash,
                        "agent_id": agent_id,
                        "market_id": market_id,
                        "rating": rating,
                        "confidence_bps": confidence_bps,
                        "irys_receipt": irys_receipt,
                        "arc_tx_hash": arc_tx_hash or "",
                        "block_number": 0,
                        "published_at": datetime.now(timezone.utc).isoformat(),
                        "venue": venue,
                    },
                )
                if resp.status_code in (200, 201, 204):
                    _log(f"  Supabase trace written ({venue})")
                else:
                    _log(f"  Supabase write failed: {resp.status_code} {resp.text[:100]}")
        except Exception as e:
            _log(f"  Supabase write error: {e}")
