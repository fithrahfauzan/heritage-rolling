import { createServerFn } from '@tanstack/react-start'
import type { AssetInput, Asset, Branding, Classification, Member, SeedConfig } from '../lib/types'
import { validateConfig } from '../lib/validation'

const CLASSIFICATIONS: Classification[] = ['top', 'middle', 'bottom']

const BRANDING_DEFAULTS: Branding = {
    logoText: 'HL',
    brandName: 'Heritage Land',
    title: 'Land Distribution',
    tagline: 'Distribution System',
}

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
 * Load and validate the seed config. Returns both the parsed `config` and its
 * `validation` result so callers can surface blocking errors without re-reading.
 */
export const loadConfig = createServerFn({ method: 'GET' }).handler(async () => {
    const config = await assembleSeedConfig()
    const validation = validateConfig(config)
    return { config, validation }
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
