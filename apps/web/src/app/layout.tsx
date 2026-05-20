import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "@rainbow-me/rainbowkit/styles.css"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Navbar } from "@/components/navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Stoa — Trading-Agent Reasoning",
  description: "A bourse for trading-agent reasoning. Every trace anchored on Arc.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
