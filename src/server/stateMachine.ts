/**
 * Pure-ish state transitions for a distribution run.
 *
 * The allocation is built **incrementally**: preassigned (pinned) documents are
 * placed when the run starts, and every other document's recipient is decided
 * at spin time by {@link assignNext} — not precomputed. Each function loads the
 * current persisted state, applies one transition, and writes it back.
 * `filePath` (and `rng`) are injectable for tests. State machine:
 * empty → draft → in_progress → committed → (rerun) draft.
 */
import type { DistributionState, SeedConfig } from '../lib/types'
import { validateConfig } from '../lib/validation'
import { assignNext, preassignedItems } from '../lib/allocation'
import { readState, writeState } from './store'

function freshRun(config: SeedConfig, archive: DistributionState['archive']): DistributionState {
    const allocation = preassignedItems(config.assets)
    const total = config.assets.length
    const done = allocation.length >= total // edge case: everything preassigned
    const now = new Date().toISOString()
    return {
        status: done ? 'committed' : 'draft',
        allocation,
        revealedCount: allocation.length,
        startedAt: now,
        committedAt: done ? now : null,
        archive,
    }
}

/**
 * Begin a new run: validate the seed and place the preassigned documents. The
 * remaining recipients are decided later, one per spin. Throws if validation
 * fails or a run is already in progress / committed.
 */
export async function startDistributionLogic(config: SeedConfig, filePath?: string): Promise<DistributionState> {
    const validation = validateConfig(config)
    if (!validation.valid) {
        throw new Error(validation.errors.map((e) => e.message).join('; '))
    }

    const state = await readState(filePath)
    if (state.status === 'in_progress') throw new Error('Distribution already in progress')
    if (state.status === 'committed') throw new Error('Distribution committed. Use rerun to start a new one.')

    const newState = freshRun(config, state.archive)
    await writeState(newState, filePath)
    return newState
}

/**
 * Assign the next document to a randomly chosen eligible member (decided now,
 * not precomputed). Advances `draft` → `in_progress`, and flips to `committed`
 * (stamping `committedAt`) once the final document is assigned. Throws if not
 * spinnable or everything is already assigned.
 */
export async function recordSpinLogic(
    config: SeedConfig,
    filePath?: string,
    rng: () => number = Math.random,
): Promise<DistributionState> {
    const state = await readState(filePath)
    if (state.status !== 'draft' && state.status !== 'in_progress') {
        throw new Error('Cannot spin in current state')
    }
    const total = config.assets.length
    if (state.allocation.length >= total) {
        throw new Error('All documents already assigned')
    }

    const next = assignNext(config.members, config.assets, state.allocation, rng)
    if (!next) throw new Error('No document left to assign')

    const allocation = [...state.allocation, next]
    const done = allocation.length >= total
    const newState: DistributionState = {
        ...state,
        allocation,
        revealedCount: allocation.length,
        status: done ? 'committed' : 'in_progress',
        committedAt: done ? new Date().toISOString() : state.committedAt,
    }
    await writeState(newState, filePath)
    return newState
}

/**
 * Archive a committed run and start a fresh draft (preassigned re-placed).
 * Only valid from `committed`; throws otherwise.
 */
export async function rerunDistributionLogic(config: SeedConfig, filePath?: string): Promise<DistributionState> {
    const state = await readState(filePath)
    if (state.status !== 'committed') {
        throw new Error('Can only rerun a committed distribution')
    }

    const now = new Date().toISOString()
    const archive = [
        ...state.archive,
        { archivedAt: now, allocation: state.allocation, revealedCount: state.revealedCount },
    ]
    const newState = freshRun(config, archive)
    await writeState(newState, filePath)
    return newState
}
