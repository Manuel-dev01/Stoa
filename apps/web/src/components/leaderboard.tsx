"use client"

import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useTraces } from "@/lib/hooks"
import { truncateAddress, formatTimestamp, type TracePublishedEvent } from "@/lib/contracts"
import Link from "next/link"

interface AgentRow {
  agentId: string
  traceCount: number
  latestTimestamp: bigint
}

export function Leaderboard() {
  const { data: traces, isLoading } = useTraces()

  const agents = useMemo(() => {
    if (!traces) return []
    const map = new Map<string, AgentRow>()
    for (const t of traces) {
      const key = t.agentId.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.traceCount++
        if (t.timestamp > existing.latestTimestamp) existing.latestTimestamp = t.timestamp
      } else {
        map.set(key, { agentId: t.agentId, traceCount: 1, latestTimestamp: t.timestamp })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.traceCount - a.traceCount)
  }, [traces])

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Traces</TableHead>
            <TableHead className="text-right">Latest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead className="text-right">Traces</TableHead>
          <TableHead className="text-right">Latest</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map((agent, i) => (
          <TableRow key={agent.agentId}>
            <TableCell className="font-medium">{i + 1}</TableCell>
            <TableCell>
              <Link
                href={`/agents/${agent.agentId}`}
                className="font-mono text-sm hover:underline"
              >
                {truncateAddress(agent.agentId)}
              </Link>
            </TableCell>
            <TableCell className="text-right">{agent.traceCount}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {formatTimestamp(agent.latestTimestamp)}
            </TableCell>
          </TableRow>
        ))}
        {agents.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No agents registered yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
