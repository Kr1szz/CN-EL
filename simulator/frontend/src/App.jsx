
import { useState, useEffect, useRef } from 'react'

import { motion } from 'framer-motion'
import { Activity, Shield, Zap, Play, Pause, RotateCcw, AlertTriangle, Network, Cpu, Terminal, Wifi, Server } from 'lucide-react'
import HospitalTopology from './components/HospitalTopology'
import StatCard from './components/StatCard'
import TerminalLog from './components/TerminalLog'
import NetworkPulse from './components/NetworkPulse'
import EntropyGraph from './components/EntropyGraph'
import QoSPanel from './components/QoSPanel'


import { NetworkSimulation } from './simulation/NetworkSimulation'

function App() {
  const [data, setData] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [trafficMode, setTrafficMode] = useState('NORMAL')
  const [allAlerts, setAllAlerts] = useState([])

  // Use a ref to hold the simulation instance so it persists across renders
  // and doesn't trigger re-renders itself.
  const simRef = useRef(null)

  useEffect(() => {
    // Initialize simulation once
    simRef.current = new NetworkSimulation()

    // Initial fetch
    const initialState = simRef.current.getState()
    setData(initialState)
    setTrafficMode(initialState.traffic_mode)

    // Simulation Loop
    // Simulation Loop
    let animationFrameId
    let lastTime = 0
    const SIM_INTERVAL = 50 // 20Hz to match Python version

    const loop = (timestamp) => {
      if (!lastTime) lastTime = timestamp
      const elapsed = timestamp - lastTime

      if (elapsed >= SIM_INTERVAL) {
        if (simRef.current && simRef.current.running) {
          simRef.current.update()
        }

        if (simRef.current) {
          const state = simRef.current.getState()
          setData(state)

          // Fix Logs: Accumulate alerts instead of overwriting
          if (state.alerts?.length > 0) {
            setAllAlerts(prev => {
              const newAlerts = state.alerts.filter(
                a => !prev.some(p => p.time === a.time && p.msg === a.msg)
              )
              if (newAlerts.length === 0) return prev;
              return [...prev, ...newAlerts].slice(-100)
            })
          }
        }

        lastTime = timestamp
      }

      animationFrameId = requestAnimationFrame(loop)
    }

    animationFrameId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  const handleControl = (action) => {
    if (!simRef.current) return

    if (action === 'start') {
      simRef.current.running = true
      setIsRunning(true)
    }
    if (action === 'stop') {
      simRef.current.running = false
      setIsRunning(false)
    }
    if (action === 'reset') {
      simRef.current.running = false
      simRef.current.trafficMode = 'NORMAL'
      simRef.current.setupNetworkFloors() // Reset topology state if needed
      // Clear traffic
      Object.values(simRef.current.links).forEach(l => l.activeTraffic = [])

      setIsRunning(false)
      setTrafficMode('NORMAL')
      setAllAlerts([])
    }
  }

  const handleMode = (mode) => {
    if (!simRef.current) return
    simRef.current.trafficMode = mode
    setTrafficMode(mode)

    // Auto-start
    if (!simRef.current.running) {
      simRef.current.running = true
      setIsRunning(true)
    }
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

  const getModeColor = (mode) => {
    switch (mode) {
      case 'NORMAL': return '#22c55e'
      case 'CONGESTED': return '#f59e0b'
      case 'DDOS': return '#ef4444'
      default: return '#64748b'
    }
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
            <div className="mode-badge" style={{
              background: `${getModeColor(trafficMode)}20`,
              color: getModeColor(trafficMode),
              border: `1px solid ${getModeColor(trafficMode)}50`
            }}>
              <Server size={12} /> {trafficMode}
            </div>
          </div>
        </header>

        <div className="content-grid-3">
          {/* LEFT: Terminal Log */}
          <aside className="left-panel">
            <div className="terminal-panel">
              <div className="terminal-header-bar">
                <Terminal size={14} />
                <span>System Logs</span>
              </div>
              <TerminalLog alerts={allAlerts} />
            </div>
          </aside>

          {/* CENTER: Topology + Controls */}
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

            {/* Traffic Mode Buttons */}
            <div className="mode-controls">
              <div className="mode-buttons">
                <button
                  onClick={() => handleMode('NORMAL')}
                  className={`mode-btn normal ${trafficMode === 'NORMAL' ? 'active' : ''}`}
                >
                  <Wifi size={16} /> Normal Traffic
                </button>
                <button
                  onClick={() => handleMode('CONGESTED')}
                  className={`mode-btn congested ${trafficMode === 'CONGESTED' ? 'active' : ''}`}
                >
                  <Activity size={16} /> Congested
                </button>
                <button
                  onClick={() => handleMode('DDOS')}
                  className={`mode-btn ddos ${trafficMode === 'DDOS' ? 'active' : ''}`}
                >
                  <AlertTriangle size={16} /> DDoS Attack
                </button>
              </div>
              <div className="sim-controls">
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
            </div>
          </main>

          {/* RIGHT: Stats + Graphs */}
          <aside className="right-panel">
            <div className="stats-section">
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
                subtext={data.global_stats.avg_system_entropy < 0.5 ? "⚠ ANOMALY" : "Normal"}
                icon={<Shield size={16} />}
                color={data.global_stats.avg_system_entropy < 0.5 ? "red" : "purple"}
              />
            </div>

            <div className="graphs-section">
              <NetworkPulse throughput={data.global_stats.total_throughput_mbps} />
              <EntropyGraph entropy={data.global_stats.avg_system_entropy} />
              <QoSPanel links={data.links} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default App
