import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { loadConfig } from '@/server/config'
import { computeAllocation, summariseAllocation } from '@/lib/allocation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

function DebugPage() {
    const { error, allocation, summary, config } = Route.useLoaderData()

    if (error) {
        return (
            <main className="p-8">
                <h1 className="text-xl font-bold text-destructive mb-4">Config Errors</h1>
                <ul className="list-disc pl-4 text-sm text-destructive">
                    {error.map((e, i) => (
                        <li key={i}>{e.message}</li>
                    ))}
                </ul>
            </main>
        )
    }

    return (
        <main className="mx-auto max-w-4xl space-y-6 p-8">
            <h1 className="text-xl font-bold">Allocation Debug</h1>

            <div className="grid gap-4 sm:grid-cols-3">
                {config.members.map((m) => {
                    const s = summary![m.id]!
                    return (
                        <Card key={m.id}>
                            <CardHeader>
                                <CardTitle className="text-sm">{m.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span>Top</span>
                                    <span>{s.top}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Middle</span>
                                    <span>{s.middle}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bottom</span>
                                    <span>{s.bottom}</span>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Reveal Sequence ({allocation!.length} items)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-1">#</th>
                                    <th className="text-left p-1">Class</th>
                                    <th className="text-left p-1">Certificate</th>
                                    <th className="text-left p-1">Member</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocation!.map((item, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="p-1 text-muted-foreground">{i + 1}</td>
                                        <td className="p-1 capitalize">{item.classification}</td>
                                        <td className="p-1 font-mono">{item.certificateNumber}</td>
                                        <td className="p-1">
                                            {config.members.find((m) => m.id === item.memberId)?.name}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </main>
    )
}
