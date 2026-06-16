import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { loadConfig } from '@/server/config'
import { getDistributionState, startDistribution, recordSpin, rerunDistribution } from '@/server/distribution'
import { SpinWheel } from '@/components/SpinWheel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Classification, Member, Asset, RevealItem } from '@/lib/types'

export const Route = createFileRoute('/distribute')({
    component: DistributePage,
    loader: () => Promise.all([getDistributionState(), loadConfig()]),
})

const CLS_ORDER: Classification[] = ['top', 'middle', 'bottom']

/** How long the wheel spins (ms) before landing on the chosen member. */
const SPIN_DURATION_MS = 10000

const CLS_COLOR: Record<Classification, string> = {
    top: 'bg-amber-100 text-amber-800 border-amber-300',
    middle: 'bg-blue-100 text-blue-800 border-blue-300',
    bottom: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

function ClsBadge({ cls }: { cls: Classification }) {
    return (
        <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${CLS_COLOR[cls]}`}
        >
            {cls}
        </span>
    )
}

function DistributePage() {
    const [state, { config, validation }] = Route.useLoaderData()
    const router = useRouter()

    const [spinning, setSpinning] = useState(false)
    const [autoPlay, setAutoPlay] = useState(false)
    const [rerunOpen, setRerunOpen] = useState(false)
    // The recipient just decided by the server for the in-flight spin.
    const [pendingWinner, setPendingWinner] = useState<RevealItem | null>(null)
    const autoPlayRef = useRef(autoPlay)
    autoPlayRef.current = autoPlay
    const busyRef = useRef(false)

    const total = config.assets.length
    const assignedCerts = new Set(state.allocation.map((i) => i.certificateNumber))
    const isDone = state.status === 'committed' || (state.status !== 'empty' && state.allocation.length >= total)

    // The next document up for a spin — deterministic (top→middle→bottom, config order);
    // only the recipient is decided at spin time on the server.
    const nextDoc = (() => {
        for (const cls of CLS_ORDER) {
            const doc = config.assets.find((a) => a.classification === cls && !assignedCerts.has(a.certificateNumber))
            if (doc) return doc
        }
        return null
    })()

    const clsCounts = CLS_ORDER.map((cls) => {
        const total = config.assets.filter((a) => a.classification === cls).length
        const done = state.allocation.filter((i) => i.classification === cls).length
        return { cls, done, total }
    })

    const doSpin = useCallback(async () => {
        if (busyRef.current || spinning || isDone || !nextDoc) return
        busyRef.current = true
        try {
            const newState = await recordSpin()
            const winner = newState.allocation[newState.allocation.length - 1] ?? null
            setPendingWinner(winner)
            setSpinning(true) // wheel animates to winner now that target is set
        } catch (e: unknown) {
            busyRef.current = false
            toast.error(e instanceof Error ? e.message : 'Spin failed')
        }
    }, [spinning, isDone, nextDoc])

    function onLanded(memberId: string) {
        const member = config.members.find((m) => m.id === memberId)
        const cert = pendingWinner?.certificateNumber ?? ''
        toast.success(`${member?.name ?? memberId} receives ${cert}`)
        setSpinning(false)
        setPendingWinner(null)
        busyRef.current = false
        router.invalidate()
    }

    // Auto-play: keep spinning until done.
    useEffect(() => {
        if (!autoPlayRef.current || spinning || isDone) return
        if (state.status !== 'in_progress' && state.status !== 'draft') return
        const t = setTimeout(() => {
            if (autoPlayRef.current) doSpin()
        }, 700)
        return () => clearTimeout(t)
    }, [state.allocation.length, spinning, isDone, state.status, doSpin])

    if (!validation.valid) {
        return (
            <main className="mx-auto max-w-xl p-8">
                <h1 className="mb-4 text-xl font-bold text-destructive">Configuration error</h1>
                <ul className="list-disc pl-4 text-sm text-destructive">
                    {validation.errors.map((e, i) => (
                        <li key={i}>{e.message}</li>
                    ))}
                </ul>
                <Button asChild variant="outline" className="mt-4">
                    <Link to="/">← Back</Link>
                </Button>
            </main>
        )
    }

    return (
        <main className="mx-auto max-w-6xl space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Distribution</h1>
                    <p className="text-sm text-muted-foreground">
                        {state.status === 'empty'
                            ? 'Ready to begin.'
                            : 'Each spin decides the recipient live — pinned documents are awarded automatically.'}
                    </p>
                </div>
                {isDone && (
                    <Button asChild variant="outline" size="sm">
                        <Link to="/report">View full report →</Link>
                    </Button>
                )}
            </div>

            {/* Progress */}
            {state.status !== 'empty' && (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        {clsCounts.map(({ cls, done, total }) => (
                            <span key={cls} className="flex items-center gap-1.5">
                                <ClsBadge cls={cls} />
                                <span className="tabular-nums text-muted-foreground">
                                    {done}/{total}
                                </span>
                            </span>
                        ))}
                        <span className="ml-auto font-semibold tabular-nums">
                            {state.allocation.length} / {total}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                            style={{ width: `${total ? (state.allocation.length / total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Wheel + status row */}
            {state.status === 'empty' ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 px-12 py-12 text-center">
                    <span className="text-5xl">🎡</span>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        Pinned documents are awarded automatically. Every other recipient is decided live, one spin at a
                        time.
                    </p>
                    <Button
                        size="lg"
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:from-emerald-700 hover:to-teal-700"
                        onClick={async () => {
                            try {
                                await startDistribution()
                                toast.success('Distribution started')
                                router.invalidate()
                            } catch (e: unknown) {
                                toast.error(e instanceof Error ? e.message : 'Failed to start')
                            }
                        }}
                    >
                        Start distribution
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
                    {/* Wheel + controls */}
                    <div className="flex flex-col items-center gap-4">
                        <SpinWheel
                            members={config.members}
                            targetMemberId={pendingWinner?.memberId ?? config.members[0]!.id}
                            spinning={spinning}
                            onLanded={onLanded}
                            durationMs={SPIN_DURATION_MS}
                        />
                        <div className="flex items-center gap-3">
                            <Button
                                size="lg"
                                disabled={spinning || isDone}
                                onClick={doSpin}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                            >
                                {spinning ? 'Spinning…' : isDone ? 'Done' : 'Spin'}
                            </Button>
                            <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 cursor-pointer"
                                    checked={autoPlay}
                                    onChange={(e) => setAutoPlay(e.target.checked)}
                                    disabled={isDone}
                                />
                                Auto-play
                            </label>
                        </div>

                        {/* Current / status card */}
                        {isDone ? (
                            <Card className="w-full border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50">
                                <CardContent className="flex items-center gap-3 py-4">
                                    <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-lg">
                                        ✓
                                    </span>
                                    <div>
                                        <p className="font-semibold text-emerald-900">Distribution complete</p>
                                        {state.committedAt && (
                                            <p className="text-xs text-emerald-700">
                                                {new Date(state.committedAt).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : nextDoc ? (
                            <Card className="w-full border-emerald-200 bg-emerald-50/40">
                                <CardContent className="space-y-1 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Up next
                                        </span>
                                        <ClsBadge cls={nextDoc.classification} />
                                    </div>
                                    <p className="font-bold tracking-tight">{nextDoc.certificateNumber}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Owner: <span className="text-foreground">{nextDoc.name}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">{nextDoc.location}</p>
                                    <p className="text-xs text-muted-foreground">{nextDoc.area.toLocaleString()} m²</p>
                                </CardContent>
                            </Card>
                        ) : null}
                    </div>

                    {/* Results board */}
                    <ResultsBoard
                        members={config.members}
                        assets={config.assets}
                        allocation={state.allocation}
                        total={total}
                    />
                </div>
            )}

            {/* Archive */}
            {state.archive.length > 0 && (
                <div>
                    <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                        Archive ({state.archive.length} prior runs)
                    </h2>
                    <div className="space-y-2">
                        {state.archive.map((run, i) => (
                            <details key={i} className="rounded-lg border p-3 text-sm">
                                <summary className="cursor-pointer font-medium">
                                    Run {i + 1} — {new Date(run.archivedAt).toLocaleString()} — {run.revealedCount}{' '}
                                    documents
                                </summary>
                                <p className="mt-2 text-muted-foreground">
                                    {run.allocation.length} total documents distributed
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            )}

            {/* Rerun + footer actions */}
            {isDone && (
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setRerunOpen(true)}>
                        Rerun distribution
                    </Button>
                </div>
            )}

            {rerunOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="mx-4 w-full max-w-md space-y-4 rounded-xl bg-background p-6 shadow-xl">
                        <h2 className="text-lg font-semibold">Rerun distribution?</h2>
                        <p className="text-sm text-muted-foreground">
                            This will archive the current distribution and start a new one. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRerunOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={async () => {
                                    try {
                                        await rerunDistribution()
                                        toast.success('New distribution started')
                                        setRerunOpen(false)
                                        router.invalidate()
                                    } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : 'Rerun failed')
                                    }
                                }}
                            >
                                Confirm rerun
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

// ---------------------------------------------------------------------------
// Results board — member-per-row, readable for many members.
// Document chips reveal a styled hover popover (owner, location, area).
// ---------------------------------------------------------------------------

function ResultsBoard({
    members,
    assets,
    allocation,
    total,
}: {
    members: Member[]
    assets: Asset[]
    allocation: RevealItem[]
    total: number
}) {
    const assetOf = (cert: string) => assets.find((a) => a.certificateNumber === cert)

    return (
        <div className="space-y-2" data-testid="results-board">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Results</h2>
                <p className="text-xs text-muted-foreground tabular-nums">
                    {allocation.length}/{total} assigned
                </p>
            </div>

            <div className="space-y-1.5">
                {members.map((m) => {
                    const items = allocation
                        .filter((i) => i.memberId === m.id)
                        .slice()
                        .sort((a, b) => CLS_ORDER.indexOf(a.classification) - CLS_ORDER.indexOf(b.classification))
                    return (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                            <p className="w-32 shrink-0 truncate text-sm font-medium" title={m.name}>
                                {m.name}
                            </p>
                            <div className="flex flex-1 flex-wrap gap-1.5">
                                {items.length === 0 ? (
                                    <span className="text-xs text-muted-foreground/60">—</span>
                                ) : (
                                    items.map((item) => {
                                        const asset = assetOf(item.certificateNumber)
                                        return (
                                            <div
                                                key={item.certificateNumber}
                                                className="group/chip relative inline-block"
                                            >
                                                <span
                                                    className={`inline-flex cursor-default items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:brightness-95 ${CLS_COLOR[item.classification]}`}
                                                >
                                                    {item.preassigned && <span aria-label="pinned">📌</span>}
                                                    {item.certificateNumber}
                                                </span>
                                                {/* Hover details popover */}
                                                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-60 max-w-[80vw] -translate-x-1/2 rounded-lg border bg-popover p-3 text-left shadow-xl group-hover/chip:block">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-mono text-xs font-semibold">
                                                            {item.certificateNumber}
                                                        </p>
                                                        <span
                                                            className={`rounded-full border px-1.5 py-0.5 text-[10px] capitalize ${CLS_COLOR[item.classification]}`}
                                                        >
                                                            {item.classification}
                                                        </span>
                                                    </div>
                                                    {item.preassigned && (
                                                        <p className="mt-1 text-[10px] font-medium text-amber-600">
                                                            📌 Pinned assignment
                                                        </p>
                                                    )}
                                                    <dl className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                                                        <div className="flex justify-between gap-3">
                                                            <dt>Owner</dt>
                                                            <dd className="text-right text-foreground">
                                                                {asset?.name ?? '—'}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-3">
                                                            <dt>Location</dt>
                                                            <dd className="text-right text-foreground">
                                                                {asset?.location ?? '—'}
                                                            </dd>
                                                        </div>
                                                        <div className="flex justify-between gap-3">
                                                            <dt>Area</dt>
                                                            <dd className="text-right text-foreground">
                                                                {asset ? `${asset.area.toLocaleString()} m²` : '—'}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-popover" />
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                {items.length}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
