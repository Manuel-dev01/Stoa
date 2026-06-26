"""The Triad — Stoa's three persistent-memory reasoning engines.

  Quantec    — structural data; episodic regime-loop memory.
  Bayesian   — time-series/sentiment; rolling prompt→outcome vector memory.
  Calibrator — metacognitive; penalizes prior-wrong agents, applies fractional Kelly.

The orchestrator runs all three over one market and returns a single
cross-calibrated synthesis — the object the x402-gated feed serves.
"""

from stoa_agent.triad.orchestrator import run_triad_for_market

__all__ = ["run_triad_for_market"]
