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
import { PERSONA_KEYS } from "@stoa-agents/shared"

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

/**
 * Discriminator-first rubric. The previous version listed each archetype with
 * a paragraph of prose; in practice that pushed almost everything to stoikos
 * because calibrated-probability framing is the default mode for any reasoned
 * prediction-market take. This version uses explicit lexical / structural
 * markers per archetype and treats stoikos as the residual rather than the
 * default winner.
 */
function buildSystemPrompt(hint?: string): string {
  const hintBlock = hint && PERSONA_KEYS.includes(hint.toLowerCase())
    ? `\nIMPORTANT — declared persona: the agent that produced this reasoning was deliberately built as **${hint.toLowerCase()}**. Treat this as a strong prior. Your default answer is ${hint.toLowerCase()}. Override it ONLY if the reasoning contains explicit, dominant markers of a clearly different archetype (per the marker list above) that run through the whole trace, not a single stray phrase. When in doubt, return ${hint.toLowerCase()}.\n`
    : ""

  return `You are classifying a trading-agent reasoning trace against six analytical archetypes. The archetypes are distinguished by WHICH SIGNALS the reasoning leans on, not by trade direction or confidence level.

Markers to look for:

- heraklit (Panta Rhei): momentum / trend / flow. Tells: words like "momentum", "accelerating", "building", "trending", "recent news", "sentiment shift", "regime change", explicit invocations of news flow or velocity of change.
- phyrr (Skeptic-Class v2): contrarian frame. Tells: explicitly says the market is wrong / overhyped / over-extended, argues the consensus is mispriced, regression-to-mean reasoning, narrative skepticism, "the crowd is".
- artemis (Huntress of Catalysts): event-driven. Tells: names a specific upcoming scheduled event (date, hearing, vote, launch, ship date, oracle resolution) and reasons about how the market resolves around it. "If X happens by Y, then..." conditional structure.
- athena (The Fundamentalist): structural / long-horizon. Tells: cashflows, balance sheets, monetary plumbing, institutional incentives, regulatory structure. Talks about *why the underlying works the way it does*, not what's about to happen.
- hermes (Messenger of Micro): price-and-liquidity microstructure. Tells: references the market's current price, implied probability, spread, liquidity depth, "what the price implies", "thin liquidity", "the market is pricing", efficient-pricing arguments.
- stoikos (Apatheia Engine): pure calibrated probability without any of the above markers. Base rates, explicit % estimates, uncertainty acknowledgment, refusal to commit without edge. This is the RESIDUAL archetype — choose stoikos only when none of the other five have a clear marker in the text.

Decision rule:
1. Scan the reasoning for markers from heraklit, phyrr, artemis, athena, and hermes (in any order).
2. If you find clear markers from one of those five archetypes (even one to two phrases), choose it.
3. If you find markers from two or more, pick the one with the strongest signal.
4. Only choose stoikos when NONE of the other five have a marker in the text.
${hintBlock}
Respond with a single JSON object:
{
  "persona": "<one of: ${PERSONA_KEYS.join(", ")}>",
  "confidence": <integer 0-100, how confident you are in the match>,
  "rationale": "<one sentence, max 200 chars, citing the specific phrase or framing that drove the choice>"
}

Do not invent persona keys.`
}

export async function classifyTraceReasoning(
  reasoning: ReasoningInput,
  hint?: string,
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
          { role: "system", content: buildSystemPrompt(hint) },
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
