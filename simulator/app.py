
from flask import Flask, render_template, jsonify, request
from simulation import NetworkSimulation
import threading
import time

app = Flask(__name__)
sim = NetworkSimulation()

# Background Simulation Thread
def run_simulation():
    while True:
        if sim.running:
            sim.update()
        time.sleep(0.05)

sim_thread = threading.Thread(target=run_simulation, daemon=True)
sim_thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def get_state():
    state = sim.get_state()
    state['traffic_mode'] = sim.traffic_mode
    return jsonify(state)

@app.route('/api/control', methods=['POST'])
def control():
    data = request.json
    action = data.get('action')
    
    if action == 'start':
        sim.running = True
        return jsonify({"status": "Simulation Started"})
    elif action == 'stop':
        sim.running = False
        return jsonify({"status": "Simulation Paused"})
    elif action == 'reset':
        sim.running = False
        sim.traffic_mode = 'NORMAL'
        sim.setup_network_floors()
        return jsonify({"status": "Simulation Reset"})
    
    return jsonify({"error": "Invalid Action"}), 400

@app.route('/api/mode', methods=['POST'])
def set_mode():
    data = request.json
    mode = data.get('mode')
    
    if mode in ['NORMAL', 'CONGESTED', 'DDOS']:
        sim.traffic_mode = mode
        # Auto-start if not running
        if not sim.running:
            sim.running = True
        return jsonify({"status": f"Traffic mode set to {mode}", "mode": mode})
    
    return jsonify({"error": "Invalid mode"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
