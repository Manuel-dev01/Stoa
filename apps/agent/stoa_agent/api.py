from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from stoa_agent.chain.client import ArcClient
from stoa_agent.config import Settings, load_settings
from stoa_agent.errors import ArcSubmitError, GammaApiError, IrysUploadError, TradingAgentsInferenceError
from stoa_agent.polymarket.gamma import get_market
from stoa_agent.reasoning.runner import run_inference
from stoa_agent.schemas import GenerateTraceRequest, GenerateTraceResponse, Trace, TraceDecision, TraceMarket, TraceModelMetadata, TraceReasoning
from stoa_agent.storage.irys import compute_trace_hash, upload_trace

settings: Settings
arc_client: ArcClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    global settings, arc_client
    settings = load_settings()
    os.environ["DEEPSEEK_API_KEY"] = settings.deepseek_api_key
    arc_client = ArcClient(settings)
    yield


app = FastAPI(title="Stoa Agent", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/traces", response_model=GenerateTraceResponse)
async def create_trace(req: GenerateTraceRequest) -> GenerateTraceResponse:
    # 1. Fetch market details from Gamma API
    try:
        market = await get_market(req.market_id)
    except GammaApiError as e:
        raise HTTPException(status_code=502, detail=f"gamma: {e}")

    if market.condition_id.lower() != req.market_id.lower():
        raise HTTPException(
            status_code=400,
            detail=f"market ID mismatch: requested {req.market_id}, got {market.condition_id}",
        )

    # 2. Run TradingAgents inference
    try:
        inference = run_inference(market)
    except TradingAgentsInferenceError as e:
        raise HTTPException(status_code=502, detail=f"inference: {e}")

    # 3. Build trace JSON
    from datetime import datetime, timezone

    if settings.agent_id is None:
        raise HTTPException(status_code=400, detail="AGENT_ID not set in .env.local")

    trace = Trace(
        agent_id=settings.agent_id,
        market_id=req.market_id,
        generated_at=datetime.now(timezone.utc),
        market=TraceMarket(
            question=market.question,
            resolution_at=None,
        ),
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

    # 4. Upload to Irys
    try:
        irys_receipt = await upload_trace(trace_dict, settings)
    except IrysUploadError as e:
        raise HTTPException(status_code=502, detail=f"irys: {e}")

    # 5. Hash the canonicalized JSON
    trace_hash = compute_trace_hash(trace_dict)

    # 6. Publish to Arc
    try:
        arc_tx_hash = arc_client.publish_trace(
            agent_id=settings.agent_id,
            market_id=req.market_id,
            trace_hash=trace_hash,
            rating=inference["rating"],
            confidence_bps=inference["confidence_bps"],
            irys_receipt=irys_receipt,
        )
    except ArcSubmitError as e:
        raise HTTPException(status_code=502, detail=f"arc: {e}")

    return GenerateTraceResponse(
        trace_hash=trace_hash,
        irys_receipt=irys_receipt,
        arc_tx_hash=arc_tx_hash,
    )
