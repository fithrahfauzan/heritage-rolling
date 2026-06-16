import { describe, it, expect } from 'vitest'
import { computeAllocation, summariseAllocation } from '../lib/allocation'
import type { Member, Asset } from '../lib/types'

const members: Member[] = [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' },
    { id: 'm3', name: 'Carol' },
]

function makeAssets(topCount: number, midCount: number, botCount: number): Asset[] {
    const assets: Asset[] = []
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

// Deterministic RNG seeded with a counter for reproducible tests
function seededRng() {
    let i = 0
    return () => (i++ % 997) / 997
}

describe('computeAllocation', () => {
    it('returns one item per asset', () => {
        const items = computeAllocation(members, makeAssets(3, 6, 9), seededRng())
        expect(items).toHaveLength(18)
    })

    it('ordering is strictly top → middle → bottom', () => {
        const items = computeAllocation(members, makeAssets(3, 6, 9), seededRng())
        const order = items.map((i) => i.classification)
        const topEnd = order.lastIndexOf('top')
        const midStart = order.indexOf('middle')
        const midEnd = order.lastIndexOf('middle')
        const botStart = order.indexOf('bottom')
        expect(topEnd).toBeLessThan(midStart)
        expect(midEnd).toBeLessThan(botStart)
    })

    it('each member gets exactly 1 top and 2 middle (even split)', () => {
        const items = computeAllocation(members, makeAssets(3, 6, 9), seededRng())
        const summary = summariseAllocation(members, items)
        for (const m of members) {
            expect(summary[m.id]!.top).toBe(1)
            expect(summary[m.id]!.middle).toBe(2)
        }
    })

    it('bottom base count is floor(count/members) per member', () => {
        // 9 bottom / 3 members = 3 each — no leftover
        const items = computeAllocation(members, makeAssets(3, 6, 9), seededRng())
        const summary = summariseAllocation(members, items)
        for (const m of members) {
            expect(summary[m.id]!.bottom).toBe(3)
        }
    })

    it('bottom leftovers go to distinct members (+1 each)', () => {
        // 10 bottom / 3 members = 3 base + 1 leftover → two members get 3, one gets 4
        const assets = makeAssets(3, 6, 10)
        const items = computeAllocation(members, assets, seededRng())
        const summary = summariseAllocation(members, items)
        const counts = members.map((m) => summary[m.id]!.bottom)
        counts.sort()
        expect(counts).toEqual([3, 3, 4])
    })

    it('covers all certificate numbers exactly once', () => {
        const assets = makeAssets(3, 6, 9)
        const items = computeAllocation(members, assets, seededRng())
        const seen = new Set(items.map((i) => i.certificateNumber))
        expect(seen.size).toBe(assets.length)
        for (const a of assets) {
            expect(seen.has(a.certificateNumber)).toBe(true)
        }
    })

    it('all memberIds in sequence are valid', () => {
        const items = computeAllocation(members, makeAssets(3, 6, 9), seededRng())
        const validIds = new Set(members.map((m) => m.id))
        for (const item of items) {
            expect(validIds.has(item.memberId)).toBe(true)
        }
    })
})

describe('computeAllocation — top preassignment', () => {
    it('awards a preassigned top to its member and counts it toward their quota', () => {
        // 3 top / 3 members → 1 top each. Preassign C-T0 to m1.
        const assets = makeAssets(3, 6, 9)
        assets.find((a) => a.certificateNumber === 'C-T0')!.preassignedTo = 'm1'

        const items = computeAllocation(members, assets, seededRng())
        const summary = summariseAllocation(members, items)

        // Every member still ends up with exactly one top.
        for (const m of members) expect(summary[m.id]!.top).toBe(1)

        // m1's single top is the preassigned certificate, and it is not given out twice.
        const m1Tops = items.filter((i) => i.memberId === 'm1' && i.classification === 'top')
        expect(m1Tops).toHaveLength(1)
        expect(m1Tops[0]!.certificateNumber).toBe('C-T0')

        // The preassigned cert is assigned to m1 only.
        const ct0 = items.filter((i) => i.certificateNumber === 'C-T0')
        expect(ct0).toHaveLength(1)
        expect(ct0[0]!.memberId).toBe('m1')
    })

    it('a member preassigned their full quota receives no additional tops', () => {
        // 6 top / 3 members → 2 tops each. Preassign 2 to m1.
        const assets = makeAssets(6, 6, 9)
        assets.find((a) => a.certificateNumber === 'C-T0')!.preassignedTo = 'm1'
        assets.find((a) => a.certificateNumber === 'C-T1')!.preassignedTo = 'm1'

        const items = computeAllocation(members, assets, seededRng())
        const summary = summariseAllocation(members, items)

        for (const m of members) expect(summary[m.id]!.top).toBe(2)
        const m1Certs = items
            .filter((i) => i.memberId === 'm1' && i.classification === 'top')
            .map((i) => i.certificateNumber)
            .sort()
        expect(m1Certs).toEqual(['C-T0', 'C-T1'])
    })
})
