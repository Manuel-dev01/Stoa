"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"

interface TeaserBlockProps {
  children: ReactNode
  label: string
  colorClass: string
  /** Max height in px when collapsed (default shows ~2-3 lines) */
  collapsedHeight?: number
  defaultExpanded?: boolean
}

/**
 * Shows content clipped to collapsedHeight with gradient fade,
 * smoothly expands to full length on click.
 */
export function TeaserBlock({
  children,
  label,
  colorClass,
  collapsedHeight = 72,
  defaultExpanded = false,
}: TeaserBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentRef = useRef<HTMLDivElement>(null)
  const [fullHeight, setFullHeight] = useState(0)

  useEffect(() => {
    if (!contentRef.current) return
    const el = contentRef.current
    const measure = () => setFullHeight(el.scrollHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])

  const needsCollapse = fullHeight > collapsedHeight + 20

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 cursor-pointer select-none group/teaser"
      >
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className={`text-[10px] font-medium uppercase tracking-[0.15em] ${colorClass} group-hover/teaser:opacity-80 transition-opacity`}>
          {label}
        </span>
        {needsCollapse && !expanded && (
          <span className="text-[10px] font-mono text-muted-foreground/50 ml-1">
            · continue
          </span>
        )}
      </button>

      <div
        className="relative overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ maxHeight: expanded || !needsCollapse ? fullHeight + 8 : collapsedHeight }}
      >
        <div ref={contentRef}>
          <div
            className="prose-stoa text-sm border-l-2 pl-4"
            style={{ borderColor: `color-mix(in srgb, currentColor 30%, transparent)` }}
          >
            <div className={colorClass}>
              {children}
            </div>
          </div>
        </div>

        {needsCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  )
}
