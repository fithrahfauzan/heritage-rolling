import { createFileRoute, Link, useLoaderData } from '@tanstack/react-router'
import { loadConfig } from '@/server/config'
import { getDistributionState } from '@/server/distribution'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DistributionStatus, Classification } from '@/lib/types'

export const Route = createFileRoute('/')({
    component: Home,
    loader: () => Promise.all([loadConfig(), getDistributionState()]),
})

const STATUS_META: Record<DistributionStatus, { label: string; dot: string; badge: string }> = {
    empty: { label: 'Not started', dot: 'bg-muted-foreground', badge: 'bg-muted text-muted-foreground' },
    draft: { label: 'Draft', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
    in_progress: { label: 'In progress', dot: 'bg-blue-500 animate-pulse', badge: 'bg-blue-100 text-blue-800' },
    committed: { label: 'Committed', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
}

const CLS_STYLE: Record<Classification, { bar: string; text: string; badge: string }> = {
    top: { bar: 'bg-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
    middle: { bar: 'bg-blue-400', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
    bottom: {
        bar: 'bg-emerald-400',
        text: 'text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
}

function Home() {
    const [{ config, settings, validation }, distState] = Route.useLoaderData()
    const branding = useLoaderData({ from: '__root__' })
    const status = distState.status
    const meta = STATUS_META[status]
    const totalDocs = config.assets.length
    const progress = status !== 'empty' && totalDocs ? Math.round((distState.allocation.length / totalDocs) * 100) : 0

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-transparent p-8">
                {/* decorative circles */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-400/10" />
                <div className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-teal-400/10" />

                <div className="relative flex items-start justify-between gap-4">
                    <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-600">
                            {branding.brandName}
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight">{branding.title}</h1>
                    </div>
                    <span
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                    </span>
                </div>

                {/* Distribution progress (only when a run has started) */}
                {status !== 'empty' && (
                    <div className="relative mt-6 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span className="tabular-nums font-medium text-foreground">
                                {distState.allocation.length} / {totalDocs} documents
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="relative mt-6 flex flex-wrap gap-3">
                    <Button
                        asChild
                        size="lg"
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
                    >
                        <Link to="/distribute">
                            {status === 'empty'
                                ? 'Start distribution'
                                : status === 'committed'
                                  ? 'View results'
                                  : 'Continue'}
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
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-destructive text-base">Configuration errors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-4 text-sm text-destructive/90 space-y-1">
                            {validation.errors.map((e, i) => (
                                <li key={i}>{e.message}</li>
                            ))}
                        </ul>
                        <p className="text-sm mt-3 text-muted-foreground">
                            Edit{' '}
                            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                                config/members.json · config/assets/
                            </code>{' '}
                            to fix these errors.
                        </p>
                    </CardContent>
                </Card>
            )}

            {validation.valid && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Members card */}
                    <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Members
                                </CardTitle>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                                    {config.members.length}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-sm">
                                {config.members.map((m) => (
                                    <li key={m.id} className="flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                                        {m.name}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Documents card */}
                    <Card className="transition-shadow hover:shadow-md">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Land documents
                                </CardTitle>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{totalDocs}</span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {(['top', 'middle', 'bottom'] as Classification[]).map((cls) => {
                                const items = config.assets.filter((a) => a.classification === cls)
                                const preassigned = items.filter((a) => a.preassignedTo).length
                                const perMember =
                                    cls === 'bottom' || settings.allocationMode === 'compensation'
                                        ? `~${Math.ceil(items.length / config.members.length)}`
                                        : String(items.length / config.members.length)
                                const pct = Math.round((items.length / totalDocs) * 100)
                                return (
                                    <div key={cls} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={`font-semibold capitalize ${CLS_STYLE[cls].text}`}>
                                                {cls}
                                            </span>
                                            <span className="text-muted-foreground tabular-nums">
                                                {items.length} · {perMember}/member
                                                {preassigned > 0 && (
                                                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-amber-700">
                                                        {preassigned} pinned
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={`h-full rounded-full ${CLS_STYLE[cls].bar}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Active run stats */}
            {validation.valid && status !== 'empty' && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Current run
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                        {[
                            { label: 'Status', value: meta.label },
                            {
                                label: 'Assigned',
                                value: `${distState.allocation.length} / ${totalDocs}`,
                            },
                            {
                                label: 'Started',
                                value: distState.startedAt ? new Date(distState.startedAt).toLocaleDateString() : '—',
                            },
                            { label: 'Archived runs', value: String(distState.archive.length) },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="mt-0.5 font-semibold">{value}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </main>
    )
}
