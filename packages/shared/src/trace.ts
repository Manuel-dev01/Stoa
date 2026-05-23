import { z } from 'zod'

export const TraceSchema = z.object({
  schemaVersion: z.literal('stoa.trace.v1'),
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
    sizeUsdc: z.number().nonnegative(),
  }),
  modelMetadata: z.object({
    framework: z.string(),
    quickThinkModel: z.string(),
    deepThinkModel: z.string(),
  }),
})

export type Trace = z.infer<typeof TraceSchema>
