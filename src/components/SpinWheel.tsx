import { useRef, useEffect, useState } from 'react'
import type { Member } from '@/lib/types'

interface SpinWheelProps {
    members: Member[]
    targetMemberId: string
    spinning: boolean
    onLanded: (memberId: string) => void
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

/**
 * Animated SVG wheel of member segments. The result is predetermined: when
 * `spinning` flips true it rotates to land on `targetMemberId`, then calls
 * `onLanded`. The animation is presentation only — it does not pick the winner.
 */
export function SpinWheel({ members, targetMemberId, spinning, onLanded }: SpinWheelProps) {
    const size = 320
    const cx = size / 2
    const cy = size / 2
    const r = size / 2 - 10
    const segAngle = 360 / members.length
    const wheelRef = useRef<SVGGElement>(null)
    const accRotation = useRef(0)
    const [rotation, setRotation] = useState(0)
    const [isAnimating, setIsAnimating] = useState(false)
    const animStyleRef = useRef<string>('')

    useEffect(() => {
        if (!spinning || isAnimating) return
        const targetIndex = members.findIndex((m) => m.id === targetMemberId)
        if (targetIndex < 0) return

        // Land the pointer (top) on target segment center
        const targetAngle = targetIndex * segAngle + segAngle / 2
        const fullSpins = 5 * 360
        const finalAngle = accRotation.current + fullSpins + (360 - targetAngle)

        accRotation.current = (finalAngle % 360) + Math.floor(finalAngle / 360) * 360
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
              transition: 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
              transformOrigin: `${cx}px ${cy}px`,
          }
        : {
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
          }
    void animStyleRef.current // suppress unused warning

    return (
        <div className="relative inline-block" data-testid="spin-wheel">
            {/* Pointer */}
            <div
                className="absolute left-1/2 -translate-x-1/2 top-0 z-10 w-0 h-0"
                style={{
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderTop: '24px solid #1f2937',
                }}
            />

            <svg width={size} height={size}>
                <g ref={wheelRef} style={animStyle} onTransitionEnd={handleAnimationEnd} data-testid="wheel-group">
                    {members.map((member, i) => {
                        const startAngle = i * segAngle
                        const endAngle = (i + 1) * segAngle
                        const mid = polarToXY(cx, cy, r * 0.65, startAngle + segAngle / 2)
                        const color = COLORS[i % COLORS.length]!
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
                                    fontSize={members.length > 4 ? 11 : 13}
                                    fontWeight="600"
                                    fill="white"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {member.name.split(' ')[0]}
                                </text>
                            </g>
                        )
                    })}
                    <circle cx={cx} cy={cy} r={18} fill="white" stroke="#e5e7eb" strokeWidth={2} />
                </g>
            </svg>
        </div>
    )
}
