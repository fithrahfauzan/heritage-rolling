import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { login } from '@/server/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/login')({
    component: LoginPage,
})

function LoginPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            await login({ data: { password } })
            toast.success('Welcome back')
            router.navigate({ to: '/' })
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Login failed')
            setSubmitting(false)
        }
    }

    return (
        <main className="grid min-h-screen place-items-center px-4">
            <Card className="w-full max-w-sm border-border/70 shadow-lg">
                <CardHeader className="space-y-3 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-bold text-white shadow-md">
                        HL
                    </div>
                    <CardTitle className="text-xl">Heritage Land Distribution</CardTitle>
                    <p className="text-sm text-muted-foreground">Enter the access password to continue.</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <input
                            type="password"
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-ring/40 transition focus:ring-2"
                        />
                        <Button type="submit" className="w-full" disabled={submitting || !password}>
                            {submitting ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
