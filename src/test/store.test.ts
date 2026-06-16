import { describe, it, expect, afterEach } from 'vitest'
import { readState, writeState } from '../server/store'
import type { DistributionState } from '../lib/types'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'

const tmpFile = join(tmpdir(), `heritage-test-${Date.now()}.json`)

afterEach(async () => {
    await rm(tmpFile, { force: true })
})

describe('persistence store', () => {
    it('returns empty state when file does not exist', async () => {
        const state = await readState('/nonexistent/path/file.json')
        expect(state.status).toBe('empty')
        expect(state.allocation).toEqual([])
        expect(state.revealedCount).toBe(0)
        expect(state.archive).toEqual([])
    })

    it('round-trips a state to disk', async () => {
        const state: DistributionState = {
            status: 'draft',
            allocation: [{ certificateNumber: 'a1', classification: 'top', memberId: 'm1' }],
            revealedCount: 0,
            startedAt: '2026-01-01T00:00:00.000Z',
            committedAt: null,
            archive: [],
        }
        await writeState(state, tmpFile)
        const loaded = await readState(tmpFile)
        expect(loaded).toEqual(state)
    })

    it('overwrites existing file on write', async () => {
        const s1: DistributionState = {
            status: 'draft',
            allocation: [],
            revealedCount: 0,
            startedAt: null,
            committedAt: null,
            archive: [],
        }
        await writeState(s1, tmpFile)
        const s2: DistributionState = { ...s1, status: 'committed', revealedCount: 5 }
        await writeState(s2, tmpFile)
        const loaded = await readState(tmpFile)
        expect(loaded.status).toBe('committed')
        expect(loaded.revealedCount).toBe(5)
    })
})
