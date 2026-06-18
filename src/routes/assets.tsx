import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { loadConfig } from '@/server/config'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Classification, Asset } from '@/lib/types'

export const Route = createFileRoute('/assets')({
    component: AssetsPage,
    loader: () => loadConfig(),
})

const CLS_LABEL: Record<Classification, string> = {
    top: 'Top',
    middle: 'Middle',
    bottom: 'Bottom',
}

const CLS_COLOR: Record<Classification, string> = {
    top: 'bg-amber-100 text-amber-800 border-amber-300',
    middle: 'bg-blue-100 text-blue-800 border-blue-300',
    bottom: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

function ClassAccordion({ cls, assets }: { cls: Classification; assets: Asset[] }) {
    const [open, setOpen] = useState(true)

    return (
        <Card>
            <CardHeader
                className="flex cursor-pointer flex-row items-center justify-between gap-3 space-y-0 select-none"
                onClick={() => setOpen((o) => !o)}
            >
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{CLS_LABEL[cls]}</CardTitle>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${CLS_COLOR[cls]}`}>
                        {assets.length}
                    </span>
                </div>
                {open ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
            </CardHeader>

            {open && (
                <CardContent className="pt-0">
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <th className="px-3 py-2 w-8 tabular-nums">#</th>
                                    <th className="px-3 py-2">Certificate No.</th>
                                    <th className="px-3 py-2">Owner</th>
                                    <th className="px-3 py-2 hidden md:table-cell">Location</th>
                                    <th className="px-3 py-2 text-right">Area (m²)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((a, i) => (
                                    <tr
                                        key={a.certificateNumber}
                                        className="border-b last:border-0 transition-colors hover:bg-muted/30"
                                    >
                                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                                            {i + 1}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {a.certificateNumber}
                                            {a.preassignedTo && (
                                                <span className="ml-1.5 text-amber-600" title="Pinned">
                                                    📌
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">{a.name}</td>
                                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                                            {a.location}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{a.area.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            )}
        </Card>
    )
}

function AssetsPage() {
    const { config } = Route.useLoaderData()
    const classes: Classification[] = ['top', 'middle', 'bottom']

    return (
        <main className="mx-auto max-w-5xl space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Land Documents</h1>
                    <p className="text-sm text-muted-foreground">
                        {config.assets.length} documents grouped by classification
                    </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold tabular-nums">
                    {config.assets.length} total
                </span>
            </div>

            {classes.map((cls) => (
                <ClassAccordion key={cls} cls={cls} assets={config.assets.filter((a) => a.classification === cls)} />
            ))}
        </main>
    )
}
