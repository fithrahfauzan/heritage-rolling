import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SpinWheel } from '../components/SpinWheel'
import type { Member } from '../lib/types'

const members: Member[] = [
    { id: 'm1', name: 'Alice Smith' },
    { id: 'm2', name: 'Bob Jones' },
    { id: 'm3', name: 'Carol Lee' },
]

describe('SpinWheel', () => {
    it('renders one segment per member', () => {
        render(<SpinWheel members={members} targetMemberId="m1" spinning={false} onLanded={vi.fn()} />)
        // each segment g has data-memberid
        expect(document.querySelectorAll('[data-memberid]')).toHaveLength(3)
    })

    it('shows member wheel labels on the wheel', () => {
        render(<SpinWheel members={members} targetMemberId="m1" spinning={false} onLanded={vi.fn()} />)
        expect(screen.getByText('Alice Sm..')).toBeTruthy()
        expect(screen.getByText('Bob Jo..')).toBeTruthy()
        expect(screen.getByText('Carol Le..')).toBeTruthy()
    })

    it('calls onLanded with targetMemberId after transitionend', () => {
        const onLanded = vi.fn()
        render(<SpinWheel members={members} targetMemberId="m2" spinning={true} onLanded={onLanded} />)
        const group = document.querySelector('[data-testid="wheel-group"]')!
        fireEvent.transitionEnd(group)
        expect(onLanded).toHaveBeenCalledWith('m2')
    })

    it('does not call onLanded before spinning starts', () => {
        const onLanded = vi.fn()
        render(<SpinWheel members={members} targetMemberId="m1" spinning={false} onLanded={onLanded} />)
        expect(onLanded).not.toHaveBeenCalled()
    })
})
