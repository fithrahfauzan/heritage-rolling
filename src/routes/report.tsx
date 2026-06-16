import { createFileRoute, Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'
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
    bottom: 'bg-green-100 text-green-800 border-green-300',
}

const CLASS_ORDER: Classification[] = ['top', 'middle', 'bottom']

function ReportPage() {
    const [state, { config }] = Route.useLoaderData()
    const revealed = state.allocation.slice(0, state.revealedCount)
    const assetOf = (cert: string): Asset | undefined => config.assets.find((a) => a.certificateNumber === cert)

    if (revealed.length === 0) {
        return (
            <main className="mx-auto max-w-2xl p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>No distribution yet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                        <p>Once documents are distributed, this report will summarise what each member received.</p>
                        <Button asChild>
                            <Link to="/distribute">Go to distribution</Link>
                        </Button>
                    </CardContent>
                </Card>
            </main>
        )
    }

    const totalArea = revealed.reduce((s, it) => s + (assetOf(it.certificateNumber)?.area ?? 0), 0)

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Distribution report</h1>
                    <p className="text-sm text-muted-foreground">
                        {state.status === 'committed' ? 'Final committed distribution.' : 'Distribution in progress.'}
                        {state.committedAt && ` Committed ${new Date(state.committedAt).toLocaleString()}.`}
                    </p>
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
                            }),
                        )
                    }
                >
                    <Download className="mr-1.5 h-4 w-4" /> Export all (PDF per member)
                </Button>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard label="Members" value={String(config.members.length)} />
                <SummaryCard label="Documents distributed" value={`${revealed.length} / ${state.allocation.length}`} />
                <SummaryCard label="Total area" value={`${totalArea.toLocaleString()} m²`} />
            </div>

            {/* Per-member breakdown */}
            <div className="space-y-4">
                {config.members.map((m) => (
                    <MemberReport
                        key={m.id}
                        member={m}
                        items={revealed.filter((i) => i.memberId === m.id)}
                        assetOf={assetOf}
                        onExport={() =>
                            exportMemberPdf({
                                member: m,
                                items: revealed,
                                assets: config.assets,
                                committedAt: state.committedAt,
                            })
                        }
                    />
                ))}
            </div>
        </main>
    )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <Card>
            <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    )
}

function MemberReport({
    member,
    items,
    assetOf,
    onExport,
}: {
    member: Member
    items: RevealItem[]
    assetOf: (cert: string) => Asset | undefined
    onExport: () => void
}) {
    const byClass = CLASS_ORDER.map((cls) => ({
        cls,
        count: items.filter((i) => i.classification === cls).length,
    }))
    const totalArea = items.reduce((s, it) => s + (assetOf(it.certificateNumber)?.area ?? 0), 0)
    const sorted = items
        .slice()
        .sort((a, b) => CLASS_ORDER.indexOf(a.classification) - CLASS_ORDER.indexOf(b.classification))

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div>
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {byClass.map(({ cls, count }) => (
                            <span key={cls} className={`rounded-full border px-2 py-0.5 capitalize ${CLS_COLOR[cls]}`}>
                                {cls}: {count}
                            </span>
                        ))}
                        <span className="rounded-full border px-2 py-0.5">
                            {items.length} docs · {totalArea.toLocaleString()} m²
                        </span>
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onExport} disabled={items.length === 0}>
                    <Download className="mr-1.5 h-4 w-4" /> PDF
                </Button>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents awarded.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <th className="p-2">Certificate</th>
                                    <th className="p-2">Owner</th>
                                    <th className="p-2">Location</th>
                                    <th className="p-2 text-right">Area</th>
                                    <th className="p-2">Class</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((it) => {
                                    const a = assetOf(it.certificateNumber)
                                    return (
                                        <tr key={it.certificateNumber} className="border-b last:border-0">
                                            <td className="p-2 font-mono text-xs">{it.certificateNumber}</td>
                                            <td className="p-2">{a?.name ?? '—'}</td>
                                            <td className="p-2 text-muted-foreground">{a?.location ?? '—'}</td>
                                            <td className="p-2 text-right">
                                                {a ? `${a.area.toLocaleString()} m²` : '—'}
                                            </td>
                                            <td className="p-2 capitalize">{it.classification}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
