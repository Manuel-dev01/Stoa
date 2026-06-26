import type { Trace } from '@stoa-agents/shared'
import { getTriadAgent, type TriadAgent } from '@stoa-agents/shared'
import { registerAgent, type RegisterResult } from './register.js'
import { publishTrace, hashTrace } from './traces.js'
import { uploadToIrys } from './irys.js'
import type { StoaConfig } from './types.js'

export interface StoaAgentConfig {
  /** EOA private key (0x-prefixed hex) */
  privateKey: string
  /** Arc testnet RPC URL */
  arcRpc: string
  /** Triad engine this agent runs as (optional, defaults to "calibrator") */
  agent?: string
  /** Irys node URL (optional) */
  irysNodeUrl?: string
}

export interface PublishResult {
  traceHash: string
  irysReceipt: string
  txHash: string
}

/**
 * High-level agent interface for Stoa.
 *
 * Usage:
 *   const agent = new StoaAgent({ privateKey, arcRpc })
 *   const { agentId } = await agent.register()
 *   const result = await agent.publishTrace({
 *     agentId,
 *     marketId: '0x...',
 *     reasoning: { bull: '...', bear: '...', synthesis: '...' },
 *     rating: 2,
 *     confidenceBps: 7500,
 *   })
 */
export class StoaAgent {
  private config: StoaConfig
  private agentKey: string
  private irysNodeUrl?: string

  constructor(config: StoaAgentConfig) {
    this.config = {
      privateKey: config.privateKey,
      arcRpc: config.arcRpc,
      irysNodeUrl: config.irysNodeUrl,
    }
    this.agentKey = config.agent || 'calibrator'
    this.irysNodeUrl = config.irysNodeUrl
  }

  /** Get the Triad engine configuration for this agent */
  get triadConfig(): TriadAgent | undefined {
    return getTriadAgent(this.agentKey)
  }

  /** Get the Triad engine label */
  get triadLabel(): string {
    return getTriadAgent(this.agentKey)?.label ?? 'The Calibrator'
  }

  /**
   * Register this agent on StoaRegistry.
   * Returns the agent's bytes32 identity.
   */
  async register(): Promise<RegisterResult> {
    return registerAgent(this.config)
  }

  /**
   * Build, upload, and publish a trace.
   * Handles Irys upload and on-chain publication.
   */
  async publishTrace(params: {
    agentId: string
    marketId: string
    reasoning: { bull: string; bear: string; synthesis: string }
    rating: number
    confidenceBps: number
    marketQuestion?: string
    venue?: string
  }): Promise<PublishResult> {
    // Build trace
    const trace: Trace = {
      schemaVersion: 'stoa.triad.v1',
      agentId: params.agentId,
      marketId: params.marketId,
      generatedAt: new Date().toISOString(),
      market: {
        question: params.marketQuestion || '',
        venue: (params.venue as 'polymarket' | 'kalshi') || 'polymarket',
        resolutionAt: null,
      },
      reasoning: params.reasoning,
      decision: {
        rating: params.rating,
        confidenceBps: params.confidenceBps,
        kellyFraction: 0,
        sizeUsdc: 0,
      },
      modelMetadata: {
        framework: 'stoa-sdk',
        quickThinkModel: 'external',
        deepThinkModel: 'external',
      },
    }

    // Upload to Irys
    const irysResult = await uploadToIrys(trace as unknown as Record<string, unknown>, this.irysNodeUrl)

    // Publish on-chain
    const txHash = await publishTrace(this.config, {
      agentId: params.agentId,
      marketId: params.marketId,
      trace,
      irysReceipt: irysResult.id,
    })

    // Compute hash
    const traceHash = await hashTrace(trace as unknown as Record<string, unknown>)

    return {
      traceHash,
      irysReceipt: irysResult.id,
      txHash,
    }
  }
}
