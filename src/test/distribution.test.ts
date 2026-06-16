import { describe, it, expect } from 'vitest'
import { startDistributionLogic, recordSpinLogic, rerunDistributionLogic } from '../server/stateMachine'
import { summariseAllocation } from '../lib/allocation'
import type { Member, Asset, SeedConfig } from '../lib/types'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'

const tmp = () => join(tmpdir(), `heritage-sm-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)

const members: Member[] = [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' },
]

function makeConfig(topCount = 2, midCount = 2, botCount = 2): SeedConfig {
    const assets: Asset[] = []
    for (let i = 0; i < topCount; i++)
        assets.push({ certificateNumber: `CT${i}`, name: `Top ${i}`, location: 'A', area: 100, classification: 'top' })
    for (let i = 0; i < midCount; i++)
        assets.push({
            certificateNumber: `CM${i}`,
            name: `Mid ${i}`,
            location: 'B',
            area: 200,
            classification: 'middle',
        })
    for (let i = 0; i < botCount; i++)
        assets.push({
            certificateNumber: `CB${i}`,
            name: `Bot ${i}`,
            location: 'C',
            area: 300,
            classification: 'bottom',
        })
    return { members, assets }
}

// Deterministic RNG for reproducible spins.
function seededRng() {
    let i = 0
    return () => (i++ % 7) / 7
}

/** Spin until the run is committed; returns the final state. */
async function runAll(config: SeedConfig, f: string) {
    const total = config.assets.length
    let state = await startDistributionLogic(config, f)
    const rng = seededRng()
    const spins = total - state.allocation.length // preassigned already placed
    for (let i = 0; i < spins; i++) state = await recordSpinLogic(config, f, rng)
    return state
}

describe('startDistributionLogic', () => {
    it('creates a draft; allocation holds only preassigned (none here)', async () => {
        const f = tmp()
        const state = await startDistributionLogic(makeConfig(2, 2, 2), f)
        expect(state.status).toBe('draft')
        expect(state.allocation).toHaveLength(0)
        expect(state.revealedCount).toBe(0)
        await rm(f, { force: true })
    })

    it('places preassigned top documents immediately at start', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        config.assets.find((a) => a.certificateNumber === 'CT0')!.preassignedTo = 'm1'
        const state = await startDistributionLogic(config, f)
        expect(state.allocation).toHaveLength(1)
        expect(state.allocation[0]).toMatchObject({ certificateNumber: 'CT0', memberId: 'm1', preassigned: true })
        await rm(f, { force: true })
    })

    it('throws if already in_progress', async () => {
        const f = tmp()
        const config = makeConfig()
        await startDistributionLogic(config, f)
        await recordSpinLogic(config, f)
        await expect(startDistributionLogic(config, f)).rejects.toThrow('already in progress')
        await rm(f, { force: true })
    })

    it('throws if committed', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        await runAll(config, f)
        await expect(startDistributionLogic(config, f)).rejects.toThrow('Use rerun')
        await rm(f, { force: true })
    })

    it('throws for invalid config (non-divisible top)', async () => {
        const f = tmp()
        await expect(startDistributionLogic(makeConfig(3, 2, 2), f)).rejects.toThrow()
        await rm(f, { force: true })
    })
})

describe('recordSpinLogic', () => {
    it('assigns one document per spin and transitions draft → in_progress', async () => {
        const f = tmp()
        const config = makeConfig()
        await startDistributionLogic(config, f)
        const state = await recordSpinLogic(config, f, seededRng())
        expect(state.status).toBe('in_progress')
        expect(state.allocation).toHaveLength(1)
        expect(state.revealedCount).toBe(1)
        await rm(f, { force: true })
    })

    it('transitions to committed once every document is assigned', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        const state = await runAll(config, f)
        expect(state.status).toBe('committed')
        expect(state.committedAt).not.toBeNull()
        expect(state.allocation).toHaveLength(6)
        await rm(f, { force: true })
    })

    it('throws when called on committed state', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        await runAll(config, f)
        await expect(recordSpinLogic(config, f)).rejects.toThrow('Cannot spin')
        await rm(f, { force: true })
    })

    it('assigns documents in top → middle → bottom order', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        const state = await runAll(config, f)
        const order = state.allocation.map((i) => i.classification)
        expect(order.lastIndexOf('top')).toBeLessThan(order.indexOf('middle'))
        expect(order.lastIndexOf('middle')).toBeLessThan(order.indexOf('bottom'))
        await rm(f, { force: true })
    })

    it('produces a fair even split across members', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2) // 1 of each class per member
        const state = await runAll(config, f)
        const summary = summariseAllocation(members, state.allocation)
        for (const m of members) {
            expect(summary[m.id]).toEqual({ top: 1, middle: 1, bottom: 1 })
        }
        await rm(f, { force: true })
    })

    it('honors preassignment: pinned member gets no extra top', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        config.assets.find((a) => a.certificateNumber === 'CT0')!.preassignedTo = 'm1'
        const state = await runAll(config, f)
        const summary = summariseAllocation(members, state.allocation)
        expect(summary['m1']!.top).toBe(1)
        expect(summary['m2']!.top).toBe(1)
        const m1Top = state.allocation.find((i) => i.memberId === 'm1' && i.classification === 'top')!
        expect(m1Top.certificateNumber).toBe('CT0')
        expect(m1Top.preassigned).toBe(true)
        await rm(f, { force: true })
    })
})

describe('rerunDistributionLogic', () => {
    it('throws if not committed', async () => {
        const f = tmp()
        const config = makeConfig()
        await startDistributionLogic(config, f)
        await expect(rerunDistributionLogic(config, f)).rejects.toThrow('committed')
        await rm(f, { force: true })
    })

    it('archives prior run and creates a new draft', async () => {
        const f = tmp()
        const config = makeConfig(2, 2, 2)
        await runAll(config, f)
        const newState = await rerunDistributionLogic(config, f)
        expect(newState.status).toBe('draft')
        expect(newState.archive).toHaveLength(1)
        expect(newState.archive[0]!.revealedCount).toBe(6)
        await rm(f, { force: true })
    })
})
