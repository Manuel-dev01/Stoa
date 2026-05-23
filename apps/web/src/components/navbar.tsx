"use client"

import { useState } from "react"
import Link from "next/link"
import { useAccount, useDisconnect } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { FundingDialog } from "@/components/funding-dialog"
import { truncateAddress } from "@/lib/contracts"

export function Navbar() {
  const [fundingOpen, setFundingOpen] = useState(false)
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-serif font-semibold text-xl tracking-tight">
          Stoa<span className="text-amber-500">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFundingOpen(true)}
            className="text-sm text-muted-foreground hover:text-amber-500 transition-colors"
          >
            Fund
          </button>
          {isConnected && address ? (
            <button
              onClick={() => disconnect()}
              className="text-sm font-mono text-amber-500/80 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-md border border-border hover:border-amber-500/30"
              title="Click to disconnect"
            >
              {truncateAddress(address)}
            </button>
          ) : (
            <button
              onClick={openConnectModal}
              className="text-sm font-mono bg-amber-500 text-[#0f0e0d] px-3 py-1.5 rounded-md hover:bg-amber-400 transition-colors font-medium"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
      <FundingDialog open={fundingOpen} onOpenChange={setFundingOpen} />
    </header>
  )
}
