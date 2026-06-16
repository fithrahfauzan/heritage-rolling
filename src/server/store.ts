/**
 * JSON-file persistence for the distribution state.
 *
 * State is stored at `data/distribution.json` (relative to the process cwd).
 * Every function accepts an optional `filePath` override so tests can point at
 * a temp file. A missing/corrupt file is treated as the empty state.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { DistributionState } from '../lib/types'

const DEFAULT_PATH = resolve(process.cwd(), 'data/distribution.json')

const EMPTY_STATE: DistributionState = {
    status: 'empty',
    allocation: [],
    revealedCount: 0,
    startedAt: null,
    committedAt: null,
    archive: [],
}

/** Resolve the state file path, honoring a test/runtime override. */
export function getStorePath(override?: string): string {
    return override ?? DEFAULT_PATH
}

/** Read persisted state; returns a fresh empty state if the file is absent or unreadable. */
export async function readState(filePath?: string): Promise<DistributionState> {
    const path = getStorePath(filePath)
    try {
        const raw = await readFile(path, 'utf-8')
        return JSON.parse(raw) as DistributionState
    } catch {
        return structuredClone(EMPTY_STATE)
    }
}

/** Persist state, creating the parent directory if needed. */
export async function writeState(state: DistributionState, filePath?: string): Promise<void> {
    const path = getStorePath(filePath)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(state, null, 2), 'utf-8')
}
