import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

/**
 * Router factory consumed by TanStack Start.
 *
 * Start calls `getRouter()` on both the server and the client to build a fresh
 * router instance per request/hydration. Adjust router-wide defaults here
 * (preloading, scroll restoration, default error/pending components, etc.).
 */
export function getRouter() {
    return createRouter({
        routeTree,
        scrollRestoration: true,
        defaultPreload: 'intent',
    })
}
