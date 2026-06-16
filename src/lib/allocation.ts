import type { Member, Asset, Classification, RevealItem } from './types'

export type { RevealItem }

/** Fisher-Yates shuffle (in-place). Accepts a seeded RNG for testability. */
function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    }
    return arr
}

function item(asset: Asset, memberId: string, preassigned = false): RevealItem {
    return {
        certificateNumber: asset.certificateNumber,
        classification: asset.classification,
        memberId,
        ...(preassigned ? { preassigned: true } : {}),
    }
}

/**
 * Distribute the `top` documents.
 *
 * Each member receives exactly `topCount / memberCount` documents. Any document
 * with `preassignedTo` is awarded to that member first and **counts toward their
 * quota**, so a member who is preassigned their full share receives no further
 * top documents. The remaining (non-preassigned) documents fill the leftover
 * slots across members at random.
 */
function allocateTop(members: Member[], topAssets: Asset[], rng: () => number): RevealItem[] {
    const perMember = topAssets.length / members.length
    const remaining = new Map(members.map((m) => [m.id, perMember]))
    const result: RevealItem[] = []

    // 1) Honor preassignments (top-only), decrementing each member's remaining quota.
    const preassigned = topAssets.filter((a) => a.preassignedTo != null)
    for (const asset of preassigned) {
        const memberId = asset.preassignedTo!
        result.push(item(asset, memberId, true))
        remaining.set(memberId, (remaining.get(memberId) ?? 0) - 1)
    }

    // 2) Build a pool of remaining slots and assign the free documents at random.
    const freeAssets = shuffle(
        topAssets.filter((a) => a.preassignedTo == null),
        rng,
    )
    const pool: string[] = []
    for (const [memberId, slots] of remaining) {
        for (let s = 0; s < Math.max(0, slots); s++) pool.push(memberId)
    }
    shuffle(pool, rng)

    freeAssets.forEach((asset, i) => result.push(item(asset, pool[i]!)))

    // Reveal preassigned and free documents in a shuffled order.
    return shuffle(result, rng)
}

/** Distribute documents that split evenly across members (no preassignment). */
function allocateEven(members: Member[], assets: Asset[], rng: () => number): RevealItem[] {
    const perMember = assets.length / members.length
    const pool: string[] = []
    for (let round = 0; round < perMember; round++) {
        pool.push(...shuffle([...members.map((m) => m.id)], rng))
    }
    return shuffle([...assets], rng).map((asset, i) => item(asset, pool[i]!))
}

/** Distribute documents as floor-per-member plus random leftovers to distinct members. */
function allocateWithLeftovers(members: Member[], assets: Asset[], rng: () => number): RevealItem[] {
    const base = Math.floor(assets.length / members.length)
    const leftoverCount = assets.length % members.length
    const leftoverRecipients = shuffle([...members.map((m) => m.id)], rng).slice(0, leftoverCount)

    const pool: string[] = []
    for (const memberId of shuffle([...members.map((m) => m.id)], rng)) {
        const slots = base + (leftoverRecipients.includes(memberId) ? 1 : 0)
        for (let s = 0; s < slots; s++) pool.push(memberId)
    }
    shuffle(pool, rng)

    return shuffle([...assets], rng).map((asset, i) => item(asset, pool[i]!))
}

/**
 * Compute the ordered reveal sequence.
 * - top: even split honoring `preassignedTo` (caller must ensure divisibility).
 * - middle: even split (caller must ensure divisibility).
 * - bottom: floor per member + random leftover to distinct members.
 * - Order: all top items first, then middle, then bottom.
 */
export function computeAllocation(members: Member[], assets: Asset[], rng: () => number = Math.random): RevealItem[] {
    const byClass = (cls: Classification) => assets.filter((a) => a.classification === cls)
    return [
        ...allocateTop(members, byClass('top'), rng),
        ...allocateEven(members, byClass('middle'), rng),
        ...allocateWithLeftovers(members, byClass('bottom'), rng),
    ]
}

/** Summarise per-member per-classification counts from a reveal sequence. */
export function summariseAllocation(
    members: Member[],
    items: RevealItem[],
): Record<string, Record<Classification, number>> {
    const summary: Record<string, Record<Classification, number>> = {}
    for (const m of members) {
        summary[m.id] = { top: 0, middle: 0, bottom: 0 }
    }
    for (const it of items) {
        summary[it.memberId]![it.classification]++
    }
    return summary
}

// ---------------------------------------------------------------------------
// Incremental allocation — used by the live distribution (decided per spin).
//
// Unlike `computeAllocation` (which builds the whole sequence up front, used
// only by the /debug preview), these helpers let the recipient of each document
// be chosen at spin time while still guaranteeing the same fairness invariants.
// ---------------------------------------------------------------------------

const CLASS_ORDER: Classification[] = ['top', 'middle', 'bottom']

/**
 * The pinned (preassigned) top documents, placed at the start of a run so they
 * are awarded automatically without spinning.
 */
export function preassignedItems(assets: Asset[]): RevealItem[] {
    return assets
        .filter((a) => a.classification === 'top' && a.preassignedTo != null)
        .map((a) => item(a, a.preassignedTo!, true))
}

/** Members still eligible to receive a document of the given class, given current counts. */
function eligibleMembers(
    cls: Classification,
    classTotal: number,
    members: Member[],
    summary: Record<string, Record<Classification, number>>,
): string[] {
    const memberCount = members.length
    const countOf = (id: string) => summary[id]?.[cls] ?? 0

    if (cls === 'top' || cls === 'middle') {
        const perMember = classTotal / memberCount
        return members.filter((m) => countOf(m.id) < perMember).map((m) => m.id)
    }

    // bottom: everyone reaches `base` first; the `classTotal % memberCount`
    // leftovers then go to distinct members (those still exactly at base).
    const base = Math.floor(classTotal / memberCount)
    const belowBase = members.filter((m) => countOf(m.id) < base).map((m) => m.id)
    if (belowBase.length > 0) return belowBase
    return members.filter((m) => countOf(m.id) === base).map((m) => m.id)
}

/**
 * Decide the next document and its recipient for a live spin.
 *
 * Picks the next undistributed document in `top → middle → bottom` order, then
 * randomly selects an eligible member (one who has not yet hit their fair
 * share). Returns `null` when every document has been assigned.
 */
export function assignNext(
    members: Member[],
    assets: Asset[],
    allocation: RevealItem[],
    rng: () => number = Math.random,
): RevealItem | null {
    const assigned = new Set(allocation.map((i) => i.certificateNumber))
    const summary = summariseAllocation(members, allocation)

    for (const cls of CLASS_ORDER) {
        const classAssets = assets.filter((a) => a.classification === cls)
        const undistributed = classAssets.filter((a) => !assigned.has(a.certificateNumber))
        if (undistributed.length === 0) continue

        const eligible = eligibleMembers(cls, classAssets.length, members, summary)
        if (eligible.length === 0) continue

        const memberId = eligible[Math.floor(rng() * eligible.length)]!
        return item(undistributed[0]!, memberId)
    }
    return null
}
