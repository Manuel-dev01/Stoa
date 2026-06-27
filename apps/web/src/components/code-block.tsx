"use client"

import { useState } from "react"

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — no-op */
    }
  }
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-[#0A0908]">
      <div className="flex items-center justify-between border-b border-hairline-soft px-4 py-2.5">
        <span className="font-mono text-[11px] text-mono-dim">{label}</span>
        <button
          onClick={copy}
          className="font-mono text-[11px] text-ash transition-colors hover:text-gold"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-marble">
        <code>{code}</code>
      </pre>
    </div>
  )
}
