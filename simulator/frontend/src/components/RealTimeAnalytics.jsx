/**
 * RealTimeAnalytics - Live 2x2 Grid Chart Panel
 * 
 * Displays real-time network metrics:
 * - Load/Throughput over time
 * - Shannon Entropy with threshold indicators
 * - Packet Loss rate
 * - Attack source activity
 */

import { useState, useEffect, useRef } from 'react'

// Internal threat sources for private SD-WAN
const THREAT_SOURCES = [
    { id: 'Public-Wifi', ip: '10.0.3.50', type: 'Guest AP', level: 'HIGH' },
    { id: 'Lab', ip: '10.0.2.20', type: 'Compromised IoT', level: 'MEDIUM' },
    { id: 'Wards', ip: '10.0.3.20', type: 'Bedside Terminal', level: 'MEDIUM' },
    { id: 'OT-1', ip: '10.0.1.30', type: 'Surgical Device', level: 'LOW' }
]

const RealTimeAnalytics = ({ throughput, entropy, links, trafficMode }) => {
    const [loadHistory, setLoadHistory] = useState(Array(60).fill(0))
    const [entropyHistory, setEntropyHistory] = useState(Array(60).fill(1))
    const [lossHistory, setLossHistory] = useState(Array(60).fill(0))
    const maxLoad = useRef(1000)

    useEffect(() => {
        setLoadHistory(prev => {
            const newHistory = [...prev.slice(1), throughput]
            maxLoad.current = Math.max(1000, ...newHistory) * 1.1
            return newHistory
        })
        setEntropyHistory(prev => [...prev.slice(1), entropy])

        // Calculate max packet loss across links
        const maxLoss = links?.length > 0
            ? Math.max(...links.map(l => l.packet_loss || 0)) / 100
            : 0
        setLossHistory(prev => [...prev.slice(1), maxLoss])
    }, [throughput, entropy, links])

    const width = 320
    const height = 90
    const padding = { top: 15, right: 10, bottom: 20, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const createPath = (data, maxValue = 1) => {
        return data.map((val, i) => {
            const x = padding.left + (i / (data.length - 1)) * chartWidth
            const y = padding.top + chartHeight - (Math.min(val, maxValue) / maxValue) * chartHeight
            return `${x},${y}`
        }).join(' ')
    }

    const getModeColor = () => {
        if (trafficMode === 'DDOS') return '#ef4444'
        if (trafficMode === 'CONGESTED') return '#f59e0b'
        return '#22c55e'
    }

    const getThreatColor = (level) => {
        if (level === 'HIGH') return '#ef4444'
        if (level === 'MEDIUM') return '#f59e0b'
        return '#22c55e'
    }

    const renderMiniChart = (title, data, color, maxValue, currentValue, unit, showThreshold = false) => (
        <div className="mini-chart">
            <div className="chart-header">
                <span className="chart-title">{title}</span>
                <span className="chart-value" style={{ color }}>{currentValue}{unit}</span>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                {/* Background */}
                <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="rgba(15,23,42,0.5)" rx={4} />

                {/* Threshold line for entropy */}
                {showThreshold && (
                    <>
                        <line
                            x1={padding.left}
                            y1={padding.top + chartHeight * 0.5}
                            x2={padding.left + chartWidth}
                            y2={padding.top + chartHeight * 0.5}
                            stroke="#ef4444"
                            strokeDasharray="4,4"
                            opacity={0.6}
                        />
                        <text x={padding.left + 5} y={padding.top + chartHeight * 0.5 - 3} fill="#ef4444" fontSize="7">Anomaly</text>
                    </>
                )}

                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((ratio, i) => (
                    <line key={i}
                        x1={padding.left} y1={padding.top + chartHeight * ratio}
                        x2={padding.left + chartWidth} y2={padding.top + chartHeight * ratio}
                        stroke="#334155" strokeWidth="0.5"
                    />
                ))}

                {/* Area fill */}
                <polygon
                    points={`${padding.left},${padding.top + chartHeight} ${createPath(data, maxValue)} ${padding.left + chartWidth},${padding.top + chartHeight}`}
                    fill={color}
                    fillOpacity={0.2}
                />

                {/* Line */}
                <polyline
                    points={createPath(data, maxValue)}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Current point */}
                <circle
                    cx={padding.left + chartWidth}
                    cy={padding.top + chartHeight - (Math.min(data[data.length - 1], maxValue) / maxValue) * chartHeight}
                    r="4"
                    fill={color}
                    filter="url(#glow)"
                />

                {/* Y-axis labels */}
                <text x={padding.left - 5} y={padding.top + 4} fill="#64748b" fontSize="7" textAnchor="end">
                    {typeof maxValue === 'number' ? Math.round(maxValue) : '1.0'}
                </text>
                <text x={padding.left - 5} y={padding.top + chartHeight} fill="#64748b" fontSize="7" textAnchor="end">0</text>

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
        </div>
    )

    return (
        <div className="realtime-analytics">
            <div className="analytics-header">
                <span className="analytics-title">📊 Real-Time Analysis</span>
                <span className="mode-indicator" style={{ backgroundColor: getModeColor() + '20', color: getModeColor(), border: `1px solid ${getModeColor()}` }}>
                    {trafficMode}
                </span>
            </div>

            <div className="charts-grid">
                {/* Load/Throughput */}
                {renderMiniChart(
                    'Network Load',
                    loadHistory,
                    '#3b82f6',
                    maxLoad.current,
                    Math.round(throughput),
                    ' Mbps'
                )}

                {/* Entropy */}
                {renderMiniChart(
                    'Shannon Entropy',
                    entropyHistory,
                    entropy < 0.5 ? '#ef4444' : entropy < 0.7 ? '#f59e0b' : '#a855f7',
                    1,
                    entropy.toFixed(2),
                    '',
                    true
                )}

                {/* Packet Loss */}
                {renderMiniChart(
                    'Packet Loss',
                    lossHistory,
                    '#ef4444',
                    1,
                    (lossHistory[lossHistory.length - 1] * 100).toFixed(1),
                    '%'
                )}

                {/* Internal Threat Sources */}
                <div className="mini-chart threat-panel">
                    <div className="chart-header">
                        <span className="chart-title">Internal Threat Sources</span>
                        <span className="chart-value" style={{ color: '#f59e0b' }}>{trafficMode === 'DDOS' ? 'ACTIVE' : 'MONITORING'}</span>
                    </div>
                    <div className="threat-list">
                        {THREAT_SOURCES.map(source => (
                            <div key={source.id} className="threat-item" style={{ opacity: trafficMode === 'DDOS' ? 1 : 0.5 }}>
                                <div className="threat-indicator" style={{ backgroundColor: getThreatColor(source.level) }} />
                                <div className="threat-info">
                                    <span className="threat-ip">{source.ip}</span>
                                    <span className="threat-type">{source.type}</span>
                                </div>
                                <span className="threat-level" style={{ color: getThreatColor(source.level) }}>{source.level}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .realtime-analytics {
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 12px;
                    margin-top: 12px;
                }
                .analytics-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .analytics-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #e2e8f0;
                }
                .mode-indicator {
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 20px;
                }
                .charts-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .mini-chart {
                    background: rgba(30, 41, 59, 0.5);
                    border-radius: 8px;
                    padding: 8px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .chart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .chart-title {
                    font-size: 0.6rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                }
                .chart-value {
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .threat-panel {
                    min-height: 120px;
                }
                .threat-list {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    margin-top: 8px;
                }
                .threat-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 6px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 4px;
                    transition: opacity 0.3s;
                }
                .threat-indicator {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                }
                .threat-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .threat-ip {
                    font-size: 0.65rem;
                    color: #e2e8f0;
                    font-family: monospace;
                }
                .threat-type {
                    font-size: 0.55rem;
                    color: #64748b;
                }
                .threat-level {
                    font-size: 0.55rem;
                    font-weight: 700;
                }
            `}</style>
        </div>
    )
}

export default RealTimeAnalytics
