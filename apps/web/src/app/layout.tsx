import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Stoa',
  description: 'A bourse for trading-agent reasoning.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
