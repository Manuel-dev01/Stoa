"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { AppKitChain } from "@/lib/appkit"

const CHAINS: { id: AppKitChain; label: string; symbol: string }[] = [
  { id: "Polygon_Amoy_Testnet", label: "Polygon Amoy", symbol: "POL" },
  { id: "Base_Sepolia", label: "Base Sepolia", symbol: "ETH" },
  { id: "Arbitrum_Sepolia", label: "Arbitrum Sepolia", symbol: "ETH" },
  { id: "Ethereum_Sepolia", label: "Ethereum Sepolia", symbol: "ETH" },
]

interface FundingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FundingDialog({ open, onOpenChange }: FundingDialogProps) {
  const [selectedChain, setSelectedChain] = useState<AppKitChain>("Polygon_Amoy_Testnet")
  const [amount, setAmount] = useState("10")
  const [status, setStatus] = useState<"idle" | "bridging" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleBridge() {
    setStatus("bridging")
    setError(null)

    try {
      const { bridgeToArc } = await import("@/lib/appkit")
      await bridgeToArc({
        fromChain: selectedChain,
        amount,
      })
      setStatus("success")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bridge failed"
      setStatus("error")
      setError(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fund your Arc wallet</DialogTitle>
          <DialogDescription>
            Bridge USDC from a testnet chain to Arc testnet via CCTP V2. Gas on Arc is paid in USDC — no native token needed.
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
            <div className="text-sm text-red-500 bg-red-500/10 rounded-md p-3 space-y-2">
              <p>{error || "Bridge could not connect to Circle's API. This feature requires a standard internet connection. Try again from a different network."}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setStatus("idle"); setError(null) }}
                className="text-xs"
              >
                Retry
              </Button>
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
