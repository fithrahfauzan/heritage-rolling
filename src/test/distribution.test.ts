import { describe, it, expect, afterEach } from 'vitest'
import { startDistributionLogic, recordSpinLogic, rerunDistributionLogic } from '../server/stateMachine'
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
        assets.push({
            certificateNumber: `CT${i}`,
            name: `Top ${i}`,
            location: 'A',
            area: 100,
            classification: 'top',
        })
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

describe('startDistributionLogic', () => {
    it('creates draft state with allocation length = total assets', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        const state = await startDistributionLogic(makeConfig(2, 2, 2), f)
        expect(state.status).toBe('draft')
        expect(state.allocation).toHaveLength(6)
        expect(state.revealedCount).toBe(0)
    })

    it('throws if already in_progress', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await startDistributionLogic(makeConfig(), f)
        await recordSpinLogic(f) // move to in_progress
        await expect(startDistributionLogic(makeConfig(), f)).rejects.toThrow('already in progress')
    })

    it('throws if committed', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        const config = makeConfig(2, 2, 2)
        await startDistributionLogic(config, f)
        for (let i = 0; i < 6; i++) await recordSpinLogic(f)
        await expect(startDistributionLogic(config, f)).rejects.toThrow('Use rerun')
    })

    it('throws for invalid config (non-divisible top)', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await expect(startDistributionLogic(makeConfig(3, 2, 2), f)).rejects.toThrow()
    })
})

describe('recordSpinLogic', () => {
    it('transitions draft → in_progress on first spin', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await startDistributionLogic(makeConfig(), f)
        const state = await recordSpinLogic(f)
        expect(state.status).toBe('in_progress')
        expect(state.revealedCount).toBe(1)
    })

    it('increments revealedCount each call', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await startDistributionLogic(makeConfig(), f)
        await recordSpinLogic(f)
        const state = await recordSpinLogic(f)
        expect(state.revealedCount).toBe(2)
    })

    it('transitions to committed when all revealed', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await startDistributionLogic(makeConfig(2, 2, 2), f)
        let state = await recordSpinLogic(f)
        for (let i = 1; i < 6; i++) state = await recordSpinLogic(f)
        expect(state.status).toBe('committed')
        expect(state.committedAt).not.toBeNull()
    })

    it('throws when called on committed state', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await startDistributionLogic(makeConfig(2, 2, 2), f)
        for (let i = 0; i < 6; i++) await recordSpinLogic(f)
        await expect(recordSpinLogic(f)).rejects.toThrow('Cannot spin')
    })

    it('reveal order is top → middle → bottom', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        const state = await startDistributionLogic(makeConfig(2, 2, 2), f)
        const order = state.allocation.map((i) => i.classification)
        const topEnd = order.lastIndexOf('top')
        const midStart = order.indexOf('middle')
        const midEnd = order.lastIndexOf('middle')
        const botStart = order.indexOf('bottom')
        expect(topEnd).toBeLessThan(midStart)
        expect(midEnd).toBeLessThan(botStart)
    })
})

describe('rerunDistributionLogic', () => {
    it('throws if not committed', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        await startDistributionLogic(makeConfig(), f)
        await expect(rerunDistributionLogic(makeConfig(), f)).rejects.toThrow('committed')
    })

    it('archives prior run and creates new draft', async () => {
        const f = tmp()
        afterEach(() => rm(f, { force: true }))
        const config = makeConfig(2, 2, 2)
        await startDistributionLogic(config, f)
        for (let i = 0; i < 6; i++) await recordSpinLogic(f)
        const newState = await rerunDistributionLogic(config, f)
        expect(newState.status).toBe('draft')
        expect(newState.archive).toHaveLength(1)
        expect(newState.archive[0]!.revealedCount).toBe(6)
    })
})
