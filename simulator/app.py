
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
    return jsonify(sim.get_state())

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
        sim.ddos_active = False
        sim.setup_network_floors()
        return jsonify({"status": "Simulation Reset"})
    
    return jsonify({"error": "Invalid Action"}), 400

@app.route('/api/trigger', methods=['POST'])
def trigger():
    data = request.json
    event = data.get('event')
    
    if event == 'ddos':
        sim.ddos_active = not sim.ddos_active
        status = "STARTED" if sim.ddos_active else "STOPPED"
        return jsonify({"status": f"DDoS Attack {status}"})
    
    return jsonify({"error": "Invalid Event"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
