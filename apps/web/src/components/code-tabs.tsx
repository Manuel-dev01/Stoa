"use client"

import { useState } from "react"
import { CodeBlock } from "./code-block"

export interface CodeTab {
  id: string
  label: string
  code: string
}

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  if (!current) return null
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] transition-colors ${
              active === t.id
                ? "border-gold/40 bg-gold/5 text-gold"
                : "border-hairline text-ash hover:text-marble"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.code} label={current.label} />
    </div>
  )
}
