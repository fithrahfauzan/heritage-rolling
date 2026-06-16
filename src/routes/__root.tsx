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
import appCss from '../styles.css?url'

export const Route = createRootRoute({
    // Gate every route behind the password, except the login page itself.
    beforeLoad: async ({ location }) => {
        if (location.pathname === '/login') return
        const { authed } = await getAuth()
        if (!authed) throw redirect({ to: '/login' })
    },
    head: () => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: 'Heritage Land Distribution' },
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
                        HL
                    </span>
                    <span className="hidden sm:inline">Heritage Land</span>
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
