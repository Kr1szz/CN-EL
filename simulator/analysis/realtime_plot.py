import sys
import os
import time
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
from collections import deque
import heapq

# Add parent directory to path to import simulation
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from simulation import NetworkSimulation
except ImportError:
    # Auto-healing: Try to switch to venv python if networkx/simulation is missing
    print("Dependencies missing. Attempting to switch to virtual environment...")
    venv_python = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'venv', 'bin', 'python'))
    if os.path.exists(venv_python) and sys.executable != venv_python:
        os.execv(venv_python, [venv_python] + sys.argv)
    else:
        print("CRITICAL ERROR: Missing Dependencies. Please run ./analysis/run.sh realtime")
        sys.exit(1)

# Configuration
DURATION_SEC = 40
FPS = 10
TOTAL_FRAMES = DURATION_SEC * FPS
WINDOW_SIZE = 300 # Keep last 300 points (30 seconds) for sliding window
# If user wants "linear" in the sense of "showing all history linearly until 40s", we can set maxlen to TOTAL_FRAMES
# But sliding window is better for "realtime". Let's set it to TOTAL_FRAMES to show full 40s context if space permits, 
# or just ensure scrolling works.
# User said "fix time graph... not visible after congestion". This implies scrolling broke.
# Let's simple keep ALL history for the 40s duration (it's short enough) to avoid complexity.
# deque is still good practice.

sim = NetworkSimulation()
sim.running = True

# Data Storage using Deque
history = {
    'time': deque(maxlen=TOTAL_FRAMES),
    'load': deque(maxlen=TOTAL_FRAMES),
    'entropy': deque(maxlen=TOTAL_FRAMES),
    'class_load': {
        'Gold': deque(maxlen=TOTAL_FRAMES), 
        'Silver': deque(maxlen=TOTAL_FRAMES), 
        'Bronze': deque(maxlen=TOTAL_FRAMES)
    },
    'class_drops': {
        'Gold': deque(maxlen=TOTAL_FRAMES), 
        'Silver': deque(maxlen=TOTAL_FRAMES), 
        'Bronze': deque(maxlen=TOTAL_FRAMES)
    }
}

# Setup Plot: 2x2 Grid
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 8))
plt.subplots_adjust(hspace=0.4, wspace=0.3)

# Style helper
def set_style(ax, title, ylabel):
    ax.set_title(title, fontweight='bold', fontsize=10)
    ax.set_ylabel(ylabel, fontsize=9)
    ax.grid(True, linestyle=':', alpha=0.6)
    ax.tick_params(axis='both', which='major', labelsize=8)

set_style(ax1, "1. SYSTEM LOAD (Throughput)", "Mbps")
set_style(ax2, "2. ANOMALY DETECTION (Entropy)", "Shannon Entropy")
set_style(ax3, "3. BANDWIDTH BATTLE (By Class)", "Throughput (Mbps)")
set_style(ax4, "4. PACKET DROPS (Cumulative)", "Total Drops")

# Lines
line_load, = ax1.plot([], [], color='#2563eb', linewidth=2, label='Total')
line_entropy, = ax2.plot([], [], color='#9333ea', linewidth=2, label='System')
ax2.axhline(y=0.5, color='red', linestyle='--', linewidth=1, label='Threshold')

# Bandwidth Battle Lines
colors = {'Gold': '#FFD700', 'Silver': '#A9A9A9', 'Bronze': '#CD7F32'}
lines_bb = {}
for cls, color in colors.items():
    lines_bb[cls], = ax3.plot([], [], color=color, linewidth=2, label=cls)
ax3.legend(loc='upper left', fontsize=8)

# Drop Bars (Container)
# We will redraw bars every frame or update heights

def update(frame):
    # 1. Update Simulation Mode
    current_time = frame / FPS
    
    if current_time < 10:
        mode = "NORMAL"
        color_bg = '#dcfce7' # Light Green
    elif current_time < 25:
        mode = "CONGESTED"
        color_bg = '#ffedd5' # Light Orange
    else:
        mode = "DDOS"
        color_bg = '#fee2e2' # Light Red
        
    sim.traffic_mode = mode
    sim.update()
    state = sim.get_state()
    
    # 2. Extract Metrics
    history['time'].append(current_time)
    
    # Global Stats
    history['load'].append(state['global_stats']['total_throughput_mbps'])
    history['entropy'].append(state['global_stats']['avg_system_entropy'])
    
    # Class Stats (Aggregated from all links)
    # We need to calculate this from link stats
    c_load = {'Gold': 0, 'Silver': 0, 'Bronze': 0}
    c_drops = {'Gold': 0, 'Silver': 0, 'Bronze': 0}
    
    # Need to modify simulation.py to expose real-time class throughput easily
    # Or iterate links here. iterating links is fine.
    for l in sim.links.values():
        # Heuristic: Distribute current load based on active_traffic types
        # simulation.py doesn't store per-class throughput history on link, only drops/served count
        # served count is monotonic increasing. We can take delta.
        c_drops['Gold'] += l.gold_drops
        c_drops['Silver'] += l.silver_drops
        c_drops['Bronze'] += l.bronze_drops
        
        # Estimate throughput from served counts (approximation for viz)
        # or better: re-sum active_traffic based on priority map
        # But active_traffic is "offered load", not served.
        # Let's use served counts delta!
        pass

    # DELTA CALCULATION for Throughput
    # We need to store previous totals to get delta
    if not hasattr(update, 'prev_served'):
        update.prev_served = {'Gold': 0, 'Silver': 0, 'Bronze': 0}
        
    curr_served = {'Gold': 0, 'Silver': 0, 'Bronze': 0}
    for l in sim.links.values():
        curr_served['Gold'] += l.gold_served
        curr_served['Silver'] += l.silver_served
        curr_served['Bronze'] += l.bronze_served
        
    # Delta * Packet Size (Avg 1500 bytes * 8 bits) / Time Step
    # Time step is ~0.1s (sim.update runs once per visual frame? No, sim.update is called here)
    # Simulator likely runs faster internally or we assume 1 tick.
    # We'll just map raw packets/tick to "Mbps" for visualization scale
    scale = 0.5 
    
    for cls in ['Gold', 'Silver', 'Bronze']:
        delta = curr_served[cls] - update.prev_served[cls]
        history['class_load'][cls].append(delta * scale * 100) # Scaling for visibility
        history['class_drops'][cls].append(c_drops[cls])
        
    update.prev_served = curr_served

    # 3. Update Plots
    
    # SCROLLING X-AXIS HANDLING
    # Strategy: Show full history up to 40s since it fits on screen easily.
    # If we wanted scrolling, we'd check current_time > window.
    
    x_max = max(10, current_time)
    x_min = 0 # Fixed start for linear progression over 40s
    
    # Update axes limits
    for ax in [ax1, ax2, ax3]:
        ax.set_xlim(x_min, x_max + 1) # +1 for breathing room
        ax.patch.set_facecolor(color_bg)
        ax.patch.set_alpha(0.3)
        
    # Plot 1: Load
    line_load.set_data(list(history['time']), list(history['load']))
    if len(history['load']) > 0:
        ax1.set_ylim(0, max(max(history['load'])*1.1, 10000))
    
    # Plot 2: Entropy
    line_entropy.set_data(list(history['time']), list(history['entropy']))
    
    # Plot 3: Bandwidth Battle
    for cls in ['Gold', 'Silver', 'Bronze']:
        lines_bb[cls].set_data(list(history['time']), list(history['class_load'][cls]))
    
    # Auto-scale Y for Bandwidth
    all_bw = []
    for cls in ['Gold', 'Silver', 'Bronze']:
        all_bw.extend(history['class_load'][cls])
        
    if all_bw:
        ax3.set_ylim(0, max(all_bw) * 1.1)
        
    # Plot 4: Drops (Bar Chart)
    ax4.clear()
    set_style(ax4, "4. PACKET DROPS (Cumulative)", "Total Drops")
    ax4.patch.set_facecolor(color_bg)
    ax4.patch.set_alpha(0.3)
    
    classes = ['Gold', 'Silver', 'Bronze']
    # Get latest values
    drop_counts = [history['class_drops'][c][-1] if history['class_drops'][c] else 0 for c in classes]
    bars = ax4.bar(classes, drop_counts, color=[colors[c] for c in classes])
    
    # Add values on top
    for bar in bars:
        height = bar.get_height()
        ax4.text(bar.get_x() + bar.get_width()/2., height,
                 f'{int(height)}',
                 ha='center', va='bottom', fontsize=9)

    # Stop after duration
    if frame >= TOTAL_FRAMES - 1:
        print("Simulation Complete.")

print(f"Starting DASHBOARD Simulation for {DURATION_SEC} seconds...")
ani = animation.FuncAnimation(fig, update, frames=TOTAL_FRAMES, interval=1000/FPS, repeat=False)
plt.show()
