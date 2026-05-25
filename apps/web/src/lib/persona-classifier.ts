/**
 * Server-side persona classification.
 *
 * Reads a trace's bull/bear/synthesis text and classifies the reasoning style
 * against the six Stoa archetypes via DeepSeek. Called from /api/v1/traces
 * (post-publish, fire-and-forget) and from the backfill script.
 *
 * Returns null on any failure — classification is purely additive, the trace
 * itself is already anchored on Arc + Irys regardless of whether we get a
 * label. Never throws.
 */
import { PERSONAS, PERSONA_KEYS } from "@stoa-agents/shared"

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
const DEEPSEEK_MODEL = "deepseek-chat"
const TIMEOUT_MS = 30_000

export interface ClassificationResult {
  persona: string
  confidenceBps: number
  rationale: string
}

interface ReasoningInput {
  bull?: string
  bear?: string
  synthesis?: string
}

function buildSystemPrompt(): string {
  const rubrics = PERSONA_KEYS.map((key) => {
    const p = PERSONAS[key]
    return `- ${key} (${p.archetype}): ${p.behavior}`
  }).join("\n")

  return `You are a classifier for trading-agent reasoning traces.

Read the bull case, bear case, and synthesis below, then decide which of these six analytical archetypes best matches the REASONING STYLE — not the trade direction, not whether the call is right or wrong. Match how the agent thinks.

${rubrics}

Respond with a single JSON object:
{
  "persona": "<one of: ${PERSONA_KEYS.join(", ")}>",
  "confidence": <integer 0-100, how confident you are in the match>,
  "rationale": "<one sentence, max 200 chars, citing what in the text drove the choice>"
}

Pick the closest match even if no archetype is a perfect fit. Do not invent new persona keys.`
}

export async function classifyTraceReasoning(
  reasoning: ReasoningInput,
): Promise<ClassificationResult | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error("[classify] DEEPSEEK_API_KEY not set")
    return null
  }

  const userContent = [
    reasoning.bull && `BULL CASE:\n${reasoning.bull}`,
    reasoning.bear && `BEAR CASE:\n${reasoning.bear}`,
    reasoning.synthesis && `SYNTHESIS:\n${reasoning.synthesis}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  if (!userContent.trim()) {
    console.error("[classify] empty reasoning input")
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userContent },
        ],
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "<no body>")
      console.error(`[classify] DeepSeek ${resp.status}: ${errBody.slice(0, 200)}`)
      return null
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = json.choices?.[0]?.message?.content
    if (!raw) {
      console.error("[classify] no content in DeepSeek response")
      return null
    }

    const parsed = JSON.parse(raw) as {
      persona?: string
      confidence?: number
      rationale?: string
    }

    const persona = (parsed.persona || "").toLowerCase().trim()
    if (!PERSONA_KEYS.includes(persona)) {
      console.error(`[classify] DeepSeek returned unknown persona: ${persona}`)
      return null
    }

    const confidence = Math.max(
      0,
      Math.min(100, Math.round(Number(parsed.confidence) || 0)),
    )
    const rationale = (parsed.rationale || "").toString().slice(0, 240)

    return {
      persona,
      confidenceBps: confidence * 100, // 0-100 → 0-10000
      rationale,
    }
  } catch (err) {
    console.error(
      "[classify] threw:",
      err instanceof Error ? err.message : String(err),
    )
    return null
  } finally {
    clearTimeout(timer)
  }
}
