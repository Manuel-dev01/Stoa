"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAccount, useDisconnect } from "wagmi"
import { useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { FundingDialog } from "@/components/funding-dialog"
import { truncateAddress } from "@/lib/contracts"

const hasDynamicId = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID)

function DisabledConnectButton({ title }: { title?: string }) {
  return (
    <button
      disabled
      className="text-sm font-mono bg-amber-500/50 text-[#0f0e0d] px-3 py-1.5 rounded-md cursor-not-allowed font-medium"
      title={title}
    >
      Connect Wallet
    </button>
  )
}

function ConnectButton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!hasDynamicId) {
    return <DisabledConnectButton title="Set NEXT_PUBLIC_DYNAMIC_ENV_ID to enable wallet connection" />
  }

  if (!mounted) {
    return <DisabledConnectButton />
  }

  return <DynamicConnectButton />
}

function DynamicConnectButton() {
  const { setShowAuthFlow } = useDynamicContext()
  return (
    <button
      onClick={() => setShowAuthFlow(true)}
      className="text-sm font-mono bg-amber-500 text-[#0f0e0d] px-3 py-1.5 rounded-md hover:bg-amber-400 transition-colors font-medium"
    >
      Connect Wallet
    </button>
  )
}

export function Navbar() {
  const [fundingOpen, setFundingOpen] = useState(false)
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

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
            <ConnectButton />
          )}
        </div>
      </div>
      <FundingDialog open={fundingOpen} onOpenChange={setFundingOpen} />
    </header>
  )
}
