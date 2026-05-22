from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import httpx

from stoa_agent.chain.client import ArcClient
from stoa_agent.config import Settings
from stoa_agent.errors import (
    ArcSubmitError,
    GammaApiError,
    IrysUploadError,
)
from stoa_agent.polymarket.gamma import Market, get_active_markets
from stoa_agent.reasoning.runner import run_inference_direct
from stoa_agent.schemas import (
    Trace,
    TraceDecision,
    TraceMarket,
    TraceModelMetadata,
    TraceReasoning,
)
from stoa_agent.storage.irys import compute_trace_hash, upload_trace


def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


class AgentLoop:
    def __init__(
        self,
        settings: Settings,
        interval_seconds: int = 600,
        min_liquidity: float = 5000,
        min_confidence_bps: int = 5000,
        max_markets_per_cycle: int = 3,
    ) -> None:
        self._settings = settings
        self._interval = interval_seconds
        self._min_liquidity = min_liquidity
        self._min_confidence_bps = min_confidence_bps
        self._max_markets = max_markets_per_cycle
        self._arc_client = ArcClient(settings)
        self._published: set[str] = set()
        self._cycle_count = 0

    async def run(self) -> None:
        await self._load_state()
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

        try:
            all_markets = await get_active_markets(
                min_liquidity=self._min_liquidity, limit=50
            )
        except GammaApiError as e:
            _log(f"ERROR: Gamma API failed: {e}")
            return

        available = [
            m for m in all_markets
            if m.condition_id.lower() not in self._published
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
        _log(f"Analyzing: {market.question} (liquidity=${market.liquidity:,.0f})")

        try:
            inference = await asyncio.to_thread(run_inference_direct, market)
        except Exception as e:
            _log(f"ERROR: Inference failed for '{market.question}': {e}")
            return "error"

        if inference["confidence_bps"] < self._min_confidence_bps:
            _log(f"Skipping: confidence {inference['confidence_bps'] / 100:.0f}% below threshold {self._min_confidence_bps / 100:.0f}%")
            return "skipped"

        trace = Trace(
            agent_id=self._settings.agent_id,
            market_id=market.condition_id,
            generated_at=datetime.now(timezone.utc),
            market=TraceMarket(question=market.question, resolution_at=None),
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
            return "error"

        trace_hash = compute_trace_hash(trace_dict)

        try:
            arc_tx = await asyncio.to_thread(
                self._arc_client.publish_trace,
                agent_id=self._settings.agent_id,
                market_id=market.condition_id,
                trace_hash=trace_hash,
                rating=inference["rating"],
                confidence_bps=inference["confidence_bps"],
                irys_receipt=irys_receipt,
            )
            _log(f"Arc tx: {arc_tx}")
        except ArcSubmitError as e:
            _log(f"ERROR: Arc publish failed: {e}")
            return "error"

        self._published.add(market.condition_id.lower())
        _log(f"PUBLISHED: {market.question} | rating={inference['rating']:+d} confidence={inference['confidence_bps'] / 100:.0f}%")
        return "published"

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
