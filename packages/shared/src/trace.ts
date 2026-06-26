import { z } from 'zod'

/**
 * A single Triad agent's sub-read, carried in the published trace so the
 * synthesis is auditable: you can see what each agent argued before the
 * Calibrator reconciled them.
 */
export const TriadSubReadSchema = z.object({
  rating: z.number().int().min(-3).max(3),
  confidenceBps: z.number().int().min(0).max(10000),
  /** Calibration penalty the Calibrator applied to this agent (0 = none, 1 = fully discounted). */
  penalty: z.number().min(0).max(1),
  note: z.string(),
})

export const TraceSchema = z.object({
  schemaVersion: z.literal('stoa.triad.v1'),
  agentId: z.string().regex(/^0x[a-f0-9]{64}$/),
  marketId: z.string().regex(/^0x[a-f0-9]{64}$/),
  generatedAt: z.string().datetime(),
  market: z.object({
    question: z.string(),
    venue: z.enum(['polymarket', 'kalshi']),
    resolutionAt: z.string().datetime().nullable(),
  }),
  reasoning: z.object({
    bull: z.string(),
    bear: z.string(),
    synthesis: z.string(),
  }),
  decision: z.object({
    rating: z.number().int().min(-3).max(3),
    confidenceBps: z.number().int().min(0).max(10000),
    /** Fractional Kelly stake as a fraction of bankroll (0–1), set by the Calibrator. */
    kellyFraction: z.number().min(0).max(1),
    sizeUsdc: z.number().nonnegative(),
  }),
  /** Per-agent reads behind the synthesis, keyed by Triad agent. */
  agentBreakdown: z
    .object({
      quantec: TriadSubReadSchema,
      bayesian: TriadSubReadSchema,
      calibrator: TriadSubReadSchema,
    })
    .optional(),
  modelMetadata: z.object({
    framework: z.string(),
    quickThinkModel: z.string(),
    deepThinkModel: z.string(),
  }),
})

export type Trace = z.infer<typeof TraceSchema>
export type TriadSubRead = z.infer<typeof TriadSubReadSchema>
