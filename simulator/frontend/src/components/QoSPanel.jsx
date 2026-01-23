
import { useMemo } from 'react'

const QoSPanel = ({ links }) => {
    // Aggregate QoS stats across all links
    const stats = useMemo(() => {
        if (!links || links.length === 0) {
            return {
                goldDrops: 0, silverDrops: 0, bronzeDrops: 0,
                goldServed: 0, silverServed: 0, bronzeServed: 0,
                goldLossPct: 0, bronzeLossPct: 0,
                chokeActive: false, avgBufferOccupancy: 0
            }
        }

        let goldDrops = 0, silverDrops = 0, bronzeDrops = 0
        let goldServed = 0, silverServed = 0, bronzeServed = 0
        let bufferSum = 0, chokeCount = 0

        links.forEach(link => {
            if (link.qos) {
                goldDrops += link.qos.gold_drops
                silverDrops += link.qos.silver_drops
                bronzeDrops += link.qos.bronze_drops
                goldServed += link.qos.gold_served
                silverServed += link.qos.silver_served
                bronzeServed += link.qos.bronze_served
                bufferSum += link.qos.buffer_occupancy
                if (link.qos.choke_active) chokeCount++
            }
        })

        const goldTotal = goldServed + goldDrops
        const bronzeTotal = bronzeServed + bronzeDrops

        return {
            goldDrops, silverDrops, bronzeDrops,
            goldServed, silverServed, bronzeServed,
            goldLossPct: goldTotal > 0 ? ((goldDrops / goldTotal) * 100).toFixed(1) : 0,
            bronzeLossPct: bronzeTotal > 0 ? ((bronzeDrops / bronzeTotal) * 100).toFixed(1) : 0,
            chokeActive: chokeCount > 0,
            avgBufferOccupancy: (bufferSum / links.length).toFixed(1)
        }
    }, [links])

    return (
        <div className="qos-panel">
            <div className="qos-header">
                <span className="qos-title">QoS - Weighted Fair Queuing</span>
                {stats.chokeActive && <span className="choke-badge">CHOKE ACTIVE</span>}
            </div>

            <div className="qos-grid">
                {/* Gold Traffic */}
                <div className="qos-card gold">
                    <div className="qos-icon">🥇</div>
                    <div className="qos-info">
                        <span className="qos-label">GOLD (Critical)</span>
                        <span className="qos-value">{stats.goldServed} served</span>
                        <span className={`qos-loss ${stats.goldLossPct > 0 ? 'bad' : 'good'}`}>
                            {stats.goldLossPct}% loss
                        </span>
                    </div>
                    <div className="qos-bar">
                        <div className="qos-bar-fill gold" style={{ width: `${100 - stats.goldLossPct}%` }}></div>
                    </div>
                </div>

                {/* Silver Traffic */}
                <div className="qos-card silver">
                    <div className="qos-icon">🥈</div>
                    <div className="qos-info">
                        <span className="qos-label">SILVER</span>
                        <span className="qos-value">{stats.silverServed} served</span>
                        <span className="qos-loss">{stats.silverDrops} dropped</span>
                    </div>
                </div>

                {/* Bronze Traffic */}
                <div className="qos-card bronze">
                    <div className="qos-icon">🥉</div>
                    <div className="qos-info">
                        <span className="qos-label">BRONZE (Best Effort)</span>
                        <span className="qos-value">{stats.bronzeServed} served</span>
                        <span className="qos-loss sacrifice">{stats.bronzeLossPct}% sacrificed</span>
                    </div>
                    <div className="qos-bar">
                        <div className="qos-bar-fill bronze" style={{ width: `${100 - stats.bronzeLossPct}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="buffer-meter">
                <span className="buffer-label">Buffer Occupancy</span>
                <div className="buffer-bar">
                    <div
                        className={`buffer-fill ${stats.avgBufferOccupancy > 40 ? 'choke' : ''}`}
                        style={{ width: `${stats.avgBufferOccupancy}%` }}
                    ></div>
                    <div className="buffer-threshold"></div>
                </div>
                <span className="buffer-value">{stats.avgBufferOccupancy}%</span>
            </div>

            <style>{`
        .qos-panel {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px;
        }
        .qos-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .qos-title {
          font-size: 0.65rem;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .choke-badge {
          font-size: 0.55rem;
          background: rgba(239,68,68,0.2);
          color: #ef4444;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          animation: pulse 1s infinite;
        }
        .qos-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .qos-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .qos-card.gold { border-left: 3px solid #fbbf24; }
        .qos-card.silver { border-left: 3px solid #94a3b8; }
        .qos-card.bronze { border-left: 3px solid #b45309; }
        .qos-icon { font-size: 1rem; }
        .qos-info { display: flex; flex-direction: column; flex: 1; }
        .qos-label { font-size: 0.6rem; color: #94a3b8; font-weight: 600; }
        .qos-value { font-size: 0.7rem; color: #e2e8f0; }
        .qos-loss { font-size: 0.55rem; }
        .qos-loss.good { color: #22c55e; }
        .qos-loss.bad { color: #ef4444; }
        .qos-loss.sacrifice { color: #f59e0b; }
        .qos-bar {
          width: 40px;
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .qos-bar-fill {
          height: 100%;
          transition: width 0.3s;
        }
        .qos-bar-fill.gold { background: linear-gradient(90deg, #fbbf24, #22c55e); }
        .qos-bar-fill.bronze { background: linear-gradient(90deg, #b45309, #78350f); }
        
        .buffer-meter {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .buffer-label { font-size: 0.55rem; color: #64748b; white-space: nowrap; }
        .buffer-bar {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }
        .buffer-fill {
          height: 100%;
          background: #22c55e;
          transition: width 0.3s, background 0.3s;
        }
        .buffer-fill.choke { background: #ef4444; }
        .buffer-threshold {
          position: absolute;
          left: 40%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #f59e0b;
        }
        .buffer-value { font-size: 0.6rem; color: #94a3b8; min-width: 35px; }
        
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>
        </div>
    )
}

export default QoSPanel
