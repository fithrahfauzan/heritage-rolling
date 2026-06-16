import { createFileRoute, useRouter, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { login } from '@/server/auth'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/login')({
    component: LoginPage,
})

function LoginPage() {
    const router = useRouter()
    const branding = useLoaderData({ from: '__root__' })
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
        <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-900 px-4">
            {/* Background grid */}
            <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />
            {/* Glow blobs */}
            <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />

            <div className="relative w-full max-w-sm space-y-6">
                {/* Logo */}
                <div className="text-center space-y-3">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl font-bold text-white shadow-xl shadow-emerald-900/50">
                        {branding.logoText}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">{branding.brandName}</h1>
                        <p className="text-sm text-emerald-300/80">{branding.tagline}</p>
                    </div>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm shadow-2xl">
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-emerald-200/80 uppercase tracking-wide">
                                Access Password
                            </label>
                            <input
                                type="password"
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-emerald-400/60 focus:bg-white/15 focus:ring-0"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 font-semibold text-white shadow-lg shadow-emerald-900/40 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                            disabled={submitting || !password}
                        >
                            {submitting ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </form>
                </div>
            </div>
        </main>
    )
}
