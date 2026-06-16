import { createFileRoute, Link } from '@tanstack/react-router'
import { loadConfig } from '@/server/config'
import { getDistributionState } from '@/server/distribution'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DistributionStatus, Classification } from '@/lib/types'

export const Route = createFileRoute('/')({
    component: Home,
    loader: () => Promise.all([loadConfig(), getDistributionState()]),
})

const STATUS_BADGE: Record<DistributionStatus, { label: string; cls: string }> = {
    empty: { label: 'Not started', cls: 'bg-muted text-muted-foreground' },
    draft: { label: 'Draft', cls: 'bg-amber-100 text-amber-800' },
    in_progress: { label: 'In progress', cls: 'bg-blue-100 text-blue-800' },
    committed: { label: 'Committed ✓', cls: 'bg-emerald-100 text-emerald-800' },
}

const CLS_ACCENT: Record<Classification, string> = {
    top: 'text-amber-600',
    middle: 'text-blue-600',
    bottom: 'text-emerald-600',
}

export default function Home() {
    const [{ config, validation }, distState] = Route.useLoaderData()
    const status = distState.status
    const badge = STATUS_BADGE[status]

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-8">
            {/* Hero */}
            <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-8">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Heritage Land Distribution</h1>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                    </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild size="lg">
                        <Link to="/distribute">
                            {status === 'empty'
                                ? 'Start distribution'
                                : status === 'committed'
                                  ? 'View results'
                                  : 'Continue distribution'}
                        </Link>
                    </Button>
                    {status === 'committed' && (
                        <Button asChild size="lg" variant="outline">
                            <Link to="/report">Open report</Link>
                        </Button>
                    )}
                </div>
            </section>

            {!validation.valid && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive text-base">Configuration errors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-4 text-sm text-destructive space-y-1">
                            {validation.errors.map((e, i) => (
                                <li key={i}>{e.message}</li>
                            ))}
                        </ul>
                        <p className="text-sm mt-3 text-muted-foreground">
                            Edit <code className="font-mono text-xs">config/seed.json</code> to fix these errors.
                        </p>
                    </CardContent>
                </Card>
            )}

            {validation.valid && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card className="transition-shadow hover:shadow-md">
                            <CardHeader>
                                <CardTitle className="text-base">Members · {config.members.length}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    {config.members.map((m) => (
                                        <li key={m.id} className="truncate">
                                            {m.name}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="transition-shadow hover:shadow-md">
                            <CardHeader>
                                <CardTitle className="text-base">Land documents · {config.assets.length}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {(['top', 'middle', 'bottom'] as Classification[]).map((cls) => {
                                    const count = config.assets.filter((a) => a.classification === cls).length
                                    const perMember =
                                        cls === 'bottom'
                                            ? `~${Math.floor(count / config.members.length)}`
                                            : String(count / config.members.length)
                                    return (
                                        <div key={cls} className="flex items-center justify-between">
                                            <span className={`font-medium capitalize ${CLS_ACCENT[cls]}`}>{cls}</span>
                                            <span className="text-muted-foreground">
                                                {count} total · {perMember}/member
                                            </span>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    </div>

                    {status !== 'empty' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Current distribution</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1 text-muted-foreground">
                                <div className="flex justify-between">
                                    <span>Revealed</span>
                                    <span className="font-medium text-foreground">
                                        {distState.revealedCount} / {distState.allocation.length}
                                    </span>
                                </div>
                                {distState.startedAt && (
                                    <div className="flex justify-between">
                                        <span>Started</span>
                                        <span>{new Date(distState.startedAt).toLocaleString()}</span>
                                    </div>
                                )}
                                {distState.committedAt && (
                                    <div className="flex justify-between">
                                        <span>Committed</span>
                                        <span>{new Date(distState.committedAt).toLocaleString()}</span>
                                    </div>
                                )}
                                {distState.archive.length > 0 && (
                                    <div className="flex justify-between">
                                        <span>Archived runs</span>
                                        <span>{distState.archive.length}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </main>
    )
}
