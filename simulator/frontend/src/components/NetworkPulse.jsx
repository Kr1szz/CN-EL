
import { useState, useEffect, useRef } from 'react'

const NetworkPulse = ({ throughput }) => {
    const [history, setHistory] = useState(Array(60).fill(0))
    const maxValue = useRef(100)

    useEffect(() => {
        setHistory(prev => {
            const newHistory = [...prev.slice(1), throughput]
            maxValue.current = Math.max(100, ...newHistory) * 1.2
            return newHistory
        })
    }, [throughput])

    const width = 280
    const height = 80
    const padding = { top: 10, right: 10, bottom: 20, left: 35 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const points = history.map((val, i) => {
        const x = padding.left + (i / (history.length - 1)) * chartWidth
        const y = padding.top + chartHeight - (val / maxValue.current) * chartHeight
        return `${x},${y}`
    }).join(' ')

    const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`

    return (
        <div className="pulse-container">
            <div className="pulse-header">
                <span className="pulse-title">Network Pulse</span>
                <span className="pulse-value">{Math.round(throughput)} Mbps</span>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={padding.top + chartHeight * ratio}
                            x2={padding.left + chartWidth}
                            y2={padding.top + chartHeight * ratio}
                            stroke="#1e293b"
                            strokeWidth="1"
                        />
                        <text
                            x={padding.left - 5}
                            y={padding.top + chartHeight * ratio + 3}
                            fill="#64748b"
                            fontSize="8"
                            textAnchor="end"
                        >
                            {Math.round(maxValue.current * (1 - ratio))}
                        </text>
                    </g>
                ))}

                {/* Area fill */}
                <polygon points={areaPoints} fill="url(#pulseGradient)" />

                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Current point glow */}
                <circle
                    cx={padding.left + chartWidth}
                    cy={padding.top + chartHeight - (throughput / maxValue.current) * chartHeight}
                    r="4"
                    fill="#3b82f6"
                    filter="url(#glow)"
                />
                <circle
                    cx={padding.left + chartWidth}
                    cy={padding.top + chartHeight - (throughput / maxValue.current) * chartHeight}
                    r="2"
                    fill="#60a5fa"
                />

                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            <style>{`
        .pulse-container {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 8px;
        }
        .pulse-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .pulse-title {
          font-size: 0.65rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pulse-value {
          font-size: 0.8rem;
          color: #3b82f6;
          font-weight: 700;
        }
      `}</style>
        </div>
    )
}

export default NetworkPulse
