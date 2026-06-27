import type { Metadata } from "next"
import { Suspense } from "react"
import { Hanken_Grotesk, Cormorant, IBM_Plex_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "@/components/providers"
import { SiteNav } from "@/components/site-nav"

// Body / the explainer
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
})

// Display / the carved voice
const cormorant = Cormorant({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
})

// Machine / the payload
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Stoa — an x402-gated feed of macro & crypto predictions",
  description: "The trace is the product, and machines pay for it. A colonnade for machines.",
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${hanken.variable} ${cormorant.variable} ${plexMono.variable} font-sans bg-obsidian text-marble`}>
        <Suspense>
          <Providers>
            <div className="min-h-screen flex flex-col">
              <SiteNav />
              <main className="flex-1">{children}</main>
            </div>
          </Providers>
          <Analytics />
        </Suspense>
      </body>
    </html>
  )
}
