"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { TriadMark } from "@/components/triad-mark"

const LINKS = [
  { href: "/", label: "FEED" },
  { href: "/flow", label: "FLOW" },
  { href: "/traces", label: "TRACES" },
  { href: "/agents", label: "AGENTS" },
]

const GITHUB = "https://github.com/Manuel-dev01/Stoa"

export function SiteNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-hairline-soft bg-obsidian/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-[18px] sm:px-12">
        <Link href="/" className="flex items-center gap-3">
          <TriadMark size={24} />
          <span className="font-serif text-xl font-semibold tracking-[0.32em] pl-[3px]">
            STOA
          </span>
        </Link>
        <nav className="flex items-center gap-5 font-mono text-[11px] tracking-[0.1em] text-ash sm:gap-6">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "text-gold" : "text-ash transition-colors hover:text-marble"}
              >
                {l.label}
              </Link>
            )
          })}
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="hidden text-ash transition-colors hover:text-marble sm:inline"
          >
            GITHUB&nbsp;↗
          </a>
        </nav>
      </div>
    </header>
  )
}
