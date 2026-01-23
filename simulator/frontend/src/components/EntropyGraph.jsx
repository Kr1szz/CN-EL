
import { useState, useEffect } from 'react'

const EntropyGraph = ({ entropy }) => {
    const [history, setHistory] = useState(Array(40).fill(1))

    useEffect(() => {
        setHistory(prev => [...prev.slice(1), entropy])
    }, [entropy])

    const width = 280
    const height = 100
    const padding = { top: 15, right: 10, bottom: 25, left: 35 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const getColor = (val) => {
        if (val >= 0.7) return '#22c55e'
        if (val >= 0.5) return '#f59e0b'
        return '#ef4444'
    }

    const points = history.map((val, i) => {
        const x = padding.left + (i / (history.length - 1)) * chartWidth
        const y = padding.top + chartHeight - (val * chartHeight)
        return `${x},${y}`
    }).join(' ')

    // Danger zone (entropy < 0.5)
    const dangerY = padding.top + chartHeight * 0.5

    return (
        <div className="entropy-container">
            <div className="entropy-header">
                <span className="entropy-title">Shannon Entropy</span>
                <span className="entropy-value" style={{ color: getColor(entropy) }}>
                    {entropy.toFixed(2)}
                </span>
            </div>

            <div className="entropy-status">
                {entropy < 0.6 ? (
                    <span className="status-alert">⚠ ANOMALY DETECTED - Possible DDoS</span>
                ) : entropy < 0.85 ? (
                    <span className="status-warning">Traffic diversity declining (Congestion)</span>
                ) : (
                    <span className="status-ok">Normal traffic distribution</span>
                )}
            </div>

            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="entropyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
                    </linearGradient>
                </defs>

                {/* Background zones */}
                <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight * 0.3} fill="rgba(34,197,94,0.1)" />
                <rect x={padding.left} y={padding.top + chartHeight * 0.3} width={chartWidth} height={chartHeight * 0.2} fill="rgba(245,158,11,0.1)" />
                <rect x={padding.left} y={dangerY} width={chartWidth} height={chartHeight * 0.5} fill="rgba(239,68,68,0.1)" />

                {/* Threshold lines */}
                <line x1={padding.left} y1={padding.top + chartHeight * 0.3} x2={padding.left + chartWidth} y2={padding.top + chartHeight * 0.3} stroke="#22c55e" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
                <line x1={padding.left} y1={dangerY} x2={padding.left + chartWidth} y2={dangerY} stroke="#ef4444" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />

                {/* Y-axis labels */}
                {[1, 0.7, 0.5, 0].map((val, i) => (
                    <text key={i} x={padding.left - 5} y={padding.top + chartHeight * (1 - val) + 3} fill="#64748b" fontSize="8" textAnchor="end">
                        {val.toFixed(1)}
                    </text>
                ))}

                {/* Zone labels */}
                <text x={padding.left + 5} y={padding.top + 12} fill="#22c55e" fontSize="7" opacity="0.7">HEALTHY</text>
                <text x={padding.left + 5} y={padding.top + chartHeight * 0.4 + 5} fill="#f59e0b" fontSize="7" opacity="0.7">WARNING</text>
                <text x={padding.left + 5} y={padding.top + chartHeight * 0.75} fill="#ef4444" fontSize="7" opacity="0.7">ATTACK</text>

                {/* Line with gradient based on value */}
                {history.map((val, i) => {
                    if (i === 0) return null
                    const x1 = padding.left + ((i - 1) / (history.length - 1)) * chartWidth
                    const y1 = padding.top + chartHeight - (history[i - 1] * chartHeight)
                    const x2 = padding.left + (i / (history.length - 1)) * chartWidth
                    const y2 = padding.top + chartHeight - (val * chartHeight)
                    return (
                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={getColor(val)} strokeWidth="2" strokeLinecap="round" />
                    )
                })}

                {/* Current point */}
                <circle
                    cx={padding.left + chartWidth}
                    cy={padding.top + chartHeight - (entropy * chartHeight)}
                    r="5"
                    fill={getColor(entropy)}
                    className="entropy-dot"
                />
            </svg>

            <style>{`
        .entropy-container {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 8px;
        }
        .entropy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .entropy-title {
          font-size: 0.65rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .entropy-value {
          font-size: 1rem;
          font-weight: 700;
        }
        .entropy-status {
          font-size: 0.6rem;
          margin: 4px 0;
        }
        .status-ok { color: #22c55e; }
        .status-warning { color: #f59e0b; }
        .status-alert { color: #ef4444; animation: blink 1s infinite; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .entropy-dot {
          filter: drop-shadow(0 0 4px currentColor);
        }
      `}</style>
        </div>
    )
}

export default EntropyGraph
