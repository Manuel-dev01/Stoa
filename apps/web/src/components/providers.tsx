"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core"
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector"
import { dynamicSettings, dynamicTheme } from "@/lib/dynamic"
import { getConfig } from "@/lib/wagmi"
import { useMemo, useState } from "react"

const hasDynamicId = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
      })
  )

  const config = useMemo(() => getConfig(), [])

  if (!hasDynamicId) {
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    )
  }

  return (
    <DynamicContextProvider settings={dynamicSettings} theme={dynamicTheme}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            {children}
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  )
}
