/**
 * Persona classification backfill.
 *
 * Reads every row in `traces` where `classified_persona IS NULL`, fetches the
 * trace body from Irys, classifies it via DeepSeek, and writes the result
 * back. Runs in small concurrent batches to avoid rate limits.
 *
 * Usage:
 *   npx tsx scripts/backfill-classifications.ts
 *
 * Env vars (from .env.local at repo root):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   DEEPSEEK_API_KEY
 */

import { config } from "dotenv"
config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"
import { PERSONAS, PERSONA_KEYS } from "@stoa-agents/shared"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
const CONCURRENCY = 5
const BATCH_DELAY_MS = 250

interface TraceRow {
  trace_hash: string
  irys_receipt: string
}

interface IrysTraceBody {
  reasoning?: {
    bull?: string
    bear?: string
    synthesis?: string
  }
}

interface ClassificationResult {
  persona: string
  confidenceBps: number
  rationale: string
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

async function fetchIrysBody(receipt: string): Promise<IrysTraceBody | null> {
  // Daemon traces uploaded to devnet show up at devnet.irys.xyz; production
  // uploads at gateway.irys.xyz. Try the mainnet gateway first; fall back.
  const urls = [`https://gateway.irys.xyz/${receipt}`, `https://devnet.irys.xyz/${receipt}`]
  for (const url of urls) {
    try {
      const resp = await fetch(url)
      if (resp.ok) return (await resp.json()) as IrysTraceBody
    } catch {
      // Try next gateway
    }
  }
  return null
}

async function classify(
  reasoning: { bull?: string; bear?: string; synthesis?: string },
): Promise<ClassificationResult | null> {
  if (!DEEPSEEK_KEY) {
    throw new Error("DEEPSEEK_API_KEY not set in .env.local")
  }

  const userContent = [
    reasoning.bull && `BULL CASE:\n${reasoning.bull}`,
    reasoning.bear && `BEAR CASE:\n${reasoning.bear}`,
    reasoning.synthesis && `SYNTHESIS:\n${reasoning.synthesis}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  if (!userContent.trim()) return null

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
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
      console.error(`  DeepSeek ${resp.status}`)
      return null
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = json.choices?.[0]?.message?.content
    if (!raw) return null

    const parsed = JSON.parse(raw) as {
      persona?: string
      confidence?: number
      rationale?: string
    }
    const persona = (parsed.persona || "").toLowerCase().trim()
    if (!PERSONA_KEYS.includes(persona)) return null

    const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)))
    return {
      persona,
      confidenceBps: confidence * 100,
      rationale: (parsed.rationale || "").slice(0, 240),
    }
  } catch (err) {
    console.error(`  classify threw:`, err instanceof Error ? err.message : String(err))
    return null
  }
}

async function processOne(supabase: ReturnType<typeof createClient>, row: TraceRow): Promise<boolean> {
  const body = await fetchIrysBody(row.irys_receipt)
  if (!body || !body.reasoning) {
    console.log(`  ${row.trace_hash.slice(0, 12)}… body unreachable`)
    return false
  }

  const result = await classify(body.reasoning)
  if (!result) {
    console.log(`  ${row.trace_hash.slice(0, 12)}… classify failed`)
    return false
  }

  const { error } = await supabase
    .from("traces")
    .update({
      classified_persona: result.persona,
      classification_confidence_bps: result.confidenceBps,
      classification_rationale: result.rationale,
      classified_at: new Date().toISOString(),
    })
    .eq("trace_hash", row.trace_hash)

  if (error) {
    console.error(`  ${row.trace_hash.slice(0, 12)}… write failed: ${error.message}`)
    return false
  }

  console.log(`  ${row.trace_hash.slice(0, 12)}… ${result.persona} (${result.confidenceBps / 100}%)`)
  return true
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  }
  if (!DEEPSEEK_KEY) {
    throw new Error("DEEPSEEK_API_KEY required")
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const { data: rows, error } = await supabase
    .from("traces")
    .select("trace_hash, irys_receipt")
    .is("classified_persona", null)
    .order("published_at", { ascending: false })

  if (error) throw new Error(`Supabase: ${error.message}`)
  if (!rows || rows.length === 0) {
    console.log("Nothing to backfill — every trace is classified.")
    return
  }

  console.log(`Backfilling ${rows.length} unclassified traces (concurrency=${CONCURRENCY})\n`)

  let ok = 0
  let fail = 0
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY) as TraceRow[]
    console.log(`Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(rows.length / CONCURRENCY)}:`)
    const results = await Promise.all(batch.map((row) => processOne(supabase, row)))
    ok += results.filter((r) => r).length
    fail += results.filter((r) => !r).length
    if (i + CONCURRENCY < rows.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log(`\nDone. classified=${ok} failed=${fail}`)
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
