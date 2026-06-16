/**
 * Pure-ish state transitions for a distribution run.
 *
 * Each function loads the current persisted state, applies one transition, and
 * writes the result back. `filePath` is injectable for tests. See the state
 * machine in docs/PRD.md: empty → draft → in_progress → committed → (rerun) draft.
 */
import type { DistributionState, SeedConfig } from '../lib/types'
import { validateConfig } from '../lib/validation'
import { computeAllocation } from '../lib/allocation'
import { readState, writeState } from './store'

/**
 * Begin a new run: validate the seed, compute the allocation, and persist a
 * `draft`. Throws if validation fails or a run is already in progress/committed.
 */
export async function startDistributionLogic(config: SeedConfig, filePath?: string): Promise<DistributionState> {
    const validation = validateConfig(config)
    if (!validation.valid) {
        throw new Error(validation.errors.map((e) => e.message).join('; '))
    }

    const state = await readState(filePath)
    if (state.status === 'in_progress') throw new Error('Distribution already in progress')
    if (state.status === 'committed') throw new Error('Distribution committed. Use rerun to start a new one.')

    const allocation = computeAllocation(config.members, config.assets)
    const newState: DistributionState = {
        status: 'draft',
        allocation,
        revealedCount: 0,
        startedAt: new Date().toISOString(),
        committedAt: null,
        archive: state.archive,
    }
    await writeState(newState, filePath)
    return newState
}

/**
 * Reveal the next asset in the predetermined sequence. Advances `draft` →
 * `in_progress`, and flips to `committed` (stamping `committedAt`) once the
 * final asset is revealed. Throws if not spinnable or already fully revealed.
 */
export async function recordSpinLogic(filePath?: string): Promise<DistributionState> {
    const state = await readState(filePath)
    if (state.status !== 'draft' && state.status !== 'in_progress') {
        throw new Error('Cannot spin in current state')
    }
    if (state.revealedCount >= state.allocation.length) {
        throw new Error('All assets already revealed')
    }

    const newRevealedCount = state.revealedCount + 1
    const wasDraft = state.status === 'draft'
    const allRevealed = newRevealedCount === state.allocation.length

    const newState: DistributionState = {
        ...state,
        revealedCount: newRevealedCount,
        status: allRevealed ? 'committed' : wasDraft ? 'in_progress' : state.status,
        committedAt: allRevealed ? new Date().toISOString() : null,
    }
    await writeState(newState, filePath)
    return newState
}

/**
 * Archive a committed run and start a fresh draft with a newly computed
 * allocation. Only valid from `committed`; throws otherwise.
 */
export async function rerunDistributionLogic(config: SeedConfig, filePath?: string): Promise<DistributionState> {
    const state = await readState(filePath)
    if (state.status !== 'committed') {
        throw new Error('Can only rerun a committed distribution')
    }

    const now = new Date().toISOString()
    const updatedArchive = [
        ...state.archive,
        { archivedAt: now, allocation: state.allocation, revealedCount: state.revealedCount },
    ]

    const newAllocation = computeAllocation(config.members, config.assets)
    const newState: DistributionState = {
        status: 'draft',
        allocation: newAllocation,
        revealedCount: 0,
        startedAt: now,
        committedAt: null,
        archive: updatedArchive,
    }
    await writeState(newState, filePath)
    return newState
}
