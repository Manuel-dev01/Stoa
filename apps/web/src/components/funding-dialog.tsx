"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const CHAINS = [
  { id: "Polygon", label: "Polygon", symbol: "POL" },
  { id: "Base", label: "Base", symbol: "ETH" },
  { id: "Arbitrum", label: "Arbitrum", symbol: "ETH" },
  { id: "Ethereum", label: "Ethereum", symbol: "ETH" },
] as const

interface FundingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FundingDialog({ open, onOpenChange }: FundingDialogProps) {
  const [selectedChain, setSelectedChain] = useState<string>("Polygon")
  const [amount, setAmount] = useState("10")
  const [status, setStatus] = useState<"idle" | "bridging" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleBridge() {
    setStatus("bridging")
    setError(null)

    try {
      const resp = await fetch("/api/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain: selectedChain,
          amount,
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }))
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      setStatus("success")
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Bridge failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund your Arc wallet</DialogTitle>
          <DialogDescription>
            Bridge USDC from any chain to Arc testnet via CCTP V2. Gas on Arc is paid in USDC — no native token needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Source chain
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    selectedChain === chain.id
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  {chain.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {status === "success" ? (
            <div className="text-sm text-green-500 bg-green-500/10 rounded-md p-3">
              Bridge initiated. USDC will arrive on Arc testnet within ~13 minutes (CCTP V2 finality).
            </div>
          ) : status === "error" ? (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-md p-3">
              {error}
            </div>
          ) : null}

          <Button
            onClick={handleBridge}
            disabled={status === "bridging" || !amount}
            className="w-full bg-amber-500 text-[#0f0e0d] hover:bg-amber-400"
          >
            {status === "bridging" ? "Bridging..." : `Bridge ${amount} USDC to Arc`}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            CCTP V2 attestation usually completes in under 30 seconds. Hard fallback is ~13 minutes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
