

``
# SD-WAN Hospital Network Simulator

A real-time visualization tool that simulates network traffic in a hospital environment. This project demonstrates how modern networks detect congestion and defend against DDoS attacks using statistical algorithms.

##  Overview
This tool models a hospital's digital infrastructure (ICUs, Radiology, Servers, etc.) and visualizes data flowing between them. It is designed to help users:
- **Watch real-time traffic** flow through the network.
- **Simulate a DDoS attack** to see how the network reacts under stress.
- **Visualize detection metrics** like Shannon Entropy and Congestion Scores in real-time.

##  Key Features
- **Interactive Map:** A draggable network topology of a hospital.
- **Live Metrics:** Real-time graphs for throughput, latency, and packet loss.
- **Attack Simulation:** One-click trigger to simulate a volumetric DDoS attack.
- **Smart Detection:** Uses industry-standard algorithms (EWMA, Token Bucket, Shannon Entropy) to identify anomalies automatically.

---

##  Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+

### 1. Installation

**Clone the repository:**
```bash
git clone [https://github.com/Kr1szz/CN-EL.git](https://github.com/Kr1szz/CN-EL.git)
cd CN-EL/simulator

```

**Set up the Backend (Python):**

```bash
python -m venv venv
# Activate the virtual environment:
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install flask networkx

```

**Set up the Frontend (React):**

```bash
cd frontend
npm install

```

### 2. Running the Application

**Terminal 1: Start the Backend**

```bash
# From the 'simulator' directory
./venv/bin/python app.py

```

**Terminal 2: Start the Frontend**

```bash
# From the 'simulator/frontend' directory
npm run dev

```

### 3. Open the Simulator

Open your browser and navigate to: **[http://localhost:5173](https://www.google.com/search?q=http://localhost:5173)**

---

## 🎮 How to Use

1. **Start:** Click the **START** button to begin normal traffic generation.
2. **Observe:** Watch the links change color (Blue/Green) as data flows normally between departments.
3. **Attack:** Click **SIMULATE DDoS**.
* *Watch for:* Links turning **Red** (Congestion).
* *Watch for:* The **Entropy Score** dropping (indicating an attack).


4. **Stop:** Click **STOP ATTACK** to let the network recover.

##  How Detection Works

The system uses three main signals to detect trouble:

* **EWMA (Exponentially Weighted Moving Average):** Smooths out jittery latency numbers to find the true trend of network speed.
* **Shannon Entropy:** Measures the "randomness" of traffic. High randomness is healthy; low randomness (uniform packet floods) indicates an attack.
* **Token Bucket:** Controls the rate of traffic to prevent bursts from crashing the system.

## 📊 Color Legend

| Color | Status | Usage |
| --- | --- | --- |
|  Blue | Idle | < 5% |
|  Green | Healthy | 5-50% |
|  Orange | Busy | 50-80% |
|  Red | Congested | > 80% |

---

## 🏗️ Architecture

* **Frontend:** React + Vite (Interactive Map & Graphs)
* **Backend:** Flask + Python (Simulation Logic & Math)
* **Graphing:** NetworkX (Topology Path Calculations)

```

```
