/**
 * Public server-function endpoints (RPC) the client calls.
 *
 * Each wraps the corresponding pure logic in `stateMachine.ts` and reads the
 * seed via `loadConfig`. NOTE: these are unauthenticated — anyone who can reach
 * the app can start/spin/rerun. Add auth/middleware before public exposure.
 */
import { createServerFn } from '@tanstack/react-start'
import { readState } from './store'
import { startDistributionLogic, recordSpinLogic, rerunDistributionLogic } from './stateMachine'
import { loadConfig } from './config'

/** Read the current persisted distribution state. */
export const getDistributionState = createServerFn({ method: 'GET' }).handler(() => readState())

/** Start a new distribution run from the seed config. */
export const startDistribution = createServerFn({ method: 'POST' }).handler(async () => {
    const { config, settings } = await loadConfig()
    return startDistributionLogic(config, undefined, settings.allocationMode)
})

/** Assign the next document to a randomly chosen eligible member (decided now). */
export const recordSpin = createServerFn({ method: 'POST' }).handler(async () => {
    const { config, settings } = await loadConfig()
    return recordSpinLogic(config, undefined, Math.random, settings.allocationMode)
})

/** Archive the committed run and start a fresh draft. */
export const rerunDistribution = createServerFn({ method: 'POST' }).handler(async () => {
    const { config } = await loadConfig()
    return rerunDistributionLogic(config)
})
