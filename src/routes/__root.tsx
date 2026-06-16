import type { ReactNode } from 'react'
import {
    Outlet,
    createRootRoute,
    HeadContent,
    Scripts,
    redirect,
    Link,
    useRouterState,
    useRouter,
} from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { getAuth, logout } from '@/server/auth'
import { loadBranding } from '@/server/config'
import appCss from '../styles.css?url'

function NotFound() {
    return (
        <main className="grid min-h-[60vh] place-items-center px-4 text-center">
            <div className="space-y-4">
                <p className="text-6xl font-bold text-emerald-500">404</p>
                <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
                <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
                <Link
                    to="/"
                    className="inline-block rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                    Back to home
                </Link>
            </div>
        </main>
    )
}

export const Route = createRootRoute({
    notFoundComponent: NotFound,
    // Gate every route behind the password, except the login page itself.
    beforeLoad: async ({ location }) => {
        if (location.pathname === '/login') return
        const { authed } = await getAuth()
        if (!authed) throw redirect({ to: '/login' })
    },
    // Brand strings are loaded once here and reused across the app.
    loader: () => loadBranding(),
    head: ({ loaderData }) => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: loaderData ? `${loaderData.brandName} · ${loaderData.title}` : 'Heritage Land' },
        ],
        links: [{ rel: 'stylesheet', href: appCss }],
    }),
    component: RootComponent,
})

function RootComponent() {
    return (
        <RootDocument>
            <Outlet />
        </RootDocument>
    )
}

function NavBar() {
    const router = useRouter()
    const branding = Route.useLoaderData()
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    if (pathname === '/login') return null

    const links = [
        { to: '/', label: 'Home' },
        { to: '/distribute', label: 'Distribute' },
        { to: '/report', label: 'Report' },
    ] as const

    return (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
                <Link to="/" className="mr-4 flex items-center gap-2 font-semibold tracking-tight">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-sm">
                        {branding.logoText}
                    </span>
                    <span className="hidden sm:inline">{branding.brandName}</span>
                </Link>
                {links.map((l) => (
                    <Link
                        key={l.to}
                        to={l.to}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
                        activeOptions={{ exact: l.to === '/' }}
                    >
                        {l.label}
                    </Link>
                ))}
                <button
                    onClick={async () => {
                        await logout()
                        router.navigate({ to: '/login' })
                    }}
                    className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    Sign out
                </button>
            </nav>
        </header>
    )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body className="min-h-screen bg-background text-foreground antialiased">
                <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-background to-background">
                    <NavBar />
                    {children}
                </div>
                <Toaster richColors position="top-center" />
                <Scripts />
            </body>
        </html>
    )
}
