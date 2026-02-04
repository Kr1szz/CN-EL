"""
Private SD-WAN Real-Time Traffic Analysis Dashboard

Live animated visualization showing:
1. Network Load (Throughput over time)
2. Shannon Entropy (Anomaly detection)
3. Packet Loss (QoS impact)
4. Internal Threat Sources (Attack origin monitoring)

Run: python analysis/realtime_plot.py
"""

import sys
import os
import time
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
from collections import deque

# Add parent directory to path to import simulation
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from simulation import NetworkSimulation
except ImportError:
    print("Dependencies missing. Attempting to switch to virtual environment...")
    venv_python = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'venv', 'bin', 'python'))
    if os.path.exists(venv_python) and sys.executable != venv_python:
        os.execv(venv_python, [venv_python] + sys.argv)
    else:
        print("CRITICAL ERROR: Missing Dependencies. Please run ./analysis/run.sh realtime")
        sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================
DURATION_SEC = 15  # Total duration: Normal(15s) + Congested(15s) + DDoS(15s)
FPS = 10
TOTAL_FRAMES = DURATION_SEC * FPS

# Internal threat sources for private SD-WAN
THREAT_SOURCES = {
    "Public-Wifi": {"ip": "10.0.3.50", "type": "Guest AP", "level": 3},      # HIGH
    "Lab": {"ip": "10.0.2.20", "type": "Compromised IoT", "level": 2},        # MEDIUM
    "Wards": {"ip": "10.0.3.20", "type": "Bedside Terminal", "level": 2},     # MEDIUM
    "OT-1": {"ip": "10.0.1.30", "type": "Surgical Device", "level": 1}        # LOW
}

# ============================================================================
# SIMULATION SETUP
# ============================================================================
sim = NetworkSimulation()
sim.running = True

# Data storage
history = {
    'time': deque(maxlen=TOTAL_FRAMES),
    'load': deque(maxlen=TOTAL_FRAMES),
    'entropy': deque(maxlen=TOTAL_FRAMES),
    'loss': deque(maxlen=TOTAL_FRAMES),
}

# ============================================================================
# PLOT SETUP - Dark Theme 2x2 Grid
# ============================================================================
plt.style.use('dark_background')
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 9))
fig.suptitle('Private SD-WAN: Real-Time Internal Threat Detection', fontsize=14, fontweight='bold', color='#e0e0e0')
plt.subplots_adjust(hspace=0.35, wspace=0.25, top=0.92)

# Colors
COLORS = {
    'NORMAL': '#22c55e',
    'CONGESTED': '#f59e0b',
    'DDOS': '#ef4444',
    'load': '#3b82f6',
    'entropy': '#a855f7',
    'loss': '#ef4444',
    'grid': '#334155'
}

def setup_ax(ax, title, ylabel):
    ax.set_title(title, fontweight='bold', fontsize=10, color='#e0e0e0')
    ax.set_ylabel(ylabel, fontsize=9, color='#94a3b8')
    ax.set_xlabel('Time (s)', fontsize=8, color='#64748b')
    ax.grid(True, linestyle='--', alpha=0.3, color=COLORS['grid'])
    ax.tick_params(colors='#94a3b8')
    ax.set_facecolor('#0f172a')
    for spine in ax.spines.values():
        spine.set_color('#334155')

setup_ax(ax1, '📊 Network Load (Throughput)', 'Mbps')
setup_ax(ax2, '🔐 Shannon Entropy (Anomaly Detection)', 'Entropy (0-1)')
setup_ax(ax3, '📉 Packet Loss (QoS Impact)', 'Loss Rate')

# Initialize lines
line_load, = ax1.plot([], [], color=COLORS['load'], linewidth=2, label='Total Load')
fill_load = None

line_entropy, = ax2.plot([], [], color=COLORS['entropy'], linewidth=2, label='System Entropy')
ax2.axhline(y=0.5, color='#ef4444', linestyle='--', linewidth=1.5, alpha=0.7, label='Anomaly Threshold')
ax2.set_ylim(0, 1.1)
ax2.legend(loc='lower left', fontsize=7)

line_loss, = ax3.plot([], [], color=COLORS['loss'], linewidth=2, label='Max Link Loss')
ax3.set_ylim(0, 1.0)

# Threat sources bar chart (static base)
ax4.set_title('⚠️ Internal Attack Sources (Private Network)', fontweight='bold', fontsize=10, color='#e0e0e0')
ax4.set_facecolor('#0f172a')
for spine in ax4.spines.values():
    spine.set_color('#334155')

# Mode indicator text
mode_text = fig.text(0.5, 0.96, 'MODE: INITIALIZING', ha='center', fontsize=11, 
                     fontweight='bold', color='#64748b',
                     bbox=dict(boxstyle='round', facecolor='#1e293b', edgecolor='#334155'))

# ============================================================================
# ANIMATION UPDATE FUNCTION
# ============================================================================
def update(frame):
    global fill_load
    
    current_time = frame / FPS
    
    # Determine mode based on time phase
    if current_time < 5:
        mode = "NORMAL"
        mode_color = COLORS['NORMAL']
        phase_alpha = 0.1
    elif current_time < 10:
        mode = "CONGESTED"
        mode_color = COLORS['CONGESTED']
        phase_alpha = 0.15
    else:
        mode = "DDOS"
        mode_color = COLORS['DDOS']
        phase_alpha = 0.2
    
    # Update simulation
    sim.traffic_mode = mode
    sim.update()
    state = sim.get_state()
    
    # Extract metrics
    history['time'].append(current_time)
    history['load'].append(state['global_stats']['total_throughput_mbps'])
    history['entropy'].append(state['global_stats']['avg_system_entropy'])
    
    # NEW: Metrics for Accuracy & WFQ
    # Get Accuracy
    acc_data = state['global_stats'].get('accuracy', {'score': 0})
    history['loss'].append(acc_data['score']) # Reusing 'loss' deque for 'accuracy' for now, or better, add new key
    
    # Calculate Total QoS Drops
    current_gold_drops = sum(l['qos']['gold_drops'] for l in state['links'])
    current_bronze_drops = sum(l['qos']['bronze_drops'] for l in state['links'])
    
    if not hasattr(update, "last_gold_drops"):
         update.last_gold_drops = 0
         update.last_bronze_drops = 0
         
    # Delta drops (drops per second roughly)
    d_gold = current_gold_drops - update.last_gold_drops
    d_bronze = current_bronze_drops - update.last_bronze_drops
    update.last_gold_drops = current_gold_drops
    update.last_bronze_drops = current_bronze_drops
    
    # Store drops
    if 'wfq_gold' not in history: history['wfq_gold'] = deque(maxlen=TOTAL_FRAMES)
    if 'wfq_bronze' not in history: history['wfq_bronze'] = deque(maxlen=TOTAL_FRAMES)
    
    history['wfq_gold'].append(d_gold)
    history['wfq_bronze'].append(d_bronze)

    # Max packet loss
    max_loss = max([l['packet_loss'] for l in state['links']]) / 100 if state['links'] else 0
    # history['loss'].append(max_loss) # REPLACED with Accuracy above
    
    # Update mode indicator
    mode_text.set_text(f'MODE: {mode} | DAY: {state["global_stats"].get("current_day", "WEEKDAY")}')
    mode_text.set_color(mode_color)
    
    # Time data
    times = list(history['time'])
    x_max = max(10, current_time + 2)
    
    # ========================
    # PLOT 1: Network Load
    # ========================
    ax1.clear()
    setup_ax(ax1, '📊 Network Load (Throughput)', 'Mbps')
    ax1.set_xlim(0, x_max)
    
    loads = list(history['load'])
    if loads:
        ax1.set_ylim(0, max(max(loads) * 1.1, 1000))
        ax1.fill_between(times, loads, alpha=0.3, color=COLORS['load'])
        ax1.plot(times, loads, color=COLORS['load'], linewidth=2)
        
        # Current value annotation
        ax1.annotate(f'{loads[-1]:.0f} Mbps', xy=(times[-1], loads[-1]),
                    xytext=(10, 10), textcoords='offset points',
                    fontsize=9, color=COLORS['load'], fontweight='bold')
    
    # Phase backgrounds
    ax1.axvspan(0, 15, color=COLORS['NORMAL'], alpha=0.05)
    ax1.axvspan(15, 30, color=COLORS['CONGESTED'], alpha=0.05)
    ax1.axvspan(30, 45, color=COLORS['DDOS'], alpha=0.05)
    
    # ========================
    # PLOT 2: Entropy
    # ========================
    ax2.clear()
    setup_ax(ax2, '🔐 Shannon Entropy (Anomaly Detection)', 'Entropy (0-1)')
    ax2.set_xlim(0, x_max)
    ax2.set_ylim(0, 1.1)
    ax2.axhline(y=0.5, color='#ef4444', linestyle='--', linewidth=1.5, alpha=0.7, label='Threshold')
    
    entropies = list(history['entropy'])
    if entropies:
        # Color based on current entropy
        ent_color = COLORS['DDOS'] if entropies[-1] < 0.5 else (COLORS['CONGESTED'] if entropies[-1] < 0.7 else COLORS['entropy'])
        ax2.fill_between(times, entropies, alpha=0.2, color=ent_color)
        ax2.plot(times, entropies, color=ent_color, linewidth=2)
        
        # Annotation
        status = "⚠️ ANOMALY" if entropies[-1] < 0.5 else "✓ Normal"
        ax2.annotate(f'{entropies[-1]:.2f} {status}', xy=(times[-1], entropies[-1]),
                    xytext=(10, -15), textcoords='offset points',
                    fontsize=9, color=ent_color, fontweight='bold')
    
    ax2.axvspan(0, 15, color=COLORS['NORMAL'], alpha=0.05)
    ax2.axvspan(15, 30, color=COLORS['CONGESTED'], alpha=0.05)
    ax2.axvspan(30, 45, color=COLORS['DDOS'], alpha=0.05)
    ax2.legend(loc='lower left', fontsize=7)
    
    # ========================
    # PLOT 3: Prediction Accuracy (NEW)
    # ========================
    ax3.clear()
    setup_ax(ax3, '🎯 Prediction Accuracy (Recall/Precision)', 'Accuracy %')
    ax3.set_xlim(0, x_max)
    ax3.set_ylim(0, 105)
    
    accuracies = list(history['loss']) # We stored accuracy score in 'loss' deque
    if accuracies:
        # Green if high accuracy, red if low
        acc_color = '#22c55e' if accuracies[-1] > 90 else '#ef4444'
        ax3.plot(times, accuracies, color=acc_color, linewidth=2, label='System Accuracy')
        
        ax3.annotate(f'{accuracies[-1]:.1f}%', xy=(times[-1], accuracies[-1]),
                    xytext=(10, 5), textcoords='offset points',
                    fontsize=9, color=acc_color, fontweight='bold')
                    
    ax3.axvspan(0, 15, color=COLORS['NORMAL'], alpha=0.05)
    ax3.axvspan(15, 30, color=COLORS['CONGESTED'], alpha=0.05)
    ax3.axvspan(30, 45, color=COLORS['DDOS'], alpha=0.05)
    
    # ========================
    # PLOT 4: WFQ Drops (NEW)
    # ========================
    ax4.clear()
    ax4.set_title('🛡️ QoS Stats: Weighted Fair Queuing Drops', fontweight='bold', fontsize=10, color='#e0e0e0')
    ax4.set_ylabel('Drops / Sec', fontsize=9, color='#94a3b8')
    ax4.set_xlabel('Time (s)', fontsize=8, color='#64748b')
    ax4.set_facecolor('#0f172a')
    for spine in ax4.spines.values():
        spine.set_color('#334155')
    ax4.grid(True, linestyle='--', alpha=0.3, color=COLORS['grid'])
    ax4.set_xlim(0, x_max)
    
    if 'wfq_bronze' in history:
        bronze = list(history['wfq_bronze'])
        gold = list(history['wfq_gold'])
        
        ax4.plot(times, bronze, color='#f59e0b', label='Bronze Drops (Bulk)', linewidth=1.5)
        ax4.plot(times, gold, color='#ef4444', label='Gold Drops (VoIP)', linewidth=2)
        
        if bronze:
             ax4.annotate(f'Bronze: {bronze[-1]}', xy=(times[-1], bronze[-1]), xytext=(10,0), textcoords='offset points', color='#f59e0b', fontsize=8)
             ax4.annotate(f'Gold: {gold[-1]}', xy=(times[-1], max(0, gold[-1])), xytext=(10,10), textcoords='offset points', color='#ef4444', fontsize=8)

    ax4.legend(loc='upper left', fontsize=8)
    
    # Progress indicator
    progress = (frame + 1) / TOTAL_FRAMES * 100
    if frame == TOTAL_FRAMES - 1:
        print(f"\n✓ Simulation Complete!")
        print(f"  Final Entropy: {entropies[-1]:.3f}")
        print(f"  Peak Load: {max(loads):.0f} Mbps")
    
    return []

# ============================================================================
# RUN ANIMATION
# ============================================================================
print("="*60)
print("Private SD-WAN Real-Time Traffic Analysis")
print("="*60)
print(f"Duration: {DURATION_SEC}s | Phases: Normal(15s) → Congested(15s) → DDoS(15s)")
print("Starting...")
print("")

ani = animation.FuncAnimation(fig, update, frames=TOTAL_FRAMES, interval=1000/FPS, repeat=False, blit=False)
plt.tight_layout(rect=[0, 0.03, 1, 0.92])
plt.show()
