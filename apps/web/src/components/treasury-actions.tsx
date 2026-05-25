"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { erc20Abi, parseUnits, formatUnits } from "viem"
import { Button } from "@/components/ui/button"
import { useTreasurySubscribe, useTreasuryRedeem, useTreasuryValue, useTreasuryShares } from "@/lib/hooks"
import { ARC_USDC, STOA_TREASURY } from "@/lib/shared/addresses"

interface TreasuryActionsProps {
  agentId: `0x${string}`
  agentOwner?: string
}

export function TreasuryActions({ agentId, agentOwner }: TreasuryActionsProps) {
  const { address } = useAccount()
  // Dynamic is the authoritative session for this app (navbar, funding dialog
  // both read from it). Wagmi's isConnected can drift after a Dynamic logout,
  // so gate on primaryWallet to keep all action surfaces consistent.
  const { primaryWallet } = useDynamicContext()
  const isConnected = Boolean(primaryWallet)
  const isOwner = address && agentOwner && address.toLowerCase() === agentOwner.toLowerCase()
  const { data: treasuryValue, refetch: refetchValue } = useTreasuryValue(agentId)
  const { data: treasuryShares, refetch: refetchShares } = useTreasuryShares(agentId)
  const { subscribe, isPending: isSubscribing } = useTreasurySubscribe()
  const { redeem, isPending: isRedeeming } = useTreasuryRedeem()

  const [amount, setAmount] = useState("")
  const [status, setStatus] = useState<"idle" | "approving" | "subscribing" | "redeeming" | "done" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { writeContractAsync } = useWriteContract()

  const { data: approveReceipt } = useWaitForTransactionReceipt(
    txHash ? { hash: txHash as `0x${string}` } : undefined
  )

  async function handleApproveAndSubscribe() {
    if (!amount || !address) return
    setError(null)

    try {
      const parsedAmount = parseUnits(amount, 6)

      setStatus("approving")
      const approveHash = await writeContractAsync({
        address: ARC_USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [STOA_TREASURY, parsedAmount],
      })
      setTxHash(approveHash)

      setStatus("subscribing")
      await subscribe(agentId, parsedAmount)

      setStatus("done")
      setAmount("")
      refetchValue()
      refetchShares()
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Transaction failed")
    }
  }

  async function handleRedeem() {
    if (!amount) return
    setError(null)

    try {
      const parsedShares = parseUnits(amount, 6)
      setStatus("redeeming")
      await redeem(agentId, parsedShares)
      setStatus("done")
      setAmount("")
      refetchValue()
      refetchShares()
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Transaction failed")
    }
  }

  if (!isConnected) {
    return (
      <div className="border border-border/40 rounded-sm p-4">
        <p className="text-xs font-mono text-muted-foreground">
          Connect wallet to deposit or withdraw from this agent&apos;s treasury.
        </p>
      </div>
    )
  }

  const isBusy = status === "approving" || status === "subscribing" || status === "redeeming" || isSubscribing || isRedeeming
  const valueDisplay = treasuryValue != null ? `$${formatUnits(treasuryValue, 6)}` : "—"
  const sharesDisplay = treasuryShares != null ? formatUnits(treasuryShares, 6) : "—"

  return (
    <div className="border border-border/40 rounded-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          Treasury actions
        </span>
        <div className="flex gap-4 text-xs font-mono text-muted-foreground">
          <span>Value: <span className="text-amber-500">{valueDisplay}</span></span>
          <span>Shares: <span className="text-amber-500">{sharesDisplay}</span></span>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (USDC)"
          min="0"
          step="0.01"
          className="no-spin flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
          disabled={isBusy}
        />
        <Button
          onClick={handleApproveAndSubscribe}
          disabled={isBusy || !amount}
          className="bg-amber-500 text-[#0f0e0d] hover:bg-amber-400 text-xs font-mono"
        >
          {status === "approving" ? "Approving…" : status === "subscribing" ? "Depositing…" : "Deposit"}
        </Button>
        {isOwner && (
          <Button
            onClick={handleRedeem}
            disabled={isBusy || !amount}
            variant="outline"
            className="text-xs font-mono"
          >
            {status === "redeeming" ? "Redeeming…" : "Redeem"}
          </Button>
        )}
      </div>

      {status === "done" && (
        <p className="text-xs text-emerald-400 font-mono">
          Transaction confirmed.
        </p>
      )}
      {status === "error" && error && (
        <p className="text-xs text-red-400 font-mono">
          {error}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/60 font-mono">
        Deposits go to this agent&apos;s treasury on Arc. Redeem burns shares and returns USDC.
      </p>
    </div>
  )
}
