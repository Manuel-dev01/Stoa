"use client"

import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"

export function Navbar() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-serif font-semibold text-xl tracking-tight">
          Stoa
        </Link>
        <ConnectButton
          chainStatus="none"
          showBalance={false}
          accountStatus="address"
        />
      </div>
    </header>
  )
}
