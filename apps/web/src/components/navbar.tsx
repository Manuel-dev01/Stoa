"use client"

import { useState } from "react"
import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { FundingDialog } from "@/components/funding-dialog"

export function Navbar() {
  const [fundingOpen, setFundingOpen] = useState(false)

  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-serif font-semibold text-xl tracking-tight">
          Stoa
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFundingOpen(true)}
            className="text-sm text-muted-foreground hover:text-amber-500 transition-colors"
          >
            Fund
          </button>
          <ConnectButton
            chainStatus="none"
            showBalance={false}
            accountStatus="address"
          />
        </div>
      </div>
      <FundingDialog open={fundingOpen} onOpenChange={setFundingOpen} />
    </header>
  )
}
