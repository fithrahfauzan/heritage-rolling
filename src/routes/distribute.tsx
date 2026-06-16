import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Download, FileText } from 'lucide-react'
import { loadConfig } from '@/server/config'
import { getDistributionState, startDistribution, recordSpin, rerunDistribution } from '@/server/distribution'
import { SpinWheel } from '@/components/SpinWheel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportMemberPdf } from '@/lib/pdf'
import type { Classification, Member, Asset, RevealItem, DistributionState } from '@/lib/types'

export const Route = createFileRoute('/distribute')({
    component: DistributePage,
    loader: () => Promise.all([getDistributionState(), loadConfig()]),
})

const CLS_COLOR: Record<Classification, string> = {
    top: 'bg-amber-100 text-amber-800 border-amber-300',
    middle: 'bg-blue-100 text-blue-800 border-blue-300',
    bottom: 'bg-green-100 text-green-800 border-green-300',
}

function Badge({ cls }: { cls: Classification }) {
    return (
        <span
            className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${CLS_COLOR[cls]}`}
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
    const autoPlayRef = useRef(autoPlay)
    autoPlayRef.current = autoPlay

    // The next item to reveal (index = revealedCount)
    const nextItem = state.allocation[state.revealedCount]
    const currentAsset = nextItem ? config.assets.find((a) => a.certificateNumber === nextItem.certificateNumber) : null
    const isDone = state.status === 'committed' || state.revealedCount >= state.allocation.length

    // Progress per classification
    const clsCounts = (['top', 'middle', 'bottom'] as Classification[]).map((cls) => {
        const total = state.allocation.filter((i) => i.classification === cls).length
        const revealed = state.allocation.slice(0, state.revealedCount).filter((i) => i.classification === cls).length
        return { cls, revealed, total }
    })

    const handleSpin = useCallback(async () => {
        if (spinning || isDone) return
        try {
            const newState = await recordSpin()
            return newState
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Spin failed')
        }
    }, [spinning, isDone])

    function onLanded(memberId: string) {
        const member = config.members.find((m) => m.id === memberId)
        toast.success(`${member?.name ?? memberId} receives the document!`)
        setSpinning(false)
        router.invalidate()
    }

    // Auto-play: after landing, wait briefly then spin again
    useEffect(() => {
        if (!autoPlayRef.current || spinning || isDone) return
        if (state.status !== 'in_progress' && state.status !== 'draft') return
        const t = setTimeout(async () => {
            if (!autoPlayRef.current) return
            setSpinning(true)
            await handleSpin()
        }, 800)
        return () => clearTimeout(t)
    }, [state.revealedCount, spinning, isDone, state.status, handleSpin])

    if (!validation.valid) {
        return (
            <main className="mx-auto max-w-xl p-8">
                <h1 className="text-xl font-bold text-destructive mb-4">Configuration Error</h1>
                <ul className="text-sm text-destructive list-disc pl-4">
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
        <main className="mx-auto max-w-6xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Distribution</h1>
                    <p className="text-sm text-muted-foreground">Spin to award each land document fairly.</p>
                </div>
                {isDone && (
                    <Button asChild variant="outline" size="sm">
                        <Link to="/report">View full report →</Link>
                    </Button>
                )}
            </div>

            {/* Progress */}
            <div className="flex flex-wrap gap-3 items-center text-sm">
                {clsCounts.map(({ cls, revealed, total }) => (
                    <span key={cls} className="flex items-center gap-1">
                        <Badge cls={cls} />
                        <span className="text-muted-foreground">
                            {revealed}/{total}
                        </span>
                    </span>
                ))}
                <span className="ml-auto font-medium">
                    {state.revealedCount} / {state.allocation.length} revealed
                </span>
            </div>

            {isDone ? (
                <Card className="border-emerald-300 bg-emerald-50/70">
                    <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-4">
                        <p className="font-semibold text-emerald-800">✓ Distribution complete</p>
                        <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => setRerunOpen(true)}>
                                Rerun distribution
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                                {nextItem ? (
                                    <>
                                        Now spinning: <Badge cls={nextItem.classification} />
                                    </>
                                ) : state.status === 'empty' ? (
                                    'Not started'
                                ) : (
                                    'Loading…'
                                )}
                            </CardTitle>
                        </div>
                    </CardHeader>
                    {currentAsset && (
                        <CardContent className="text-sm space-y-1 text-muted-foreground">
                            <p>
                                <span className="font-medium text-foreground">{currentAsset.certificateNumber}</span> ·
                                owner {currentAsset.name}
                            </p>
                            <p>
                                {currentAsset.location} · {currentAsset.area.toLocaleString()} m²
                            </p>
                        </CardContent>
                    )}
                </Card>
            )}

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Wheel + controls */}
                <div className="flex flex-col items-center gap-4">
                    {state.status === 'empty' ? (
                        <Button
                            size="lg"
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
                    ) : (
                        <>
                            <SpinWheel
                                members={config.members}
                                targetMemberId={nextItem?.memberId ?? config.members[0]!.id}
                                spinning={spinning}
                                onLanded={onLanded}
                            />
                            <div className="flex items-center gap-3 flex-wrap justify-center">
                                <Button
                                    size="lg"
                                    disabled={spinning || isDone}
                                    onClick={async () => {
                                        setSpinning(true)
                                        await handleSpin()
                                    }}
                                >
                                    {spinning ? 'Spinning…' : 'Spin'}
                                </Button>
                                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
                        </>
                    )}
                </div>

                {/* Results board */}
                <div className="flex-1 overflow-x-auto">
                    <ResultsBoard
                        members={config.members}
                        assets={config.assets}
                        allocation={state.allocation}
                        revealedCount={state.revealedCount}
                        committedAt={state.committedAt}
                    />
                </div>
            </div>

            {/* Archive */}
            {state.archive.length > 0 && (
                <div className="mt-4">
                    <h2 className="font-semibold mb-2 text-sm text-muted-foreground">
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

            {/* Rerun dialog */}
            {rerunOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
                        <h2 className="font-semibold text-lg">Rerun distribution?</h2>
                        <p className="text-sm text-muted-foreground">
                            This will archive the current distribution and compute a new one. This cannot be undone.
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

// --- Results Board (inline) ---

function ResultsBoard({
    members,
    assets,
    allocation,
    revealedCount,
    committedAt,
}: {
    members: Member[]
    assets: Asset[]
    allocation: RevealItem[]
    revealedCount: number
    committedAt: DistributionState['committedAt']
}) {
    const revealed = allocation.slice(0, revealedCount)
    const isRevealed = (cert: string) => revealed.some((r) => r.certificateNumber === cert)
    const assetOf = (cert: string) => assets.find((a) => a.certificateNumber === cert)

    return (
        <div className="space-y-4" data-testid="results-board">
            {(['top', 'middle', 'bottom'] as Classification[]).map((cls) => {
                const clsItems = allocation.filter((i) => i.classification === cls)
                if (clsItems.length === 0) return null
                return (
                    <div key={cls}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-2">
                            <Badge cls={cls} />
                        </h3>
                        <div
                            className="grid gap-2"
                            style={{ gridTemplateColumns: `repeat(${members.length}, minmax(70px, 1fr))` }}
                        >
                            {members.map((m) => {
                                const memberCls = clsItems.filter((i) => i.memberId === m.id)
                                const memberRevealed = memberCls.filter((i) => isRevealed(i.certificateNumber))
                                return (
                                    <div key={m.id}>
                                        <div className="mb-1 flex items-center justify-between gap-1">
                                            <p className="text-xs font-medium truncate" title={m.name}>
                                                {m.name}
                                            </p>
                                            {cls === 'top' && memberRevealed.length > 0 && (
                                                <button
                                                    title={`Export ${m.name}'s documents as PDF`}
                                                    onClick={() =>
                                                        exportMemberPdf({
                                                            member: m,
                                                            items: revealed,
                                                            assets,
                                                            committedAt,
                                                        })
                                                    }
                                                    className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            {memberCls.map((item) => {
                                                const revealedNow = isRevealed(item.certificateNumber)
                                                const asset = assetOf(item.certificateNumber)
                                                if (!revealedNow || !asset) {
                                                    return (
                                                        <div
                                                            key={item.certificateNumber}
                                                            className="rounded border p-1.5 text-xs bg-muted/40 text-muted-foreground"
                                                        >
                                                            <p>—</p>
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <div
                                                        key={item.certificateNumber}
                                                        className="group relative cursor-default rounded border bg-card p-1.5 text-xs transition-all hover:border-emerald-400 hover:shadow-sm"
                                                    >
                                                        <p className="font-medium leading-tight truncate">
                                                            {asset.certificateNumber}
                                                        </p>
                                                        <p className="text-muted-foreground truncate">{asset.name}</p>
                                                        {/* Hover details popover */}
                                                        <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-56 -translate-x-1/2 rounded-lg border bg-popover p-3 text-left shadow-xl group-hover:block">
                                                            <p className="font-semibold">{asset.certificateNumber}</p>
                                                            <dl className="mt-1 space-y-0.5 text-muted-foreground">
                                                                <div className="flex justify-between gap-2">
                                                                    <dt>Owner</dt>
                                                                    <dd className="text-right text-foreground">
                                                                        {asset.name}
                                                                    </dd>
                                                                </div>
                                                                <div className="flex justify-between gap-2">
                                                                    <dt>Location</dt>
                                                                    <dd className="text-right text-foreground">
                                                                        {asset.location}
                                                                    </dd>
                                                                </div>
                                                                <div className="flex justify-between gap-2">
                                                                    <dt>Area</dt>
                                                                    <dd className="text-right text-foreground">
                                                                        {asset.area.toLocaleString()} m²
                                                                    </dd>
                                                                </div>
                                                                <div className="flex justify-between gap-2">
                                                                    <dt>Class</dt>
                                                                    <dd className="text-right capitalize text-foreground">
                                                                        {item.classification}
                                                                    </dd>
                                                                </div>
                                                            </dl>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
            {revealedCount > 0 && (
                <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Hover a document for details. Use the <Download className="inline h-3 w-3" /> icon above each member
                    to export their documents as PDF.
                </p>
            )}
        </div>
    )
}
