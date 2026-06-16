import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Member, Asset, RevealItem, Classification, Branding } from './types'

const CLASS_ORDER: Classification[] = ['top', 'middle', 'bottom']

/** Look up assets by certificate number for quick joins. */
function assetIndex(assets: Asset[]): Map<string, Asset> {
    return new Map(assets.map((a) => [a.certificateNumber, a]))
}

/**
 * Build one PDF document for a single member listing the land documents they
 * received, grouped by classification, and trigger a download.
 *
 * `items` should already be limited to revealed/awarded entries for the member.
 * `branding` supplies the document heading (falls back to a default).
 */
export function exportMemberPdf(opts: {
    member: Member
    items: RevealItem[]
    assets: Asset[]
    committedAt?: string | null
    branding?: Pick<Branding, 'brandName' | 'title'>
}) {
    const { member, items, assets, committedAt, branding } = opts
    const heading = branding ? `${branding.brandName} — ${branding.title}` : 'Heritage Land Distribution'
    const idx = assetIndex(assets)
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text(heading, 14, 18)
    doc.setFontSize(11)
    doc.setTextColor(90)
    doc.text(`Recipient: ${member.name}`, 14, 27)
    doc.text(
        `Generated: ${new Date().toLocaleString()}${committedAt ? ` · Committed: ${new Date(committedAt).toLocaleString()}` : ''}`,
        14,
        33,
    )
    doc.setTextColor(0)

    const memberItems = items.filter((i) => i.memberId === member.id)
    const rows = memberItems
        .slice()
        .sort((a, b) => CLASS_ORDER.indexOf(a.classification) - CLASS_ORDER.indexOf(b.classification))
        .map((it, n) => {
            const a = idx.get(it.certificateNumber)
            return [
                String(n + 1),
                it.certificateNumber,
                a?.name ?? '—',
                a?.location ?? '—',
                a ? `${a.area.toLocaleString()} m²` : '—',
                it.classification.charAt(0).toUpperCase() + it.classification.slice(1),
            ]
        })

    autoTable(doc, {
        startY: 40,
        head: [['#', 'Certificate', 'Owner', 'Location', 'Area', 'Class']],
        body: rows.length ? rows : [['—', '—', 'No assets awarded', '—', '—', '—']],
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [16, 185, 129] }, // emerald
        columnStyles: { 0: { cellWidth: 10 } },
    })

    const totalArea = memberItems.reduce((sum, it) => sum + (idx.get(it.certificateNumber)?.area ?? 0), 0)
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40
    doc.setFontSize(10)
    doc.text(`Total: ${memberItems.length} documents · ${totalArea.toLocaleString()} m²`, 14, finalY + 8)

    const safeName = member.name.replace(/[^\w-]+/g, '_')
    doc.save(`distribution-${safeName}.pdf`)
}
