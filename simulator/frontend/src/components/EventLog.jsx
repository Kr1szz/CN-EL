
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

const EventLog = ({ alerts }) => {
    const getIcon = (level) => {
        switch (level) {
            case 'CRITICAL': return <AlertCircle size={14} />
            case 'WARNING': return <AlertTriangle size={14} />
            default: return <Info size={14} />
        }
    }

    return (
        <div className="event-log">
            <div className="log-header">
                <h3>LIVE ALERTS</h3>
                <div className="live-indicator">
                    <span className="live-dot"></span>
                    LIVE
                </div>
            </div>
            <div className="log-content">
                <AnimatePresence initial={false}>
                    {alerts.length === 0 ? (
                        <div className="no-alerts">No active alerts</div>
                    ) : (
                        [...alerts].reverse().map((alert, idx) => (
                            <motion.div
                                key={`${alert.time}-${idx}`}
                                className={`log-item ${alert.level.toLowerCase()}`}
                                initial={{ opacity: 0, x: -20, height: 0 }}
                                animate={{ opacity: 1, x: 0, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <span className="log-icon">{getIcon(alert.level)}</span>
                                <div className="log-details">
                                    <span className="log-time">{alert.time}</span>
                                    <span className="log-msg">{alert.msg}</span>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            <style>{`
        .event-log {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1rem;
          backdrop-filter: blur(12px);
          flex: 1;
          display: flex;
          flex-direction: column;
          max-height: 300px;
        }
        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .log-header h3 {
          font-size: 0.7rem;
          font-weight: 600;
          color: #64748b;
          letter-spacing: 0.15em;
        }
        .live-indicator {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.65rem;
          font-weight: 600;
          color: #22c55e;
        }
        .live-dot {
          width: 6px;
          height: 6px;
          background: #22c55e;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .log-content {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .no-alerts {
          color: #64748b;
          font-size: 0.8rem;
          text-align: center;
          padding: 2rem 0;
        }
        .log-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          font-size: 0.75rem;
        }
        .log-item.critical {
          background: rgba(239, 68, 68, 0.1);
          border-left: 2px solid #ef4444;
        }
        .log-item.critical .log-icon { color: #ef4444; }
        .log-item.warning {
          background: rgba(245, 158, 11, 0.1);
          border-left: 2px solid #f59e0b;
        }
        .log-item.warning .log-icon { color: #f59e0b; }
        .log-details {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .log-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          color: #64748b;
        }
        .log-msg {
          color: #cbd5e1;
          line-height: 1.4;
        }
      `}</style>
        </div>
    )
}

export default EventLog
