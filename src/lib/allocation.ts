import type { Member, Asset, Classification, RevealItem, AllocationMode } from './types'

export type { RevealItem }

/**
 * Compensation exchange rate for `compensation` mode: a member who misses one
 * document of a class is compensated with this many documents of the next lower
 * class. 3 means 1 top = 3 middle = 9 bottom, which keeps total value equal.
 */
export const COMPENSATION_FACTOR = 3

const CLASS_ORDER: Classification[] = ['top', 'middle', 'bottom']

/** Number of assets of a given classification. */
function classCount(assets: Asset[], cls: Classification): number {
    return assets.filter((a) => a.classification === cls).length
}

/** The class processed immediately before `cls`, or null for `top`. */
function prevClassOf(cls: Classification): Classification | null {
    const i = CLASS_ORDER.indexOf(cls)
    return i <= 0 ? null : CLASS_ORDER[i - 1]!
}

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
 *
 * - `strict` mode (default): top = even split honoring `preassignedTo`, middle =
 *   even split (both require divisibility), bottom = floor + random leftovers.
 * - `compensation` mode: built incrementally via {@link assignNext} so the
 *   cascading compensation rule applies (see {@link AllocationMode}).
 *
 * Order is always all top items first, then middle, then bottom.
 */
export function computeAllocation(
    members: Member[],
    assets: Asset[],
    rng: () => number = Math.random,
    mode: AllocationMode = 'strict',
    factor: number = COMPENSATION_FACTOR,
): RevealItem[] {
    if (mode === 'compensation') {
        let allocation = preassignedItems(assets)
        for (;;) {
            const next = assignNext(members, assets, allocation, rng, mode, factor)
            if (!next) break
            allocation = [...allocation, next]
        }
        return allocation
    }

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

/**
 * The pinned (preassigned) top documents, placed at the start of a run so they
 * are awarded automatically without spinning.
 */
export function preassignedItems(assets: Asset[]): RevealItem[] {
    return assets
        .filter((a) => a.classification === 'top' && a.preassignedTo != null)
        .map((a) => item(a, a.preassignedTo!, true))
}

/**
 * Compensation documents owed to each member at the start of `targetClass`,
 * derived from how far each fell short of the would-be even share in the
 * **previous** class's *normal* distribution. `top` is the first class, so it
 * owes nothing. Cascades recursively (bottom ← middle ← top).
 */
function compensationOwed(
    targetClass: Classification,
    members: Member[],
    assets: Asset[],
    summary: Record<string, Record<Classification, number>>,
    factor: number,
): Record<string, number> {
    const owed: Record<string, number> = {}
    for (const m of members) owed[m.id] = 0

    const prev = prevClassOf(targetClass)
    if (!prev) return owed

    const memberCount = members.length
    const prevOwed = compensationOwed(prev, members, assets, summary, factor)
    const prevTotalComp = Object.values(prevOwed).reduce((a, b) => a + b, 0)
    const prevRemaining = Math.max(0, classCount(assets, prev) - prevTotalComp)
    // The share everyone would have received if the (post-compensation) pool
    // had divided evenly; members below this were short by the difference.
    const wouldBeShare = Math.ceil(prevRemaining / memberCount)

    for (const m of members) {
        const normalShare = (summary[m.id]?.[prev] ?? 0) - (prevOwed[m.id] ?? 0)
        if (normalShare < wouldBeShare) {
            owed[m.id] = factor * (wouldBeShare - normalShare)
        }
    }
    return owed
}

/**
 * Members still eligible to receive a document of `cls`, given current counts.
 *
 * - `strict`: top/middle require everyone reach the exact even share; bottom
 *   uses floor-then-distinct-leftovers.
 * - `compensation`: each member's guaranteed share is `compensation owed +
 *   floor(remaining / members)`; once everyone reaches it, the
 *   `remaining % members` leftovers go to distinct members.
 */
function eligibleMembers(
    cls: Classification,
    members: Member[],
    assets: Asset[],
    summary: Record<string, Record<Classification, number>>,
    mode: AllocationMode,
    factor: number,
): string[] {
    const memberCount = members.length
    const classTotal = classCount(assets, cls)
    const countOf = (id: string) => summary[id]?.[cls] ?? 0

    if (mode === 'compensation') {
        const owed = compensationOwed(cls, members, assets, summary, factor)
        const totalComp = Object.values(owed).reduce((a, b) => a + b, 0)
        const remaining = Math.max(0, classTotal - totalComp)
        const base = Math.floor(remaining / memberCount)
        const target = (id: string) => (owed[id] ?? 0) + base

        // Phase 0 (priority): members still owed compensation receive their
        // reserved documents first — so a member who missed a higher class is
        // drawn at the start of this class's spins.
        const owedFirst = members.filter((m) => countOf(m.id) < (owed[m.id] ?? 0)).map((m) => m.id)
        if (owedFirst.length > 0) return owedFirst

        const below = members.filter((m) => countOf(m.id) < target(m.id)).map((m) => m.id)
        if (below.length > 0) return below
        // Leftover phase: the remaining `remaining % memberCount` docs go to
        // distinct members currently sitting exactly at their target.
        return members.filter((m) => countOf(m.id) === target(m.id)).map((m) => m.id)
    }

    // --- strict mode (original behaviour) ---
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
 * randomly selects an eligible member (one who has not yet hit their fair share
 * for the active `mode`). Returns `null` when every document has been assigned.
 */
export function assignNext(
    members: Member[],
    assets: Asset[],
    allocation: RevealItem[],
    rng: () => number = Math.random,
    mode: AllocationMode = 'strict',
    factor: number = COMPENSATION_FACTOR,
): RevealItem | null {
    const assigned = new Set(allocation.map((i) => i.certificateNumber))
    const summary = summariseAllocation(members, allocation)

    for (const cls of CLASS_ORDER) {
        const classAssets = assets.filter((a) => a.classification === cls)
        const undistributed = classAssets.filter((a) => !assigned.has(a.certificateNumber))
        if (undistributed.length === 0) continue

        const eligible = eligibleMembers(cls, members, assets, summary, mode, factor)
        if (eligible.length === 0) continue

        const memberId = eligible[Math.floor(rng() * eligible.length)]!
        return item(undistributed[0]!, memberId)
    }
    return null
}
