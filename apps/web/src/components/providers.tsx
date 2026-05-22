"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { getConfig } from "@/lib/wagmi"
import { useMemo, useState } from "react"

const rainbowKitTheme = darkTheme({
  accentColor: "#d97706",
  accentColorForeground: "#0f0e0d",
  borderRadius: "small",
  fontStack: "system",
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
      })
  )

  const config = useMemo(() => getConfig(), [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rainbowKitTheme}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
