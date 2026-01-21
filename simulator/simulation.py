
import random
import time
import networkx as nx
import math
from collections import deque

class TrafficType:
    VOIP = "VOIP"          # High priority, low bandwidth, jitter sensitive
    DICOM = "DICOM"        # High bandwidth (X-ray images), bursty
    EMR = "EMR"            # Medium priority (Patient records), transactional
    GUEST = "GUEST"        # Low priority (Wi-Fi), noisy
    ATTACK = "DDOS"        # Malicious, high volume, low entropy
    IOT = "IOT"            # Constant low bandwidth sensors

class Link:
    def __init__(self, source, target, capacity_mbps, base_latency_ms):
        self.source = source
        self.target = target
        self.capacity = capacity_mbps
        self.base_latency = base_latency_ms
        
        # Real-time state
        self.current_load = 0.0
        self.packet_loss = 0.0
        self.jitter = 0.0
        self.active_traffic = [] 
        
        # ALGORITHM 1: EWMA for Latency (Detection)
        self.ewma_alpha = 0.125
        self.ewma_rtt = base_latency_ms
        self.current_rtt = base_latency_ms
        
        # ALGORITHM 2: Token Bucket (Capacity/Policing Model)
        self.bucket_capacity = capacity_mbps * 0.5 # Burst size allow 50% of capacity
        self.tokens = self.bucket_capacity
        self.last_update_time = time.time()
        
        # ALGORITHM 3: Shannon Entropy (Anomaly Detection)
        self.entropy = 1.0 # Normalized (0-1)
        
        # Metrics History for Z-Score
        self.load_history = deque(maxlen=50)

    def update(self):
        # 1. Token Bucket Refill
        now = time.time()
        dt = now - self.last_update_time
        if dt <= 0: return # Prevent division by zero
        self.last_update_time = now
        
        # Refill tokens (Rate * Time = Volume)
        refill = self.capacity * dt
        self.tokens = min(self.bucket_capacity, self.tokens + refill)

        # 2. Calculate Load
        # target_load is in Mbps (Rate)
        target_load = sum(t['amount'] for t in self.active_traffic)
        
        # consumed_volume is in Mb (Volume)
        needed_tokens = target_load * dt
        
        if needed_tokens > self.tokens:
            # We are exceeding burst capacity -> Packet Loss
            served_tokens = self.tokens
            loss = needed_tokens - self.tokens
            self.packet_loss = min(1.0, loss / needed_tokens)
            self.tokens = 0
            # Effective rate = Volume / Time
            served_load = served_tokens / dt
        else:
            self.tokens -= needed_tokens
            self.packet_loss = 0.0
            served_load = target_load

        self.current_load = served_load
        self.load_history.append(self.current_load)

        # 3. Congestion & Latency Logic
        utilization = served_load / self.capacity if self.capacity > 0 else 0
        
        # Latency curve (Exponential)
        if utilization > 0.6:
            queue_factor = (utilization - 0.6) * 15
            instant_rtt = self.base_latency * (1 + queue_factor)
        else:
            instant_rtt = self.base_latency
            
        # Jitter
        self.jitter = random.uniform(0, 2) if utilization < 0.8 else random.uniform(5, 25)
        instant_rtt += self.jitter
        
        # Apply EWMA
        self.ewma_rtt = (1 - self.ewma_alpha) * self.ewma_rtt + (self.ewma_alpha * instant_rtt)
        self.current_rtt = instant_rtt

        # 4. Entropy Logic
        type_counts = {}
        total_flows = len(self.active_traffic)
        if total_flows > 0:
            for t in self.active_traffic:
                type_counts[t['type']] = type_counts.get(t['type'], 0) + 1
            entropy_sum = 0
            for count in type_counts.values():
                p = count / total_flows
                entropy_sum -= p * math.log2(p)
            max_entropy = math.log2(6) 
            self.entropy = min(1.0, entropy_sum / max_entropy)
        else:
            self.entropy = 1.0

    def to_dict(self):
        return {
            "source": self.source,
            "target": self.target,
            "capacity": round(self.capacity),
            "load": round(self.current_load, 1),
            "utilization": round((self.current_load / self.capacity) * 100, 1) if self.capacity else 0,
            "latency": round(self.ewma_rtt, 1), # Send Smoothed RTT
            "jitter": round(self.jitter, 1),
            "packet_loss": round(self.packet_loss * 100, 1),
            "entropy": round(self.entropy, 2),
            "status": "CRITICAL" if self.packet_loss > 0.05 else ("WARNING" if self.current_load > self.capacity * 0.8 else "NORMAL")
        }

class NetworkSimulation:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.nodes = []
        self.links = {}
        self.alerts = []
        self.running = False
        self.ddos_active = False
        self.setup_network_floors()
        
    def setup_network_floors(self):
        # NEW: Floor-based topology
        # Floor 1: Critical Care (ICU, OT)
        # Floor 2: Diagnostics (Radiology, Labs)
        # Floor 3: General (Wards, Admin, Public)
        # Server Room: Basement
        
        self.nodes = [
            {"id": "Server Room", "label": "Main Data Center", "floor": 0, "type": "server", "pos": {"x": 500, "y": 500}},
            
            {"id": "ICU-A", "label": "ICU Unit A", "floor": 1, "type": "critical", "pos": {"x": 300, "y": 300}},
            {"id": "ICU-B", "label": "ICU Unit B", "floor": 1, "type": "critical", "pos": {"x": 700, "y": 300}},
            {"id": "OT-1", "label": "Operation Theater", "floor": 1, "type": "critical", "pos": {"x": 500, "y": 200}},
            
            {"id": "Radiology", "label": "Radiology Dept", "floor": 2, "type": "high_bandwidth", "pos": {"x": 400, "y": 400}},
            {"id": "Lab", "label": "Pathology Lab", "floor": 2, "type": "staff", "pos": {"x": 600, "y": 400}},
            
            {"id": "Admin", "label": "Admin Block", "floor": 3, "type": "staff", "pos": {"x": 200, "y": 500}},
            {"id": "Wards", "label": "Patient Wards", "floor": 3, "type": "general", "pos": {"x": 500, "y": 600}},
            {"id": "Public-Wifi", "label": "Guest Wi-Fi", "floor": 3, "type": "guest", "pos": {"x": 800, "y": 500}},
        ]
        
        # Create core backbone to floors (Vertical Cabling)
        self.add_link("Server Room", "ICU-A", 2000, 1)
        self.add_link("Server Room", "ICU-B", 2000, 1)
        self.add_link("Server Room", "Radiology", 5000, 2) # Massive pipe for MRI
        self.add_link("Server Room", "Admin", 1000, 3)
        
        # Horizontal Links (Cross-department)
        self.add_link("ICU-A", "OT-1", 1000, 1)
        self.add_link("Radiology", "ICU-A", 1000, 2) # X-rays to ICU
        self.add_link("Radiology", "Lab", 800, 2)    # Lab results to Radiology
        self.add_link("Lab", "Server Room", 600, 3)  # Lab data backup
        self.add_link("Admin", "Public-Wifi", 500, 5)
        self.add_link("Admin", "Wards", 500, 3)

    def add_link(self, u, v, cap, lat):
        l1 = Link(u, v, cap, lat)
        l2 = Link(v, u, cap, lat)
        self.links[(u, v)] = l1
        self.links[(v, u)] = l2
        self.graph.add_edge(u, v, data=l1)
        self.graph.add_edge(v, u, data=l2)

    def generate_traffic(self):
        if not self.running:
            return

        for link in self.links.values():
            link.active_traffic = []
            # Baseline IOT Traffic everywhere
            link.active_traffic.append({"type": TrafficType.IOT, "amount": random.uniform(1, 5)})

        # SIMULATION FLOWS
        # 1. ICU Monitoring
        for icu in ["ICU-A", "ICU-B"]:
            l = self.find_link(icu, "Server Room")
            if l: l.active_traffic.append({"type": TrafficType.EMR, "amount": random.uniform(200, 600)})
            
        # 2. Radiology - Bursty
        l = self.find_link("Radiology", "Server Room")
        if l: l.active_traffic.append({"type": TrafficType.DICOM, "amount": random.uniform(500, 2500)})
        
        # 3. Lab data
        l = self.find_link("Lab", "Server Room")
        if l: l.active_traffic.append({"type": TrafficType.EMR, "amount": random.uniform(50, 200)})
        l = self.find_link("Lab", "Radiology")
        if l: l.active_traffic.append({"type": TrafficType.EMR, "amount": random.uniform(100, 400)})
        
        # 4. Admin/Wards
        l = self.find_link("Admin", "Server Room")
        if l: l.active_traffic.append({"type": TrafficType.EMR, "amount": random.uniform(100, 500)})
        l = self.find_link("Admin", "Wards")
        if l: l.active_traffic.append({"type": TrafficType.VOIP, "amount": random.uniform(50, 250)})
        
        # 5. Guest WiFi
        l = self.find_link("Public-Wifi", "Admin")
        if l: l.active_traffic.append({"type": TrafficType.GUEST, "amount": random.uniform(50, 400)})
        
        # 6. OT
        l = self.find_link("OT-1", "ICU-A")
        if l: l.active_traffic.append({"type": TrafficType.VOIP, "amount": random.uniform(100, 500)})
        
        # 7. Radiology to ICU
        l = self.find_link("Radiology", "ICU-A")
        if l: l.active_traffic.append({"type": TrafficType.DICOM, "amount": random.uniform(100, 600)})

        # DDoS ATTACK LOGIC
        if self.ddos_active:
            target = "Server Room"
            path = nx.shortest_path(self.graph, "Public-Wifi", target)
            for i in range(len(path)-1):
                u, v = path[i], path[i+1]
                if (u,v) in self.links:
                    # Massive attack traffic
                    self.links[(u,v)].active_traffic.append({"type": TrafficType.ATTACK, "amount": 4000})

    def find_link(self, u, v):
        return self.links.get((u, v))

    def update(self):
        self.generate_traffic()
        
        global_latencies = []
        
        for link in self.links.values():
            link.update()
            
            # MATH MODEL: Congestion Severity Score (CSS)
            # CSS = (Delay Factor * 0.5) + (Loss Factor * 0.3) + (Entropy Factor * 0.2)
            delay_factor = min(3.0, link.ewma_rtt / link.base_latency) # Cap at 3x
            loss_factor = link.packet_loss * 10 # 10% loss = 1.0 factor
            entropy_factor = (1.0 - link.entropy) # Lower entropy = higher anomaly
            
            css = (delay_factor * 0.5) + (loss_factor * 20.0) + (entropy_factor * 2.0)
            
            # ALGORITHM 4: Z-Score for Anomaly Detection (on Load)
            if len(link.load_history) > 10:
                avg_load = sum(link.load_history) / len(link.load_history)
                # std_dev calc
                variance = sum((x - avg_load) ** 2 for x in link.load_history) / len(link.load_history)
                std_dev = math.sqrt(variance)
                
                if std_dev > 0:
                    z_score = (link.current_load - avg_load) / std_dev
                    if z_score > 3.0: # 3 Sigma Rule
                        self.add_alert(f"Anomaly (Z-Score {z_score:.1f}) on {link.source}->{link.target}", "WARNING")

            # Check CSS threshold
            if css > 4.0:
                 self.add_alert(f"Critical Congestion (CSS {css:.1f}) on {link.source}->{link.target}", "CRITICAL")
                 
            global_latencies.append(link.ewma_rtt)

        # Truncate alerts
        if len(self.alerts) > 50:
             self.alerts = self.alerts[-50:]

    def add_alert(self, msg, level):
        # Deduplicate
        if self.alerts and self.alerts[-1]['msg'] == msg and self.alerts[-1]['time'] == time.strftime("%H:%M:%S"):
            return
        timestamp = time.strftime("%H:%M:%S")
        self.alerts.append({"time": timestamp, "msg": msg, "level": level})

    def get_state(self):
        # Helper to get stats
        total_load = sum(l.current_load for l in self.links.values())
        avg_entropy = sum(l.entropy for l in self.links.values()) / max(1, len(self.links))
        
        return {
            "nodes": self.nodes,
            "links": [l.to_dict() for l in self.links.values()],
            "alerts": self.alerts[-10:],
            "global_stats": {
                "total_throughput_mbps": round(total_load, 1),
                "avg_system_entropy": round(avg_entropy, 2),
                "active_nodes": len(self.nodes)
            }
        }
