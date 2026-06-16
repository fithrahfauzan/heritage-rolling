import { useSession } from '@tanstack/react-start/server'

/** Shape of the data stored in the sealed auth cookie. */
export interface AppSessionData {
    authed?: boolean
}

/**
 * Access the app's sealed (encrypted) session cookie.
 *
 * Backed by h3's `useSession`, so the cookie is tamper-proof. The sealing
 * password comes from `SESSION_SECRET` (must be ≥ 32 chars); a default is
 * provided for local dev — override it in production via the environment.
 */
export function useAppSession() {
    return useSession<AppSessionData>({
        name: 'hr_auth',
        password: process.env.SESSION_SECRET ?? 'dev-only-insecure-session-secret-change-me-0001',
    })
}
