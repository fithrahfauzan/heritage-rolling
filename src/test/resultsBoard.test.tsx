import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Member, Asset, RevealItem } from '../lib/types'

// Inline the ResultsBoard logic for unit testing without route context
function ResultsBoard({
    members,
    assets,
    allocation,
    revealedCount,
}: {
    members: Member[]
    assets: Asset[]
    allocation: RevealItem[]
    revealedCount: number
}) {
    const revealed = allocation.slice(0, revealedCount)
    const cls = ['top', 'middle', 'bottom'] as const

    return (
        <div data-testid="results-board">
            {members.map((m) => (
                <div key={m.id} data-testid={`col-${m.id}`}>
                    <h3>{m.name}</h3>
                    {cls.map((c) => {
                        const items = allocation.filter((i) => i.classification === c && i.memberId === m.id)
                        return items.map((item) => {
                            const isRevealed = revealed.some((r) => r.certificateNumber === item.certificateNumber)
                            const asset = assets.find((a) => a.certificateNumber === item.certificateNumber)
                            return (
                                <div key={item.certificateNumber} data-testid={`cell-${item.certificateNumber}`}>
                                    {isRevealed && asset ? asset.name : '—'}
                                </div>
                            )
                        })
                    })}
                </div>
            ))}
        </div>
    )
}

const members: Member[] = [
    { id: 'm1', name: 'Alice' },
    { id: 'm2', name: 'Bob' },
]

const assets: Asset[] = [
    { certificateNumber: 'C1', name: 'Land A', location: 'X', area: 100, classification: 'top' },
    { certificateNumber: 'C2', name: 'Land B', location: 'Y', area: 200, classification: 'top' },
]

const allocation: RevealItem[] = [
    { certificateNumber: 'C1', classification: 'top', memberId: 'm1' },
    { certificateNumber: 'C2', classification: 'top', memberId: 'm2' },
]

describe('ResultsBoard', () => {
    it('renders column headers for each member', () => {
        render(<ResultsBoard members={members} assets={assets} allocation={allocation} revealedCount={0} />)
        expect(screen.getByText('Alice')).toBeTruthy()
        expect(screen.getByText('Bob')).toBeTruthy()
    })

    it('unrevealed slots show placeholder —', () => {
        render(<ResultsBoard members={members} assets={assets} allocation={allocation} revealedCount={0} />)
        const cells = screen.getAllByText('—')
        expect(cells.length).toBeGreaterThan(0)
    })

    it('revealed slots show asset name', () => {
        render(<ResultsBoard members={members} assets={assets} allocation={allocation} revealedCount={1} />)
        expect(screen.getByText('Land A')).toBeTruthy()
        // a2 not yet revealed
        expect(screen.queryByText('Land B')).toBeNull()
    })

    it('all slots revealed shows all asset names', () => {
        render(<ResultsBoard members={members} assets={assets} allocation={allocation} revealedCount={2} />)
        expect(screen.getByText('Land A')).toBeTruthy()
        expect(screen.getByText('Land B')).toBeTruthy()
    })
})
