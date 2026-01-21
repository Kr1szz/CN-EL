
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const NetworkTopology = ({ nodes, links }) => {
    const containerRef = useRef(null)
    const [dimensions, setDimensions] = useState({ width: 900, height: 600 })

    // Fixed positions for nodes in a nice network layout
    const nodePositions = {
        "Server Room": { x: 450, y: 520 },
        "ICU-A": { x: 200, y: 300 },
        "ICU-B": { x: 350, y: 180 },
        "OT-1": { x: 280, y: 100 },
        "Radiology": { x: 550, y: 120 },
        "Lab": { x: 700, y: 200 },
        "Admin": { x: 150, y: 450 },
        "Wards": { x: 450, y: 380 },
        "Public-Wifi": { x: 750, y: 400 },
    }

    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
            })
        }
    }, [])

    const getStatusColor = (status, utilization) => {
        if (status === 'CRITICAL') return '#ef4444'
        if (status === 'WARNING' || utilization > 70) return '#f59e0b'
        return '#22c55e'
    }

    const getNodeColor = (type) => {
        switch (type) {
            case 'server': return { bg: '#7c3aed', border: '#a78bfa', glow: 'rgba(124, 58, 237, 0.5)' }
            case 'critical': return { bg: '#dc2626', border: '#f87171', glow: 'rgba(220, 38, 38, 0.5)' }
            case 'high_bandwidth': return { bg: '#0891b2', border: '#22d3ee', glow: 'rgba(8, 145, 178, 0.5)' }
            case 'guest': return { bg: '#16a34a', border: '#4ade80', glow: 'rgba(22, 163, 74, 0.5)' }
            default: return { bg: '#2563eb', border: '#60a5fa', glow: 'rgba(37, 99, 235, 0.5)' }
        }
    }

    // Get unique links (avoid duplicates like A->B and B->A)
    const uniqueLinks = []
    const seenPairs = new Set()
    links.forEach(link => {
        const pairKey = [link.source, link.target].sort().join('-')
        if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey)
            uniqueLinks.push(link)
        }
    })

    return (
        <div ref={containerRef} className="network-topology">
            <svg width="100%" height="100%" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid meet">
                <defs>
                    {/* Glow filter for nodes */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Gradient for links based on congestion */}
                    <linearGradient id="linkGradientNormal" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
                    </linearGradient>
                    <linearGradient id="linkGradientWarning" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.3" />
                    </linearGradient>
                    <linearGradient id="linkGradientCritical" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
                    </linearGradient>

                    {/* Packet symbol */}
                    <symbol id="packet" viewBox="0 0 10 10">
                        <rect x="1" y="1" width="8" height="8" rx="2" fill="currentColor" />
                    </symbol>
                </defs>

                {/* Background Grid */}
                <g className="grid" opacity="0.1">
                    {[...Array(10)].map((_, i) => (
                        <line key={`v${i}`} x1={i * 90} y1="0" x2={i * 90} y2="600" stroke="white" strokeWidth="0.5" />
                    ))}
                    {[...Array(7)].map((_, i) => (
                        <line key={`h${i}`} x1="0" y1={i * 100} x2="900" y2={i * 100} stroke="white" strokeWidth="0.5" />
                    ))}
                </g>

                {/* Links with animated packets */}
                {uniqueLinks.map((link, idx) => {
                    const sourcePos = nodePositions[link.source]
                    const targetPos = nodePositions[link.target]
                    if (!sourcePos || !targetPos) return null

                    const statusColor = getStatusColor(link.status, link.utilization)
                    const midX = (sourcePos.x + targetPos.x) / 2
                    const midY = (sourcePos.y + targetPos.y) / 2 - 15

                    // Calculate path length for animation duration
                    const dx = targetPos.x - sourcePos.x
                    const dy = targetPos.y - sourcePos.y
                    const length = Math.sqrt(dx * dx + dy * dy)
                    const animDuration = 2 + (length / 200) // Longer links = slower packets

                    return (
                        <g key={`link-${idx}`}>
                            {/* Link Line */}
                            <line
                                x1={sourcePos.x}
                                y1={sourcePos.y}
                                x2={targetPos.x}
                                y2={targetPos.y}
                                stroke={statusColor}
                                strokeWidth={link.status === 'CRITICAL' ? 4 : 2}
                                strokeOpacity={0.6}
                                strokeLinecap="round"
                            />

                            {/* Animated Packets */}
                            {link.load > 10 && [...Array(Math.min(5, Math.ceil(link.utilization / 20)))].map((_, pIdx) => (
                                <motion.circle
                                    key={`packet-${idx}-${pIdx}`}
                                    r={link.status === 'CRITICAL' ? 6 : 4}
                                    fill={statusColor}
                                    filter="url(#glow)"
                                    initial={{
                                        cx: sourcePos.x,
                                        cy: sourcePos.y,
                                        opacity: 0
                                    }}
                                    animate={{
                                        cx: [sourcePos.x, targetPos.x],
                                        cy: [sourcePos.y, targetPos.y],
                                        opacity: [0, 1, 1, 0]
                                    }}
                                    transition={{
                                        duration: animDuration,
                                        repeat: Infinity,
                                        delay: pIdx * (animDuration / 5),
                                        ease: "linear"
                                    }}
                                />
                            ))}

                            {/* Congestion Label */}
                            <g transform={`translate(${midX}, ${midY})`}>
                                <rect
                                    x="-28" y="-12"
                                    width="56" height="24"
                                    rx="6"
                                    fill="rgba(0,0,0,0.8)"
                                    stroke={statusColor}
                                    strokeWidth="1"
                                />
                                <text
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill={statusColor}
                                    fontSize="11"
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                >
                                    {link.utilization.toFixed(0)}%
                                </text>
                            </g>
                        </g>
                    )
                })}

                {/* Nodes */}
                {nodes.map((node, idx) => {
                    const pos = nodePositions[node.id]
                    if (!pos) return null
                    const colors = getNodeColor(node.type)

                    return (
                        <motion.g
                            key={node.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.1, type: "spring" }}
                        >
                            {/* Glow Effect */}
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r="35"
                                fill={colors.glow}
                                filter="url(#glow)"
                                className="animate-pulse-slow"
                            />

                            {/* Node Circle */}
                            <circle
                                cx={pos.x}
                                cy={pos.y}
                                r="28"
                                fill={colors.bg}
                                stroke={colors.border}
                                strokeWidth="3"
                            />

                            {/* Icon placeholder (first letter) */}
                            <text
                                x={pos.x}
                                y={pos.y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="white"
                                fontSize="16"
                                fontWeight="bold"
                            >
                                {node.id.charAt(0)}
                            </text>

                            {/* Node Label */}
                            <text
                                x={pos.x}
                                y={pos.y + 48}
                                textAnchor="middle"
                                fill="white"
                                fontSize="11"
                                fontWeight="500"
                                className="node-label"
                            >
                                {node.label}
                            </text>
                        </motion.g>
                    )
                })}
            </svg>

            <style>{`
        .network-topology {
          width: 100%;
          height: 100%;
          min-height: 550px;
          background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(3, 7, 18, 1) 100%);
          border-radius: 12px;
          overflow: hidden;
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform-origin: center; }
          50% { opacity: 0.6; }
        }
        .node-label {
          text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        }
      `}</style>
        </div>
    )
}

export default NetworkTopology
