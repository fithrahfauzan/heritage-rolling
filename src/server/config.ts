import { createServerFn } from '@tanstack/react-start'
import type { AssetInput, Asset, Branding, Classification, Member, SeedConfig, AllocationMode } from '../lib/types'
import { validateConfig } from '../lib/validation'

const CLASSIFICATIONS: Classification[] = ['top', 'middle', 'bottom']

const BRANDING_DEFAULTS: Branding = {
    logoText: 'HL',
    brandName: 'Heritage Land',
    title: 'Land Distribution',
    tagline: 'Distribution System',
}

/** Runtime-configurable app settings (read from `config/settings.json`). */
export interface AppSettings {
    /** Which allocation rule to apply. Defaults to `strict`. */
    allocationMode: AllocationMode
}

const SETTINGS_DEFAULTS: AppSettings = { allocationMode: 'strict' }

/** Coerce an arbitrary value into a valid {@link AllocationMode}, or null. */
function normalizeMode(value: unknown): AllocationMode | null {
    return value === 'strict' || value === 'compensation' ? value : null
}

/**
 * Resolve app settings. Precedence: `ALLOCATION_MODE` env var → `config/
 * settings.json` → built-in defaults. Read at runtime (no rebuild needed); a
 * missing/invalid file falls back to defaults so the app always runs.
 */
export async function readSettings(): Promise<AppSettings> {
    let fromFile: Partial<AppSettings> = {}
    try {
        const { readFile } = await import('node:fs/promises')
        const { resolve } = await import('node:path')
        const raw = await readFile(resolve(process.cwd(), 'config/settings.json'), 'utf-8')
        fromFile = JSON.parse(raw) as Partial<AppSettings>
    } catch {
        // ignore — fall back to env/defaults
    }
    const allocationMode =
        normalizeMode(process.env.ALLOCATION_MODE) ??
        normalizeMode(fromFile.allocationMode) ??
        SETTINGS_DEFAULTS.allocationMode
    return { allocationMode }
}

/** Server-function wrapper around {@link readSettings} for client callers. */
export const loadSettings = createServerFn({ method: 'GET' }).handler(() => readSettings())

/**
 * Assemble the full {@link SeedConfig} from the split config files:
 *   - `config/members.json`                     → members
 *   - `config/assets/{top,middle,bottom}.json`  → documents (classification is
 *     implied by the file, so it is injected here)
 *
 * Keeping the input split per classification makes the config easier to
 * maintain than a single large `seed.json`. Node-only modules are imported
 * dynamically so this file never leaks into the client bundle.
 */
async function assembleSeedConfig(): Promise<SeedConfig> {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    const configDir = resolve(process.cwd(), 'config')

    const readJson = async <T>(relativePath: string): Promise<T> => {
        const raw = await readFile(resolve(configDir, relativePath), 'utf-8')
        return JSON.parse(raw) as T
    }

    const members = await readJson<Member[]>('members.json')
    const assetGroups = await Promise.all(
        CLASSIFICATIONS.map((classification) =>
            readJson<AssetInput[]>(`assets/${classification}.json`).then((items) =>
                items.map((item): Asset => ({ ...item, classification })),
            ),
        ),
    )
    return { members, assets: assetGroups.flat() }
}

/**
 * Load and validate the seed config. Returns the parsed `config`, the active
 * `settings` (allocation mode), and the `validation` result (run against that
 * mode) so callers can surface blocking errors without re-reading.
 */
export const loadConfig = createServerFn({ method: 'GET' }).handler(async () => {
    const config = await assembleSeedConfig()
    const settings = await readSettings()
    const validation = validateConfig(config, settings.allocationMode)
    return { config, settings, validation }
})

/**
 * Load customisable brand strings from `config/branding.json`. Falls back to
 * sensible defaults if the file is missing or invalid, so the app always renders.
 */
export const loadBranding = createServerFn({ method: 'GET' }).handler(async (): Promise<Branding> => {
    try {
        const { readFile } = await import('node:fs/promises')
        const { resolve } = await import('node:path')
        const raw = await readFile(resolve(process.cwd(), 'config/branding.json'), 'utf-8')
        return { ...BRANDING_DEFAULTS, ...(JSON.parse(raw) as Partial<Branding>) }
    } catch {
        return BRANDING_DEFAULTS
    }
})
