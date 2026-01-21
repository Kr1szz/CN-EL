
import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { Activity, Shield, Zap, Play, Pause, RotateCcw, AlertTriangle, Network, Cpu, Terminal } from 'lucide-react'
import HospitalTopology from './components/HospitalTopology'
import StatCard from './components/StatCard'
import TerminalLog from './components/TerminalLog'

function App() {
  const [data, setData] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isDdosActive, setIsDdosActive] = useState(false)
  const [allAlerts, setAllAlerts] = useState([])

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/state')
      setData(res.data)
      if (res.data.alerts?.length > 0) {
        setAllAlerts(prev => {
          const newAlerts = res.data.alerts.filter(
            a => !prev.some(p => p.time === a.time && p.msg === a.msg)
          )
          return [...prev, ...newAlerts].slice(-100)
        })
      }
    } catch (err) {
      console.error("Connection Error", err)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 500)
    return () => clearInterval(interval)
  }, [])

  const handleControl = async (action) => {
    await axios.post('/api/control', { action })
    if (action === 'start') setIsRunning(true)
    if (action === 'stop') setIsRunning(false)
    if (action === 'reset') { setIsRunning(false); setIsDdosActive(false); setAllAlerts([]) }
    fetchData()
  }

  const handleTrigger = async (event) => {
    await axios.post('/api/trigger', { event })
    if (event === 'ddos') setIsDdosActive(!isDdosActive)
    fetchData()
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <Cpu size={48} className="loading-icon" />
          <h2>Initializing SD-WAN Sentinel</h2>
          <p>Connecting to network infrastructure...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="animated-bg">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
      </div>

      <div className="main-layout">
        <header className="app-header">
          <div className="header-left">
            <Network size={28} className="header-icon" />
            <div>
              <h1>SD-WAN <span>CONGESTION DETECTION</span></h1>
              <p>Hospital Network Monitoring</p>
            </div>
          </div>
          <div className="header-right">
            <div className={`status-badge ${isRunning ? 'active' : 'inactive'}`}>
              <div className="status-dot"></div>
              {isRunning ? 'ACTIVE' : 'STANDBY'}
            </div>
            {isDdosActive && (
              <motion.div className="attack-badge" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <AlertTriangle size={14} /> ATTACK
              </motion.div>
            )}
          </div>
        </header>

        <div className="content-grid-3">
          <aside className="sidebar">
            <div className="stats-section">
              <h3 className="section-title">METRICS</h3>
              <StatCard
                label="Throughput"
                value={`${Math.round(data.global_stats.total_throughput_mbps)}`}
                unit="Mbps"
                icon={<Activity size={16} />}
                color="blue"
              />
              <StatCard
                label="Entropy"
                value={data.global_stats.avg_system_entropy.toFixed(2)}
                subtext={data.global_stats.avg_system_entropy < 0.5 ? "⚠ LOW ENTROPY" : "Normal Distribution"}
                icon={<Shield size={16} />}
                color={data.global_stats.avg_system_entropy < 0.5 ? "red" : "purple"}
              />
              <StatCard
                label="Nodes"
                value={data.global_stats.active_nodes}
                icon={<Zap size={16} />}
                color="green"
              />
            </div>

            <div className="controls-section">
              <h3 className="section-title">CONTROLS</h3>
              <div className="control-buttons">
                <button
                  onClick={() => handleControl(isRunning ? 'stop' : 'start')}
                  className={`ctrl-btn ${isRunning ? 'stop' : 'start'}`}
                >
                  {isRunning ? <><Pause size={14} /> PAUSE</> : <><Play size={14} /> START</>}
                </button>
                <button onClick={() => handleControl('reset')} className="ctrl-btn reset">
                  <RotateCcw size={14} /> RESET
                </button>
              </div>
              <button
                onClick={() => handleTrigger('ddos')}
                className={`ctrl-btn attack ${isDdosActive ? 'active' : ''}`}
              >
                <AlertTriangle size={14} />
                {isDdosActive ? 'STOP ATTACK' : 'SIMULATE DDoS'}
              </button>
            </div>
          </aside>

          <main className="visualization-area">
            <div className="viz-header">
              <h2>NETWORK TOPOLOGY</h2>
              <div className="legend">
                <span className="legend-item"><span className="dot" style={{ background: '#60a5fa' }}></span>Low</span>
                <span className="legend-item"><span className="dot" style={{ background: '#22c55e' }}></span>Normal</span>
                <span className="legend-item"><span className="dot" style={{ background: '#f59e0b' }}></span>High</span>
                <span className="legend-item"><span className="dot" style={{ background: '#ef4444' }}></span>Critical</span>
              </div>
            </div>
            <div className="topology-container">
              <HospitalTopology nodes={data.nodes} links={data.links} />
            </div>
          </main>

          <aside className="terminal-panel">
            <div className="terminal-header-bar">
              <Terminal size={14} />
              <span>System Logs</span>
            </div>
            <TerminalLog alerts={allAlerts} />
          </aside>
        </div>
      </div>
    </div>
  )
}

export default App
