/**
 * Persona classification backfill.
 *
 * Reads every row in `traces` where `classified_persona IS NULL`, fetches the
 * trace body from Irys, classifies it via DeepSeek, and writes the result
 * back. Runs in small concurrent batches to avoid rate limits.
 *
 * The classifier itself lives in apps/web/src/lib/persona-classifier.ts and is
 * imported here so the rubric never drifts between the live publish path and
 * the backfill. Each trace is classified with its agent's intended persona
 * (the legacy display_handle) as a soft hint.
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
import { classifyTraceReasoning } from "../apps/web/src/lib/persona-classifier"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

const CONCURRENCY = 5
const BATCH_DELAY_MS = 250

interface TraceRow {
  trace_hash: string
  irys_receipt: string
  agent_id: string
}

interface IrysTraceBody {
  reasoning?: {
    bull?: string
    bear?: string
    synthesis?: string
  }
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

async function processOne(
  supabase: ReturnType<typeof createClient>,
  row: TraceRow,
  hint: string | undefined,
): Promise<boolean> {
  const body = await fetchIrysBody(row.irys_receipt)
  if (!body || !body.reasoning) {
    console.log(`  ${row.trace_hash.slice(0, 12)}… body unreachable`)
    return false
  }

  const result = await classifyTraceReasoning(body.reasoning, hint)
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

  const hintNote = hint ? ` [hint:${hint}]` : ""
  console.log(`  ${row.trace_hash.slice(0, 12)}… ${result.persona} (${result.confidenceBps / 100}%)${hintNote}`)
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

  // Pre-fetch the agent → display_handle map so we don't N+1 query per trace.
  const { data: agents } = await supabase.from("agents").select("agent_id, display_handle")
  const handleByAgent = new Map<string, string>()
  for (const a of agents ?? []) {
    if (a.display_handle) handleByAgent.set(a.agent_id, String(a.display_handle).toLowerCase())
  }

  // Default: only classify rows that have never been classified.
  // --all: reclassify every trace in place (used after a rubric change).
  const reclassifyAll = process.argv.includes("--all")

  let query = supabase
    .from("traces")
    .select("trace_hash, irys_receipt, agent_id")
    .order("published_at", { ascending: false })
  if (!reclassifyAll) {
    query = query.is("classified_persona", null)
  }

  const { data: rows, error } = await query

  if (error) throw new Error(`Supabase: ${error.message}`)
  if (!rows || rows.length === 0) {
    console.log("Nothing to backfill — every trace is classified.")
    return
  }

  if (reclassifyAll) {
    console.log("Mode: --all (reclassifying every trace in place with the current rubric)")
  }

  console.log(`Backfilling ${rows.length} unclassified traces (concurrency=${CONCURRENCY})\n`)

  let ok = 0
  let fail = 0
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY) as TraceRow[]
    console.log(`Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(rows.length / CONCURRENCY)}:`)
    const results = await Promise.all(
      batch.map((row) => processOne(supabase, row, handleByAgent.get(row.agent_id))),
    )
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
