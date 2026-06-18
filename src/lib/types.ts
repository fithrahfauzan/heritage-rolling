export type Classification = 'top' | 'middle' | 'bottom'

/**
 * How documents are allocated across members:
 *
 * - `strict`   — the original rule. `top` and `middle` counts **must** divide
 *   evenly by the member count (else the run is blocked); `bottom` allows
 *   leftovers to distinct members.
 * - `compensation` — no divisibility requirement. Each class is distributed in
 *   even cycles; a member who falls short of the would-be even share in a class
 *   is compensated with `COMPENSATION_FACTOR` (default 3) documents of the next
 *   lower class, cascading top → middle → bottom. Because 1 top is worth 3
 *   middle is worth 9 bottom, every member ends with equal total value.
 */
export type AllocationMode = 'strict' | 'compensation'

export interface Member {
    id: string
    name: string
}

/**
 * A land document to be distributed. `certificateNumber` is the primary key
 * (unique identity); `name` is the owner of the land document.
 */
export interface Asset {
    certificateNumber: string // primary key — unique certificate / SHM number
    name: string // owner of the land document
    location: string
    area: number // m²
    classification: Classification
    /**
     * Optionally pin this document to a specific member (by member id).
     * Only allowed for `top` documents. The preassignment still counts toward
     * that member's top quota — they will not receive additional top documents
     * beyond their fair share.
     */
    preassignedTo?: string
}

/** A land document as authored in `config/assets/<classification>.json`
 * (classification is implied by the file it lives in). */
export type AssetInput = Omit<Asset, 'classification'>

export interface SeedConfig {
    members: Member[]
    assets: Asset[]
}

/** Customisable brand strings, loaded from `config/branding.json`. */
export interface Branding {
    /** Short logo text shown in the badge (e.g. "HL"). */
    logoText: string
    /** Brand name shown in the nav and login (e.g. "Heritage Land"). */
    brandName: string
    /** App title shown on the dashboard hero (e.g. "Land Distribution"). */
    title: string
    /** Subtitle shown on the login screen (e.g. "Distribution System"). */
    tagline: string
}

export interface ValidationError {
    field: string
    message: string
}

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
}

// --- Distribution state ---

export type DistributionStatus = 'empty' | 'draft' | 'in_progress' | 'committed'

export interface RevealItem {
    certificateNumber: string // references Asset.certificateNumber
    classification: Classification
    memberId: string
    /** True when this document was pinned to this member via `preassignedTo` in config. */
    preassigned?: boolean
}

export interface ArchivedRun {
    archivedAt: string
    allocation: RevealItem[]
    revealedCount: number
}

export interface DistributionState {
    status: DistributionStatus
    allocation: RevealItem[] // full predetermined sequence
    revealedCount: number // how many have been revealed so far
    startedAt: string | null
    committedAt: string | null
    archive: ArchivedRun[]
}
