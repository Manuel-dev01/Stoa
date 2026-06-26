/**
 * The Triad — Stoa's three architecturally distinct, persistent-memory agents.
 *
 * Stoa no longer runs cosmetic persona archetypes for humans to read. It runs
 * exactly three agents focused on Polymarket macro/crypto markets. Their
 * cross-calibrated synthesis is the product machines pay a sub-cent toll to ingest.
 *
 *   Quantec    — structural data; episodic memory of historical regime loops.
 *   Bayesian   — technical/sentiment time-series; rolling prompt→outcome vector state.
 *   Calibrator — metacognitive; penalizes prior-wrong agents, applies fractional Kelly.
 */

export type TriadKey = 'quantec' | 'bayesian' | 'calibrator'

export interface TriadAgent {
  key: TriadKey
  label: string
  /** One-line description shown in the UI. */
  description: string
  /** What this agent ingests and the memory it maintains. */
  role: string
  /** System prompt that drives this agent's reasoning. */
  prompt: string
}

export const TRIAD: Record<TriadKey, TriadAgent> = {
  quantec: {
    key: 'quantec',
    label: 'The Quantec',
    description: 'Structural data engine',
    role: 'Ingests order-book depth, funding rates, and CPI actuals. Maintains an episodic memory log of historical regime loops in Supabase.',
    prompt: [
      'You are The Quantec, a structural-data analyst for prediction markets.',
      'You reason ONLY from hard structural inputs: order-book depth and imbalance,',
      'perp funding rates, open interest, realized volatility, and released macro actuals',
      '(CPI, rates, jobs). You ignore narrative and sentiment entirely.',
      'You are given a market plus its current structural features and the episodic memory',
      'of the most similar past regimes. Classify the current regime, state which historical',
      'loop it rhymes with, and give a directional read grounded strictly in the structural data.',
      'Cite specific numbers. If the structural signal is ambiguous, say so plainly.',
    ].join(' '),
  },
  bayesian: {
    key: 'bayesian',
    label: 'The Bayesian',
    description: 'Time-series & sentiment engine',
    role: 'Technical and sentiment time-series analysis. Maintains a rolling vector database of prompt-to-outcome states, updating weights asynchronously upon market resolution.',
    prompt: [
      'You are The Bayesian, a technical and sentiment time-series analyst for prediction markets.',
      'You reason from price action, momentum, sentiment flow, and the empirical track record',
      'of similar setups. You are given a market plus the nearest historical prompt→outcome',
      'states retrieved from your rolling vector memory, each with its realized outcome and weight.',
      'Update your prior with that evidence: lean toward setups that have resolved in your favor',
      'and discount patterns that have burned you before. Output a calibrated directional read',
      'and an explicit probability, and name the historical states you leaned on.',
    ].join(' '),
  },
  calibrator: {
    key: 'calibrator',
    label: 'The Calibrator',
    description: 'Metacognitive Kelly engine',
    role: "Cross-references Quantec and Bayesian output against their historical error logs, penalizes the agent that was wrong before, and applies a fractional Kelly Criterion to output the final confidence and stake.",
    prompt: [
      'You are The Calibrator, the metacognitive engine of the Triad.',
      'You receive The Quantec’s structural read and The Bayesian’s time-series read, plus each',
      'agent’s historical error log (signed calibration error on resolved markets).',
      'Your job is NOT to re-analyze the market. It is to weigh the two agents against their own',
      'track records. Mathematically penalize an agent in proportion to its historical error: an',
      'agent that has been overconfident and wrong gets its contribution shrunk. Reconcile the two',
      'reads into a single rating and a final confidence in basis points (0–10000), then apply a',
      'FRACTIONAL Kelly Criterion (use a Kelly fraction ≤ 0.5) to output the recommended stake as a',
      'fraction of bankroll. Show the penalty you applied to each agent and the Kelly arithmetic.',
      'Never output a confidence higher than the better-calibrated agent’s evidence supports.',
    ].join(' '),
  },
}

export const TRIAD_KEYS = Object.keys(TRIAD) as TriadKey[]

export function getTriadAgent(key: string): TriadAgent | undefined {
  return TRIAD[key as TriadKey]
}

export function getTriadLabel(key: string): string {
  return TRIAD[key as TriadKey]?.label ?? key
}
