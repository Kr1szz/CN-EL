
import { motion } from 'framer-motion'

const StatCard = ({ label, value, unit, subtext, icon, color = 'blue' }) => {
    const colorStyles = {
        blue: { accent: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' },
        red: { accent: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' },
        green: { accent: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)' },
        purple: { accent: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)' },
    }

    const style = colorStyles[color]

    return (
        <motion.div
            className="stat-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: style.bg,
                borderLeft: `3px solid ${style.accent}`,
            }}
        >
            <div className="stat-header">
                <span className="stat-label">{label}</span>
                <span className="stat-icon" style={{ color: style.accent }}>{icon}</span>
            </div>
            <div className="stat-value">
                {value}
                {unit && <span className="stat-unit">{unit}</span>}
            </div>
            {subtext && <div className="stat-subtext">{subtext}</div>}

            <style>{`
        .stat-card {
          padding: 1rem;
          border-radius: 10px;
          transition: all 0.2s ease;
        }
        .stat-card:hover {
          transform: translateX(4px);
        }
        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          color: #f8fafc;
        }
        .stat-unit {
          font-size: 0.875rem;
          font-weight: 400;
          color: #64748b;
          margin-left: 0.25rem;
        }
        .stat-subtext {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 0.25rem;
        }
      `}</style>
        </motion.div>
    )
}

export default StatCard
