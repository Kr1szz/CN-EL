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

def run_analysis():
    print("Initializing Simulation for Analysis...")
    sim = NetworkSimulation()
    sim.running = True
    
    # Data Storage
    time_steps = []
    load_history = []
    entropy_history = []
    loss_history = []
    
    # Simulation Phases
    phases = [
        ("NORMAL", 40),      # 40 steps
        ("CONGESTED", 40),   # 40 steps
        ("DDOS", 40)         # 40 steps
    ]
    
    current_step = 0
    
    print("Running Simulation Phases...")
    for phase_name, duration in phases:
        print(f"  > Switching to {phase_name}...")
        sim.traffic_mode = phase_name
        
        for _ in range(duration):
            sim.update()
            state = sim.get_state()
            
            time_steps.append(current_step)
            load_history.append(state['global_stats']['total_throughput_mbps'])
            entropy_history.append(state['global_stats']['avg_system_entropy'])
            
            # Max packet loss across all links
            max_loss = max([l['packet_loss'] for l in state['links']]) if state['links'] else 0
            loss_history.append(max_loss)
            
            current_step += 1
            
    # Plotting
    print("Generating Plots...")
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 12), sharex=True)
    
    # 1. Throughput (Load)
    ax1.plot(time_steps, load_history, color='#2563eb', linewidth=2, label='Total Load')
    ax1.set_ylabel('Throughput (Mbps)')
    ax1.set_title('Network Traffic Analysis: Normal vs Congestion vs DDoS')
    ax1.grid(True, linestyle='--', alpha=0.6)
    ax1.legend()
    
    # Add phase zones
    ax1.axvspan(0, 40, color='green', alpha=0.1, label='Normal')
    ax1.axvspan(40, 80, color='orange', alpha=0.1, label='Congested')
    ax1.axvspan(80, 120, color='red', alpha=0.1, label='DDoS')
    
    # Annotate phases
    ax1.text(20, max(load_history)*0.9, "NORMAL", ha='center', color='green', fontweight='bold')
    ax1.text(60, max(load_history)*0.9, "CONGESTED", ha='center', color='orange', fontweight='bold')
    ax1.text(100, max(load_history)*0.9, "DDOS", ha='center', color='red', fontweight='bold')

    # 2. Entropy
    ax2.plot(time_steps, entropy_history, color='#9333ea', linewidth=2, label='System Entropy')
    ax2.set_ylabel('Shannon Entropy (0-1)')
    ax2.set_ylim(0, 1.2)
    ax2.grid(True, linestyle='--', alpha=0.6)
    ax2.legend()
    
    # Highlight Threshold
    ax2.axhline(y=0.5, color='red', linestyle='--', label='Anomaly Threshold')
    
    # Phase backgrounds for context
    ax2.axvspan(0, 40, color='green', alpha=0.05)
    ax2.axvspan(40, 80, color='orange', alpha=0.05)
    ax2.axvspan(80, 120, color='red', alpha=0.05)

    # 3. Packet Loss
    ax3.plot(time_steps, loss_history, color='#dc2626', linewidth=2, label='Max Link Loss')
    ax3.set_ylabel('Packet Drop Rate (0-1)')
    ax3.set_xlabel('Simulation Steps')
    ax3.set_ylim(0, 1.0)
    ax3.grid(True, linestyle='--', alpha=0.6)
    ax3.legend()
    
    # Phase backgrounds
    ax3.axvspan(0, 40, color='green', alpha=0.05)
    ax3.axvspan(40, 80, color='orange', alpha=0.05)
    ax3.axvspan(80, 120, color='red', alpha=0.05)

    plt.tight_layout()
    output_path = os.path.join(os.path.dirname(__file__), 'traffic_analysis.png')
    plt.savefig(output_path)
    print(f"Plot saved to: {output_path}")
    
    # Show plot interactively if possible
    try:
        plt.show()
    except:
        pass

if __name__ == "__main__":
    run_analysis()
