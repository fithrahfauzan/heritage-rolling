import { useRef, useEffect, useState } from 'react'
import type { Member } from '@/lib/types'

interface SpinWheelProps {
    members: Member[]
    targetMemberId: string
    spinning: boolean
    onLanded: (memberId: string) => void
    /** How long the spin lasts before landing, in milliseconds (default 4000). */
    durationMs?: number
    /** Number of full rotations performed before landing (default 5). */
    spins?: number
    /** Diameter of the wheel in pixels (default 320). */
    size?: number
}

// Distinct colors for segments
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function segmentPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToXY(cx, cy, r, startAngle)
    const end = polarToXY(cx, cy, r, endAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

// Honorific prefixes to skip when choosing a short display label for the wheel.
const HONORIFICS = new Set(['hj.', 'hj', 'h.', 'h', 'dr.', 'dr', 'ir.', 'ir', 'drs.', 'drs', 's.h', 's.h.'])

/**
 * Returns a short wheel label: full first meaningful word + first 2 chars of
 * the next word + "..". e.g.:
 *   "Hj. Nia Seniawati"          → "Nia Se.."
 *   "Arief Fitriansah Pratama"   → "Arief Fi.."
 *   "Muhammad Aryadillah"        → "Muhammad Ar.."
 *   "Panji Ramadhan"             → "Panji Ra.."
 *   single meaningful word       → that word as-is
 */
function wheelLabel(name: string): string {
    const words = name.split(/\s+/).map((w) => w.replace(/,+$/, ''))
    const meaningful = words.filter((w) => !HONORIFICS.has(w.toLowerCase()))
    if (meaningful.length === 0) return words[0]!
    if (meaningful.length === 1) return meaningful[0]!
    return `${meaningful[0]} ${meaningful[1]!.slice(0, 2)}..`
}

/**
 * Animated SVG wheel of member segments.
 *
 * The winner is chosen by the caller (in this app the server decides it per
 * spin) and passed in via `targetMemberId`. When `spinning` flips to `true`, the
 * wheel performs `spins` full rotations over `durationMs` and lands with that
 * member's segment under the top pointer, then calls `onLanded`. The animation
 * is presentation only — it never selects the winner itself.
 */
export function SpinWheel({
    members,
    targetMemberId,
    spinning,
    onLanded,
    durationMs = 4000,
    spins = 5,
    size = 320,
}: SpinWheelProps) {
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 10
    const segAngle = 360 / members.length
    const wheelRef = useRef<SVGGElement>(null)
    const accRotation = useRef(0)
    const [rotation, setRotation] = useState(0)
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (!spinning || isAnimating) return
        const targetIndex = members.findIndex((m) => m.id === targetMemberId)
        if (targetIndex < 0) return

        // Segment centers are measured clockwise from the top (pointer) position.
        const targetCenter = targetIndex * segAngle + segAngle / 2
        // Rotation (mod 360) needed so the target segment center sits under the pointer.
        const desiredMod = (360 - (targetCenter % 360)) % 360

        // Add the forward delta from the wheel's *current* resting angle, plus full spins.
        const current = accRotation.current
        const currentMod = ((current % 360) + 360) % 360
        const delta = (desiredMod - currentMod + 360) % 360
        const finalAngle = current + Math.max(0, spins) * 360 + delta

        accRotation.current = finalAngle
        setRotation(finalAngle)
        setIsAnimating(true)
    }, [spinning]) // eslint-disable-line react-hooks/exhaustive-deps

    function handleAnimationEnd() {
        setIsAnimating(false)
        onLanded(targetMemberId)
    }

    const animStyle: React.CSSProperties = isAnimating
        ? {
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${durationMs}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`,
              transformOrigin: `${cx}px ${cy}px`,
          }
        : {
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
          }

    return (
        <div className="relative inline-block" data-testid="spin-wheel">
            {/* Pointer */}
            <div
                className="absolute left-1/2 -translate-x-1/2 top-0 z-10 w-0 h-0"
                style={{
                    borderLeft: `${Math.round(size * 0.031)}px solid transparent`,
                    borderRight: `${Math.round(size * 0.031)}px solid transparent`,
                    borderTop: `${Math.round(size * 0.075)}px solid #1f2937`,
                }}
            />

            <svg width={size} height={size}>
                <g ref={wheelRef} style={animStyle} onTransitionEnd={handleAnimationEnd} data-testid="wheel-group">
                    {members.map((member, i) => {
                        const startAngle = i * segAngle
                        const endAngle = (i + 1) * segAngle
                        const midAngle = startAngle + segAngle / 2
                        const mid = polarToXY(cx, cy, r * 0.62, midAngle)
                        const color = COLORS[i % COLORS.length]!
                        // Rotate text radially. SVG rotate=0 points right; our angles are
                        // clockwise-from-top, so subtract 90. Flip bottom-half (>180°) so
                        // text is never upside down.
                        const svgAngle = midAngle - 90
                        const flip = midAngle > 180 && midAngle < 360
                        const textRotate = flip ? svgAngle + 180 : svgAngle
                        return (
                            <g key={member.id} data-memberid={member.id}>
                                <path
                                    d={segmentPath(cx, cy, r, startAngle, endAngle)}
                                    fill={color}
                                    stroke="white"
                                    strokeWidth={2}
                                />
                                <text
                                    x={mid.x}
                                    y={mid.y}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={(members.length > 4 ? 11 : 13) * (size / 320)}
                                    fontWeight="600"
                                    fill="white"
                                    transform={`rotate(${textRotate}, ${mid.x}, ${mid.y})`}
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {wheelLabel(member.name)}
                                </text>
                            </g>
                        )
                    })}
                    <circle cx={cx} cy={cy} r={size * 0.056} fill="white" stroke="#e5e7eb" strokeWidth={2} />
                </g>
            </svg>
        </div>
    )
}
