
import { useState, useCallback, useEffect, useMemo } from 'react'

const HospitalTopology = ({ nodes, links }) => {
    // Compact positions - fits in viewport
    const [positions, setPositions] = useState({
        "Admin": { x: 80, y: 60 },
        "Wards": { x: 200, y: 60 },
        "Public-Wifi": { x: 320, y: 60 },
        "Radiology": { x: 140, y: 150 },
        "Lab": { x: 260, y: 150 },
        "ICU-A": { x: 80, y: 240 },
        "OT-1": { x: 200, y: 240 },
        "ICU-B": { x: 320, y: 240 },
        "Server Room": { x: 200, y: 340 },
    })

    const [dragging, setDragging] = useState(null)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [tick, setTick] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setTick(t => (t + 1) % 60), 80)
        return () => clearInterval(id)
    }, [])

    // Create lookup map for links by source-target
    const linkMap = useMemo(() => {
        const map = {}
        links.forEach(link => {
            const key1 = `${link.source}|${link.target}`
            const key2 = `${link.target}|${link.source}`
            map[key1] = link
            map[key2] = link
        })
        return map
    }, [links])

    // Get link data
    const getLink = (src, tgt) => {
        return linkMap[`${src}|${tgt}`] || linkMap[`${tgt}|${src}`] || null
    }

    // Define visual connections (what we want to draw)
    const visualConnections = [
        ["Server Room", "ICU-A"],
        ["Server Room", "ICU-B"],
        ["Server Room", "Radiology"],
        ["Server Room", "Admin"],
        ["Server Room", "Lab"],      // Lab data backup connection
        ["ICU-A", "OT-1"],
        ["OT-1", "ICU-B"],
        ["Radiology", "Lab"],
        ["Radiology", "ICU-A"],
        ["Admin", "Wards"],
        ["Admin", "Public-Wifi"],
    ]

    const getColor = (util) => {
        if (util >= 80) return '#ef4444'
        if (util >= 50) return '#f59e0b'
        if (util >= 5) return '#22c55e'
        return '#60a5fa'
    }

    const icons = { server: '🖥️', critical: '🏥', high_bandwidth: '📡', guest: '📶', staff: '👤', general: '🛏️' }

    const startDrag = (e, id) => {
        const svg = e.currentTarget.closest('svg')
        const rect = svg.getBoundingClientRect()
        setDragging(id)
        setOffset({ x: e.clientX - rect.left - positions[id].x * (rect.width / 400), y: e.clientY - rect.top - positions[id].y * (rect.height / 400) })
    }

    const onTouchStart = (e, id) => {
        const touch = e.touches[0]
        const svg = e.currentTarget.closest('svg')
        const rect = svg.getBoundingClientRect()
        setDragging(id)
        setOffset({ x: touch.clientX - rect.left - positions[id].x * (rect.width / 400), y: touch.clientY - rect.top - positions[id].y * (rect.height / 400) })
    }

    const onDrag = useCallback((e) => {
        if (!dragging) return
        const svg = e.currentTarget
        const rect = svg.getBoundingClientRect()
        const scaleX = 400 / rect.width
        const scaleY = 400 / rect.height
        setPositions(prev => ({
            ...prev,
            [dragging]: {
                x: Math.max(40, Math.min(360, (e.clientX - rect.left) * scaleX)),
                y: Math.max(40, Math.min(360, (e.clientY - rect.top) * scaleY))
            }
        }))
    }, [dragging])

    const onTouchMove = useCallback((e) => {
        if (!dragging) return
        const touch = e.touches[0]
        const svg = e.currentTarget
        const rect = svg.getBoundingClientRect()
        const scaleX = 400 / rect.width
        const scaleY = 400 / rect.height
        setPositions(prev => ({
            ...prev,
            [dragging]: {
                x: Math.max(40, Math.min(360, (touch.clientX - rect.left) * scaleX)),
                y: Math.max(40, Math.min(360, (touch.clientY - rect.top) * scaleY))
            }
        }))
    }, [dragging])

    const endDrag = () => setDragging(null)

    return (
        <div style={{ width: '100%', height: '100%', background: '#0a0f1a', borderRadius: 8, overflow: 'hidden', touchAction: 'none' }}>
            <svg
                viewBox="0 0 400 400"
                style={{ width: '100%', height: '100%' }}
                onMouseMove={onDrag}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchMove={onTouchMove}
                onTouchEnd={endDrag}
            >
                <defs>
                    <filter id="glow"><feGaussianBlur stdDeviation="2" /></filter>
                </defs>
                <rect width="400" height="400" fill="#0a0f1a" />

                {/* LINKS */}
                {visualConnections.map(([src, tgt], idx) => {
                    const p1 = positions[src]
                    const p2 = positions[tgt]
                    if (!p1 || !p2) return null

                    const linkData = getLink(src, tgt)
                    const util = linkData?.utilization || 0
                    const load = linkData?.load || 0
                    const color = getColor(util)
                    const midX = (p1.x + p2.x) / 2
                    const midY = (p1.y + p2.y) / 2
                    const dx = p2.x - p1.x
                    const dy = p2.y - p1.y
                    const packetCount = load > 5 ? Math.min(3, Math.ceil(util / 30)) : 0

                    return (
                        <g key={idx}>
                            {/* Glow for high congestion */}
                            {util > 50 && (
                                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                    stroke={color} strokeWidth={8} strokeOpacity={0.3} filter="url(#glow)" />
                            )}

                            {/* Main line */}
                            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                stroke={color} strokeWidth={util > 60 ? 4 : 2} strokeLinecap="round" />

                            {/* Packets */}
                            {[...Array(packetCount)].map((_, i) => {
                                const prog = ((tick * 2 + i * 20) % 60) / 60
                                return (
                                    <circle key={i} cx={p1.x + dx * prog} cy={p1.y + dy * prog}
                                        r={util > 70 ? 5 : 3} fill={color} opacity={0.9} />
                                )
                            })}

                            {/* Percentage */}
                            <rect x={midX - 18} y={midY - 10} width={36} height={20} rx={4}
                                fill="#1e293b" stroke={color} strokeWidth={1.5} />
                            <text x={midX} y={midY + 4} textAnchor="middle" fill={color}
                                fontSize={11} fontWeight="bold" fontFamily="monospace">
                                {util.toFixed(0)}%
                            </text>
                        </g>
                    )
                })}

                {/* NODES */}
                {nodes.map(node => {
                    const pos = positions[node.id]
                    if (!pos) return null
                    const nodeLinks = links.filter(l => l.source === node.id || l.target === node.id)
                    const maxUtil = nodeLinks.length ? Math.max(...nodeLinks.map(l => l.utilization || 0)) : 0
                    const color = getColor(maxUtil)

                    return (
                        <g key={node.id} onMouseDown={e => startDrag(e, node.id)}
                            style={{ cursor: dragging === node.id ? 'grabbing' : 'grab' }}>
                            <circle cx={pos.x} cy={pos.y} r={28} fill="#1e293b" stroke={color} strokeWidth={2} />
                            <text x={pos.x} y={pos.y + 6} textAnchor="middle" fontSize={18}>
                                {icons[node.type] || '📍'}
                            </text>
                            <text x={pos.x} y={pos.y + 42} textAnchor="middle" fill="#e2e8f0" fontSize={9} fontWeight="500">
                                {node.label}
                            </text>
                        </g>
                    )
                })}

                {/* Legend */}
                <g transform="translate(10, 375)">
                    <rect width="150" height="20" rx={4} fill="rgba(0,0,0,0.5)" />
                    <circle cx={15} cy={10} r={4} fill="#60a5fa" /><text x={25} y={14} fill="#94a3b8" fontSize={8}>Low</text>
                    <circle cx={55} cy={10} r={4} fill="#22c55e" /><text x={65} y={14} fill="#94a3b8" fontSize={8}>Normal</text>
                    <circle cx={105} cy={10} r={4} fill="#f59e0b" /><text x={115} y={14} fill="#94a3b8" fontSize={8}>High</text>
                    <circle cx={140} cy={10} r={4} fill="#ef4444" />
                </g>
            </svg>
        </div>
    )
}

export default HospitalTopology
