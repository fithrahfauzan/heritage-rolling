import { createServerFn } from '@tanstack/react-start'
import { useAppSession } from './session'

/** Shared password gating the app. Override via `APP_PASSWORD` in production. */
function expectedPassword(): string {
    return process.env.APP_PASSWORD ?? 'heritage'
}

/**
 * Validate the submitted password and, on success, mark the sealed session as
 * authenticated. Throws on an incorrect password.
 */
export const login = createServerFn({ method: 'POST' })
    .validator((data: { password: string }) => {
        if (typeof data?.password !== 'string') throw new Error('Password is required')
        return data
    })
    .handler(async ({ data }) => {
        if (data.password !== expectedPassword()) {
            throw new Error('Incorrect password')
        }
        const session = await useAppSession()
        await session.update({ authed: true })
        return { ok: true as const }
    })

/** Clear the session cookie. */
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
    const session = await useAppSession()
    await session.clear()
    return { ok: true as const }
})

/** Report whether the current request carries an authenticated session. */
export const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
    const session = await useAppSession()
    return { authed: session.data.authed === true }
})
