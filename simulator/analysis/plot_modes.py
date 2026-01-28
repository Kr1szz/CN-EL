"""
Private SD-WAN Network Traffic Analysis - Plot Generator

Generates visualization comparing Normal, Congested, and DDoS traffic patterns
with internal threat detection metrics for private SD-WAN networks.
"""

import sys
import os
import matplotlib.pyplot as plt
import numpy as np

# Add parent directory to path to import simulation
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from simulation import NetworkSimulation
except ImportError:
    # Auto-healing: Try to switch to venv python if networkx/simulation is missing
    print("Dependencies missing. Attempting to switch to virtual environment...")
    
    # Path to venv python relative to this script
    venv_python = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'venv', 'bin', 'python'))
    
    if os.path.exists(venv_python) and sys.executable != venv_python:
        print(f"Re-executing with: {venv_python}")
        os.execv(venv_python, [venv_python] + sys.argv)
    else:
        print("\n" + "="*60)
        print("CRITICAL ERROR: Missing Dependencies (networkx/matplotlib)")
        print(f"Could not find venv at: {venv_python}")
        print("="*60)
        print("Please run:  ./analysis/run.sh plot")
        sys.exit(1)

# Device registry for internal threat simulation
INTERNAL_THREAT_SOURCES = {
    "Public-Wifi": {"ip": "10.0.3.50", "type": "Guest AP", "threat_level": "HIGH"},
    "Lab": {"ip": "10.0.2.20", "type": "Compromised IoT", "threat_level": "MEDIUM"},
    "Wards": {"ip": "10.0.3.20", "type": "Bedside Terminal", "threat_level": "MEDIUM"},
    "OT-1": {"ip": "10.0.1.30", "type": "Surgical Device", "threat_level": "LOW"}
}

def run_analysis():
    print("="*60)
    print("Private SD-WAN Network Traffic Analysis")
    print("Internal Threat Detection Simulation")
    print("="*60)
    
    print("\nInitializing Simulation...")
    sim = NetworkSimulation()
    sim.running = True
    
    # Data Storage
    time_steps = []
    load_history = []
    entropy_history = []
    loss_history = []
    qos_gold_served = []  # Track QoS effectiveness
    
    # Simulation Phases
    phases = [
        ("NORMAL", 50),      # 50 steps - baseline
        ("CONGESTED", 50),   # 50 steps - legitimate congestion
        ("DDOS", 50)         # 50 steps - internal DDoS attack
    ]
    
    current_step = 0
    
    print("\nRunning Simulation Phases...")
    for phase_name, duration in phases:
        print(f"  → Switching to {phase_name}...")
        sim.traffic_mode = phase_name
        
        for _ in range(duration):
            sim.update()
            state = sim.get_state()
            
            time_steps.append(current_step)
            load_history.append(state['global_stats']['total_throughput_mbps'])
            entropy_history.append(state['global_stats']['avg_system_entropy'])
            
            # Max packet loss across all links
            max_loss = max([l['packet_loss'] for l in state['links']]) if state['links'] else 0
            loss_history.append(max_loss / 100.0)  # Normalize to 0-1
            
            # Track QoS (sum of gold served across links)
            gold_served = sum([l['qos']['gold_served'] for l in state['links']])
            qos_gold_served.append(gold_served)
            
            current_step += 1

    print("\nGenerating Plots...")
    
    # Use a dark theme for professional look
    plt.style.use('dark_background')
    
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('Private SD-WAN: Internal Threat Detection Analysis', fontsize=14, fontweight='bold', color='#e0e0e0')
    
    # Define phase boundaries
    phase_boundaries = [0, 50, 100, 150]
    phase_colors = ['#22c55e', '#f59e0b', '#ef4444']  # Green, Orange, Red
    phase_labels = ['NORMAL', 'CONGESTED', 'INTERNAL DDoS']
    
    def add_phase_backgrounds(ax):
        for i, (start, end) in enumerate(zip(phase_boundaries[:-1], phase_boundaries[1:])):
            ax.axvspan(start, end, color=phase_colors[i], alpha=0.15)
    
    # ============================================
    # 1. Throughput (Top Left)
    # ============================================
    ax1 = axes[0, 0]
    ax1.plot(time_steps, load_history, color='#3b82f6', linewidth=2, label='Total Load (Mbps)')
    ax1.set_ylabel('Throughput (Mbps)', color='#94a3b8')
    ax1.set_title('Network Load', fontweight='bold', color='#e0e0e0')
    ax1.grid(True, linestyle='--', alpha=0.3, color='#334155')
    ax1.legend(loc='upper left', fontsize=8)
    add_phase_backgrounds(ax1)
    
    # Add phase labels
    for i, label in enumerate(phase_labels):
        mid = (phase_boundaries[i] + phase_boundaries[i+1]) / 2
        ax1.text(mid, max(load_history)*0.95, label, ha='center', fontsize=9, 
                color=phase_colors[i], fontweight='bold')

    # ============================================
    # 2. Shannon Entropy (Top Right)
    # ============================================
    ax2 = axes[0, 1]
    ax2.plot(time_steps, entropy_history, color='#a855f7', linewidth=2, label='System Entropy')
    ax2.axhline(y=0.5, color='#ef4444', linestyle='--', linewidth=1.5, label='Anomaly Threshold')
    ax2.set_ylabel('Shannon Entropy (0-1)', color='#94a3b8')
    ax2.set_ylim(0, 1.1)
    ax2.set_title('Traffic Diversity (Entropy)', fontweight='bold', color='#e0e0e0')
    ax2.grid(True, linestyle='--', alpha=0.3, color='#334155')
    ax2.legend(loc='lower left', fontsize=8)
    add_phase_backgrounds(ax2)
    
    # Annotate entropy drop during DDoS
    ax2.annotate('Entropy drops\nduring DDoS', xy=(125, 0.2), xytext=(110, 0.6),
                fontsize=8, color='#f59e0b',
                arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.5))

    # ============================================
    # 3. Packet Loss (Bottom Left)
    # ============================================
    ax3 = axes[1, 0]
    ax3.fill_between(time_steps, loss_history, color='#ef4444', alpha=0.5)
    ax3.plot(time_steps, loss_history, color='#ef4444', linewidth=2, label='Packet Loss')
    ax3.set_ylabel('Packet Loss Rate', color='#94a3b8')
    ax3.set_xlabel('Simulation Steps', color='#94a3b8')
    ax3.set_ylim(0, 1.0)
    ax3.set_title('Packet Loss (QoS Impact)', fontweight='bold', color='#e0e0e0')
    ax3.grid(True, linestyle='--', alpha=0.3, color='#334155')
    ax3.legend(loc='upper left', fontsize=8)
    add_phase_backgrounds(ax3)

    # ============================================
    # 4. Internal Threat Source Distribution (Bottom Right)
    # ============================================
    ax4 = axes[1, 1]
    
    # Create bar chart of internal threat sources
    sources = list(INTERNAL_THREAT_SOURCES.keys())
    threat_levels = [3 if v['threat_level'] == 'HIGH' else 2 if v['threat_level'] == 'MEDIUM' else 1 
                    for v in INTERNAL_THREAT_SOURCES.values()]
    colors = ['#ef4444' if t == 3 else '#f59e0b' if t == 2 else '#22c55e' for t in threat_levels]
    
    bars = ax4.barh(sources, threat_levels, color=colors, edgecolor='white', linewidth=0.5)
    ax4.set_xlabel('Threat Level', color='#94a3b8')
    ax4.set_title('Internal Attack Sources (Private Network)', fontweight='bold', color='#e0e0e0')
    ax4.set_xlim(0, 4)
    ax4.set_xticks([1, 2, 3])
    ax4.set_xticklabels(['LOW', 'MEDIUM', 'HIGH'])
    ax4.grid(True, axis='x', linestyle='--', alpha=0.3, color='#334155')
    
    # Add IP addresses as annotations
    for i, (source, info) in enumerate(INTERNAL_THREAT_SOURCES.items()):
        ax4.annotate(f'{info["ip"]} ({info["type"]})', 
                    xy=(threat_levels[i] + 0.1, i), 
                    fontsize=8, color='#94a3b8', va='center')
    
    # Add explanatory note
    ax4.text(0.5, -0.15, 'Note: Private SD-WAN threats originate from internal compromised devices\n(IoT, guest networks, insider threats) - NOT external internet sources.',
            transform=ax4.transAxes, fontsize=7, color='#64748b', ha='center')

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    
    output_path = os.path.join(os.path.dirname(__file__), 'traffic_analysis.png')
    plt.savefig(output_path, dpi=150, facecolor='#0f172a', edgecolor='none')
    print(f"\n✓ Plot saved to: {output_path}")
    
    # Summary statistics
    print("\n" + "="*60)
    print("SUMMARY STATISTICS")
    print("="*60)
    print(f"  Normal Phase:    Avg Load = {np.mean(load_history[:50]):.1f} Mbps, Avg Entropy = {np.mean(entropy_history[:50]):.2f}")
    print(f"  Congested Phase: Avg Load = {np.mean(load_history[50:100]):.1f} Mbps, Avg Entropy = {np.mean(entropy_history[50:100]):.2f}")
    print(f"  DDoS Phase:      Avg Load = {np.mean(load_history[100:]):.1f} Mbps, Avg Entropy = {np.mean(entropy_history[100:]):.2f}")
    print(f"\n  Key Insight: Entropy drops significantly during DDoS (single traffic type dominant)")
    print(f"  Internal threat sources: {', '.join(sources)}")
    print("="*60)
    
    # Show plot interactively if possible
    try:
        plt.show()
    except:
        pass

if __name__ == "__main__":
    run_analysis()
