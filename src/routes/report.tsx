import { createFileRoute, Link, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { Download, ChevronDown, ChevronUp } from 'lucide-react'
import { loadConfig } from '@/server/config'
import { getDistributionState } from '@/server/distribution'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { exportMemberPdf } from '@/lib/pdf'
import type { Classification, Member, Asset, RevealItem } from '@/lib/types'

export const Route = createFileRoute('/report')({
    component: ReportPage,
    loader: () => Promise.all([getDistributionState(), loadConfig()]),
})

const CLS_COLOR: Record<Classification, string> = {
    top: 'bg-amber-100 text-amber-800 border-amber-300',
    middle: 'bg-blue-100 text-blue-800 border-blue-300',
    bottom: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}
const CLASS_ORDER: Classification[] = ['top', 'middle', 'bottom']

function ReportPage() {
    const [state, { config }] = Route.useLoaderData()
    const branding = useLoaderData({ from: '__root__' })
    const revealed = state.allocation.slice(0, state.revealedCount)
    const assetOf = (cert: string): Asset | undefined => config.assets.find((a) => a.certificateNumber === cert)

    if (revealed.length === 0) {
        return (
            <main className="mx-auto max-w-2xl p-8 text-center space-y-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted text-3xl">📋</div>
                <h1 className="text-xl font-bold">No distribution yet</h1>
                <p className="text-sm text-muted-foreground">
                    Once documents are distributed, this page will show each member's allocation.
                </p>
                <Button asChild>
                    <Link to="/distribute">Go to distribution →</Link>
                </Button>
            </main>
        )
    }

    const isCommitted = state.status === 'committed'
    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Distribution report</h1>
                        {isCommitted ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                Final
                            </span>
                        ) : (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                                In progress
                            </span>
                        )}
                    </div>
                    {state.committedAt && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            Committed {new Date(state.committedAt).toLocaleString()}
                        </p>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        config.members.forEach((m) =>
                            exportMemberPdf({
                                member: m,
                                items: revealed,
                                assets: config.assets,
                                committedAt: state.committedAt,
                                branding,
                            }),
                        )
                    }
                >
                    <Download className="mr-1.5 h-4 w-4" />
                    Export all (PDF per member)
                </Button>
            </div>

            {/* Summary stats */}
            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Members', value: config.members.length },
                    { label: 'Documents revealed', value: `${revealed.length} / ${state.allocation.length}` },
                    { label: 'Archived runs', value: state.archive.length },
                ].map(({ label, value }) => (
                    <Card key={label}>
                        <CardContent className="pt-5 pb-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Per-member */}
            <div className="space-y-3">
                {config.members.map((m) => (
                    <MemberReport
                        key={m.id}
                        member={m}
                        items={revealed.filter((i) => i.memberId === m.id)}
                        assetOf={assetOf}
                        allAssets={config.assets}
                        onExport={() =>
                            exportMemberPdf({
                                member: m,
                                items: revealed,
                                assets: config.assets,
                                committedAt: state.committedAt,
                                branding,
                            })
                        }
                    />
                ))}
            </div>
        </main>
    )
}

function MemberReport({
    member,
    items,
    assetOf,
    allAssets,
    onExport,
}: {
    member: Member
    items: RevealItem[]
    assetOf: (cert: string) => Asset | undefined
    allAssets: Asset[]
    onExport: () => void
}) {
    const [open, setOpen] = useState(items.length > 0)
    const byClass = CLASS_ORDER.map((cls) => ({ cls, count: items.filter((i) => i.classification === cls).length }))
    const sorted = items
        .slice()
        .sort((a, b) => CLASS_ORDER.indexOf(a.classification) - CLASS_ORDER.indexOf(b.classification))

    return (
        <Card className={items.length === 0 ? 'opacity-60' : ''}>
            <CardHeader
                className="flex cursor-pointer flex-row items-center justify-between gap-3 space-y-0 select-none"
                onClick={() => setOpen((o) => !o)}
            >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{member.name}</CardTitle>
                        {byClass.map(({ cls, count }) =>
                            count > 0 ? (
                                <span
                                    key={cls}
                                    className={`rounded-full border px-2 py-0.5 text-xs capitalize ${CLS_COLOR[cls]}`}
                                >
                                    {cls}: {count}
                                </span>
                            ) : null,
                        )}
                    </div>
                    {items.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{items.length} documents</p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={items.length === 0}
                        onClick={(e) => {
                            e.stopPropagation()
                            onExport()
                        }}
                    >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        PDF
                    </Button>
                    {open ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </CardHeader>

            {open && items.length > 0 && (
                <CardContent className="pt-0">
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <th className="px-3 py-2">Certificate</th>
                                    <th className="px-3 py-2">Owner</th>
                                    <th className="px-3 py-2 hidden md:table-cell">Location</th>
                                    <th className="px-3 py-2 text-right">Area</th>
                                    <th className="px-3 py-2">Class</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((it) => {
                                    const a = assetOf(it.certificateNumber)
                                    const isPreassigned = a?.preassignedTo === member.id
                                    return (
                                        <tr
                                            key={it.certificateNumber}
                                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                                        >
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs">{it.certificateNumber}</span>
                                                    {isPreassigned && (
                                                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-300">
                                                            pinned
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">{a?.name ?? '—'}</td>
                                            <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                                                {a?.location ?? '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {a ? `${a.area.toLocaleString()} m²` : '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={`rounded-full border px-2 py-0.5 text-xs capitalize ${CLS_COLOR[it.classification]}`}
                                                >
                                                    {it.classification}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            )}
        </Card>
    )
}
