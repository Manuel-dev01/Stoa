"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core"
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector"
import { dynamicSettings, dynamicTheme } from "@/lib/dynamic"
import { getConfig } from "@/lib/wagmi"
import { useMemo, useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
      })
  )

  const config = useMemo(() => getConfig(), [])

  // Always mount DynamicContextProvider so every useDynamicContext() consumer
  // (navbar, funding-dialog, treasury-actions) has its context — even when
  // NEXT_PUBLIC_DYNAMIC_ENV_ID is absent (e.g. Preview builds). Skipping the
  // provider made the hook throw during static prerender and failed the build;
  // an empty environmentId just yields a non-authenticating provider.
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
