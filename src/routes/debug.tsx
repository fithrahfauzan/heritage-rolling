import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { loadConfig } from '@/server/config'
import { computeAllocation, summariseAllocation } from '@/lib/allocation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Classification } from '@/lib/types'

const getDebugAllocation = createServerFn({ method: 'GET' }).handler(async () => {
    const { config, validation } = await loadConfig()
    if (!validation.valid) return { error: validation.errors, allocation: null, summary: null, config }
    const allocation = computeAllocation(config.members, config.assets)
    const summary = summariseAllocation(config.members, allocation)
    return { error: null, allocation, summary, config }
})

export const Route = createFileRoute('/debug')({
    component: DebugPage,
    loader: () => getDebugAllocation(),
})

const CLS_COLOR: Record<Classification, string> = {
    top: 'bg-amber-100 text-amber-800',
    middle: 'bg-blue-100 text-blue-800',
    bottom: 'bg-emerald-100 text-emerald-800',
}

function DebugPage() {
    const { error, allocation, summary, config } = Route.useLoaderData()

    if (error) {
        return (
            <main className="mx-auto max-w-2xl p-8">
                <h1 className="mb-4 text-xl font-bold text-destructive">Config errors</h1>
                <ul className="list-disc pl-4 text-sm text-destructive space-y-1">
                    {error.map((e, i) => (
                        <li key={i}>{e.message}</li>
                    ))}
                </ul>
            </main>
        )
    }

    const preassignedCerts = new Set(
        config.assets.filter((a) => a.preassignedTo != null).map((a) => a.certificateNumber),
    )

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight">Allocation debug</h1>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        {allocation!.length} documents
                    </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    Computed fresh on every page load — not the persisted run. Use this to verify fairness before
                    starting.
                </p>
            </div>

            {/* Per-member summary */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {config.members.map((m) => {
                    const s = summary![m.id]!
                    const total = s.top + s.middle + s.bottom
                    return (
                        <Card key={m.id} className="text-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="truncate text-sm" title={m.name}>
                                    {m.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5">
                                {(['top', 'middle', 'bottom'] as Classification[]).map((cls) => (
                                    <div key={cls} className="flex items-center justify-between gap-2">
                                        <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${CLS_COLOR[cls]}`}>
                                            {cls}
                                        </span>
                                        <span className="font-semibold tabular-nums">{s[cls]}</span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between gap-2 border-t pt-1.5">
                                    <span className="text-xs text-muted-foreground">Total</span>
                                    <span className="font-bold tabular-nums">{total}</span>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Reveal sequence table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Reveal sequence
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <th className="px-3 py-2 w-10">#</th>
                                    <th className="px-3 py-2">Class</th>
                                    <th className="px-3 py-2">Certificate</th>
                                    <th className="px-3 py-2">Member</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocation!.map((item, i) => {
                                    const isPinned = preassignedCerts.has(item.certificateNumber)
                                    return (
                                        <tr
                                            key={i}
                                            className={`border-b last:border-0 ${isPinned ? 'bg-amber-50/60' : 'hover:bg-muted/30'} transition-colors`}
                                        >
                                            <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                                                {i + 1}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={`rounded px-1.5 py-0.5 text-xs capitalize ${CLS_COLOR[item.classification]}`}
                                                >
                                                    {item.classification}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs">{item.certificateNumber}</span>
                                                    {isPinned && (
                                                        <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                                            pinned
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {config.members.find((m) => m.id === item.memberId)?.name}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
