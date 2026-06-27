"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

// The feed is machine-paid over x402 — no human connects a wallet. The only
// client-side concern is live refetch of the feed/traces, so React Query is the
// whole provider stack now. (Dynamic / wagmi / Circle App Kit were removed.)
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
