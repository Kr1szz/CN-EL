
import { useState, useEffect, useRef } from 'react'

const TerminalLog = ({ alerts }) => {
  const logRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [alerts, autoScroll])

  const formatLog = (alert) => {
    const levelColors = {
      CRITICAL: '#ef4444',
      WARNING: '#f59e0b',
      INFO: '#3b82f6'
    }
    return {
      color: levelColors[alert.level] || '#64748b',
      prefix: alert.level === 'CRITICAL' ? '[CRIT]' : alert.level === 'WARNING' ? '[WARN]' : '[INFO]'
    }
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-dot red"></span>
          <span className="terminal-dot yellow"></span>
          <span className="terminal-dot green"></span>
          <span>network-monitor.log</span>
        </div>
        <label className="auto-scroll">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          Auto-scroll
        </label>
      </div>
      <div className="terminal-body" ref={logRef}>
        <div className="log-line system">
          <span className="timestamp">[SYSTEM]</span>
          <span className="message">Private SD-WAN Congestion Detection System v2.0</span>
        </div>
        <div className="log-line system">
          <span className="timestamp">[SYSTEM]</span>
          <span className="message">Network: 10.0.0.0/8 (RFC1918) | VLANs: 100-199 | Mode: Internal Threat Monitoring</span>
        </div>
        <div className="log-line system">
          <span className="timestamp">[SYSTEM]</span>
          <span className="message">Algorithms: EWMA, Shannon Entropy, Z-Score, Token Bucket | MITRE ATT&CK: T1498, T1499</span>
        </div>
        <div className="log-line divider">{'─'.repeat(60)}</div>

        {alerts.map((alert, idx) => {
          const fmt = formatLog(alert)
          return (
            <div key={idx} className="log-line">
              <span className="timestamp">[{alert.time}]</span>
              <span className="level" style={{ color: fmt.color }}>{fmt.prefix}</span>
              <span className="message">{alert.msg}</span>
            </div>
          )
        })}

        <div className="cursor-line">
          <span className="cursor">▌</span>
        </div>
      </div>

      <style>{`
        .terminal-container {
          background: #0c0c0c;
          border-radius: 8px;
          overflow: hidden;
          font-family: 'JetBrains Mono', 'Consolas', monospace;
          font-size: 11px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .terminal-header {
          background: #1a1a1a;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #333;
        }
        .terminal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #888;
        }
        .terminal-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .terminal-dot.red { background: #ff5f56; }
        .terminal-dot.yellow { background: #ffbd2e; }
        .terminal-dot.green { background: #27ca3f; }
        .auto-scroll {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #666;
          font-size: 10px;
          cursor: pointer;
        }
        .auto-scroll input { cursor: pointer; }
        .terminal-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          color: #e0e0e0;
          line-height: 1.6;
        }
        .log-line {
          display: flex;
          gap: 8px;
          white-space: nowrap;
        }
        .log-line.system { color: #4ade80; }
        .log-line.divider { color: #333; }
        .timestamp { color: #666; }
        .level { font-weight: bold; }
        .message { color: #d1d5db; }
        .cursor-line { margin-top: 4px; }
        .cursor {
          color: #4ade80;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default TerminalLog
