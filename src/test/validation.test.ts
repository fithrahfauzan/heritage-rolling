import { describe, it, expect } from 'vitest'
import { validateConfig } from '../lib/validation'
import type { SeedConfig } from '../lib/types'

const members = [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' },
]

function makeAssets(topCount: number, midCount: number, botCount: number) {
    const assets: SeedConfig['assets'] = []
    for (let i = 0; i < topCount; i++)
        assets.push({
            certificateNumber: `C-T${i}`,
            name: `Top ${i}`,
            location: 'A',
            area: 100,
            classification: 'top',
        })
    for (let i = 0; i < midCount; i++)
        assets.push({
            certificateNumber: `C-M${i}`,
            name: `Mid ${i}`,
            location: 'B',
            area: 200,
            classification: 'middle',
        })
    for (let i = 0; i < botCount; i++)
        assets.push({
            certificateNumber: `C-B${i}`,
            name: `Bot ${i}`,
            location: 'C',
            area: 300,
            classification: 'bottom',
        })
    return assets
}

describe('validateConfig', () => {
    it('passes for evenly divisible top and middle', () => {
        const result = validateConfig({ members, assets: makeAssets(2, 4, 3) })
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it('blocks when top is not divisible by member count', () => {
        const result = validateConfig({ members, assets: makeAssets(3, 4, 3) })
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.message.includes('Top'))).toBe(true)
    })

    it('blocks when middle is not divisible by member count', () => {
        const result = validateConfig({ members, assets: makeAssets(2, 3, 3) })
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.message.includes('Middle'))).toBe(true)
    })

    it('allows bottom to not be divisible', () => {
        const result = validateConfig({ members, assets: makeAssets(2, 4, 3) })
        expect(result.valid).toBe(true)
    })

    it('blocks invalid classification', () => {
        const assets = makeAssets(2, 2, 2)
        // @ts-expect-error intentional bad classification
        assets[0]!.classification = 'premium'
        const result = validateConfig({ members, assets })
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.message.includes('Invalid classification'))).toBe(true)
    })

    it('blocks duplicate certificate numbers', () => {
        const assets = makeAssets(2, 2, 2)
        assets[1]!.certificateNumber = assets[0]!.certificateNumber
        const result = validateConfig({ members, assets })
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.message.includes('Duplicate certificate'))).toBe(true)
    })

    it('blocks duplicate member IDs', () => {
        const result = validateConfig({
            members: [
                { id: 'm1', name: 'Alice' },
                { id: 'm1', name: 'Bob' },
            ],
            assets: makeAssets(2, 2, 2),
        })
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.message.includes('Duplicate member'))).toBe(true)
    })

    it('blocks empty members', () => {
        const result = validateConfig({ members: [], assets: makeAssets(1, 1, 1) })
        expect(result.valid).toBe(false)
    })

    describe('preassignment', () => {
        it('allows a valid top preassignment within quota', () => {
            const assets = makeAssets(2, 4, 3) // 2 top / 2 members → 1 each
            assets.find((a) => a.certificateNumber === 'C-T0')!.preassignedTo = 'm1'
            const result = validateConfig({ members, assets })
            expect(result.valid).toBe(true)
        })

        it('blocks preassignment on non-top documents', () => {
            const assets = makeAssets(2, 4, 3)
            assets.find((a) => a.certificateNumber === 'C-M0')!.preassignedTo = 'm1'
            const result = validateConfig({ members, assets })
            expect(result.valid).toBe(false)
            expect(result.errors.some((e) => e.message.includes('only allowed for top'))).toBe(true)
        })

        it('blocks preassignment to an unknown member', () => {
            const assets = makeAssets(2, 4, 3)
            assets.find((a) => a.certificateNumber === 'C-T0')!.preassignedTo = 'ghost'
            const result = validateConfig({ members, assets })
            expect(result.valid).toBe(false)
            expect(result.errors.some((e) => e.message.includes('unknown member'))).toBe(true)
        })

        it('blocks preassigning more tops than a member’s quota', () => {
            const assets = makeAssets(2, 4, 3) // 1 top per member
            assets.find((a) => a.certificateNumber === 'C-T0')!.preassignedTo = 'm1'
            assets.find((a) => a.certificateNumber === 'C-T1')!.preassignedTo = 'm1'
            const result = validateConfig({ members, assets })
            expect(result.valid).toBe(false)
            expect(result.errors.some((e) => e.message.includes('Too many preassigned'))).toBe(true)
        })
    })
})
