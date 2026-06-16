import type { SeedConfig, ValidationResult } from './types'

const VALID_CLASSIFICATIONS = new Set(['top', 'middle', 'bottom'])

/**
 * Validate a seed config before it is used to compute an allocation.
 *
 * Checks (in order): non-empty members/assets, unique member & certificate
 * numbers, valid classifications, the divisibility rule (`top`/`middle` counts
 * must each divide evenly by member count; bottom may have leftovers), and the
 * top-only preassignment rules (valid member, top-only, within the member's
 * top quota). Returns all problems found rather than throwing, so the UI can
 * list them.
 */
export function validateConfig(config: SeedConfig): ValidationResult {
    const errors: ValidationResult['errors'] = []

    if (!config.members || config.members.length === 0) {
        errors.push({ field: 'members', message: 'At least one member is required' })
    }

    // Check duplicate member IDs
    const memberIds = config.members.map((m) => m.id)
    const dupMembers = memberIds.filter((id, i) => memberIds.indexOf(id) !== i)
    if (dupMembers.length > 0) {
        errors.push({ field: 'members', message: `Duplicate member IDs: ${dupMembers.join(', ')}` })
    }

    if (!config.assets || config.assets.length === 0) {
        errors.push({ field: 'assets', message: 'At least one asset is required' })
    }

    // Check duplicate certificate numbers (the asset primary key)
    const certNumbers = config.assets.map((a) => a.certificateNumber)
    const dupAssets = certNumbers.filter((c, i) => certNumbers.indexOf(c) !== i)
    if (dupAssets.length > 0) {
        errors.push({
            field: 'assets',
            message: `Duplicate certificate numbers: ${dupAssets.join(', ')}`,
        })
    }

    // Check valid classifications
    const invalidClass = config.assets.filter((a) => !VALID_CLASSIFICATIONS.has(a.classification))
    if (invalidClass.length > 0) {
        errors.push({
            field: 'assets',
            message: `Invalid classification on assets: ${invalidClass.map((a) => a.certificateNumber).join(', ')}`,
        })
    }

    if (errors.length > 0 || config.members.length === 0) {
        return { valid: false, errors }
    }

    const memberCount = config.members.length
    const topCount = config.assets.filter((a) => a.classification === 'top').length
    const middleCount = config.assets.filter((a) => a.classification === 'middle').length

    if (topCount % memberCount !== 0) {
        errors.push({
            field: 'assets',
            message: `Top assets (${topCount}) must be evenly divisible by member count (${memberCount})`,
        })
    }

    if (middleCount % memberCount !== 0) {
        errors.push({
            field: 'assets',
            message: `Middle assets (${middleCount}) must be evenly divisible by member count (${memberCount})`,
        })
    }

    // --- Preassignment rules (top documents only) ---
    const memberIdSet = new Set(memberIds)
    const preassigned = config.assets.filter((a) => a.preassignedTo != null)

    const badClassPre = preassigned.filter((a) => a.classification !== 'top')
    if (badClassPre.length > 0) {
        errors.push({
            field: 'assets',
            message: `Preassignment is only allowed for top documents: ${badClassPre.map((a) => a.certificateNumber).join(', ')}`,
        })
    }

    const unknownMemberPre = preassigned.filter((a) => !memberIdSet.has(a.preassignedTo!))
    if (unknownMemberPre.length > 0) {
        errors.push({
            field: 'assets',
            message: `Preassigned to unknown member: ${unknownMemberPre.map((a) => `${a.certificateNumber}→${a.preassignedTo}`).join(', ')}`,
        })
    }

    // A member cannot be preassigned more top documents than their fair share.
    if (topCount % memberCount === 0) {
        const perMemberTop = topCount / memberCount
        const preCounts: Record<string, number> = {}
        for (const a of preassigned) {
            if (a.classification === 'top' && memberIdSet.has(a.preassignedTo!)) {
                preCounts[a.preassignedTo!] = (preCounts[a.preassignedTo!] ?? 0) + 1
            }
        }
        const over = Object.entries(preCounts).filter(([, n]) => n > perMemberTop)
        if (over.length > 0) {
            errors.push({
                field: 'assets',
                message: `Too many preassigned top documents for: ${over.map(([id, n]) => `${id} (${n} > ${perMemberTop} allowed)`).join(', ')}`,
            })
        }
    }

    return { valid: errors.length === 0, errors }
}
