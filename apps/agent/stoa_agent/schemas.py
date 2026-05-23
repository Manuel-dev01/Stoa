from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TraceReasoning(BaseModel):
    bull: str
    bear: str
    synthesis: str


class TraceDecision(BaseModel):
    rating: int = Field(ge=-3, le=3)
    confidence_bps: int = Field(ge=0, le=10000)
    size_usdc: float = 0.0


class TraceModelMetadata(BaseModel):
    framework: str = "tradingagents-v0.6.0"
    quick_think_model: str = "deepseek-chat"
    deep_think_model: str = "deepseek-chat"


class TraceMarket(BaseModel):
    question: str
    venue: Literal["polymarket", "kalshi"] = "polymarket"
    resolution_at: datetime | None = None


class Trace(BaseModel):
    schema_version: Literal["stoa.trace.v1"] = "stoa.trace.v1"
    agent_id: str = Field(pattern=r"^0x[a-f0-9]{64}$")
    market_id: str = Field(pattern=r"^0x[a-f0-9]{64}$")
    generated_at: datetime
    market: TraceMarket
    reasoning: TraceReasoning
    decision: TraceDecision
    model_metadata: TraceModelMetadata


class GenerateTraceRequest(BaseModel):
    market_id: str
    agent_id: str | None = None  # override default agent_id from config


class GenerateTraceResponse(BaseModel):
    trace_hash: str
    irys_receipt: str
    arc_tx_hash: str
