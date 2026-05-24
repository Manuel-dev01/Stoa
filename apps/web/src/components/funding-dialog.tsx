"use client"

import { useEffect, useState } from "react"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { truncateAddress } from "@/lib/contracts"
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
  const { primaryWallet } = useDynamicContext()
  const connectedAddress = primaryWallet?.address

  const [selectedChain, setSelectedChain] = useState<AppKitChain>("Polygon_Amoy_Testnet")
  const [amount, setAmount] = useState("10")
  const [status, setStatus] = useState<"idle" | "bridging" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  // Reset transient state when the dialog reopens.
  useEffect(() => {
    if (open) {
      setStatus("idle")
      setError(null)
    }
  }, [open])

  async function handleBridge() {
    setStatus("bridging")
    setError(null)

    try {
      // Pull the EIP-1193 provider from the wallet the user actually connected
      // through Dynamic. Falls back to window.ethereum if Dynamic exposes
      // nothing (e.g. embedded wallets that aren't EVM-1193 compatible).
      let provider: unknown
      if (primaryWallet?.connector) {
        const c = primaryWallet.connector as unknown as {
          getEthersProvider?: () => Promise<unknown>
          getEthereumProvider?: () => Promise<unknown>
          getWeb3Provider?: () => Promise<unknown>
        }
        if (c.getEthereumProvider) provider = await c.getEthereumProvider()
        else if (c.getWeb3Provider) provider = await c.getWeb3Provider()
        else if (c.getEthersProvider) provider = await c.getEthersProvider()
      }

      const { bridgeToArc } = await import("@/lib/appkit")
      await bridgeToArc({
        fromChain: selectedChain,
        amount,
        provider,
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
            Bridge USDC from a testnet chain to Arc testnet via CCTP V2. Gas on Arc is paid in USDC, no native token needed.
          </DialogDescription>
        </DialogHeader>

        {connectedAddress ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono space-y-1">
            <div className="text-muted-foreground">Signing wallet</div>
            <div className="flex items-center justify-between">
              <span className="text-amber-500">{truncateAddress(connectedAddress)}</span>
              <span className="text-[10px] text-muted-foreground/60">via Dynamic</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">
              If this isn&apos;t the wallet you want, disconnect from the navbar, switch the active
              account inside MetaMask (or your chosen wallet), then reconnect.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-mono text-amber-500/90">
            Connect a wallet first. The bridge needs a signer on the source chain.
          </div>
        )}

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
            disabled={status === "bridging" || !amount || !connectedAddress}
            className="w-full bg-amber-500 text-[#0f0e0d] hover:bg-amber-400"
          >
            {status === "bridging"
              ? "Bridging..."
              : !connectedAddress
              ? "Connect wallet to bridge"
              : `Bridge ${amount} USDC to Arc`}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            CCTP V2 attestation usually completes in under 30 seconds. Hard fallback is ~13 minutes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
