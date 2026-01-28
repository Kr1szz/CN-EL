"""
Private SD-WAN Hospital Network Simulation

This simulation models a private SD-WAN network infrastructure for a hospital
environment. Private SD-WAN operates over dedicated circuits (not shared with
public internet), providing superior security and consistent performance for
healthcare-critical applications.
"""

import random
import time
import networkx as nx
import math
from collections import deque

class TrafficPriority:
    GOLD = "GOLD"       # Mission-critical (VoIP, Real-time control) - 0% drop target
    SILVER = "SILVER"   # Important (Streaming, Database sync)
    BRONZE = "BRONZE"   # Low priority (File downloads, Background updates)

# Priority weights for WFQ scheduling
PRIORITY_WEIGHTS = {
    TrafficPriority.GOLD: 10.0,
    TrafficPriority.SILVER: 3.0,
    TrafficPriority.BRONZE: 1.0
}

class TrafficType:
    VOIP = "VOIP"          # High priority, low bandwidth, jitter sensitive
    DICOM = "DICOM"        # High bandwidth (X-ray images), bursty
    EMR = "EMR"            # Medium priority (Patient records), transactional
    GUEST = "GUEST"        # Low priority (Wi-Fi), noisy
    ATTACK = "DDOS"        # Malicious, high volume, low entropy
    IOT = "IOT"            # Constant low bandwidth sensors
    DNS = "DNS"            # Network infra
    HTTP = "HTTP"          # Web traffic
    NTP = "NTP"            # Time sync

# Map traffic types to priorities
TRAFFIC_PRIORITY_MAP = {
    TrafficType.VOIP: TrafficPriority.GOLD,
    TrafficType.EMR: TrafficPriority.GOLD,
    TrafficType.DICOM: TrafficPriority.SILVER,
    TrafficType.IOT: TrafficPriority.SILVER,
    TrafficType.GUEST: TrafficPriority.BRONZE,
    TrafficType.ATTACK: TrafficPriority.BRONZE,
    TrafficType.DNS: TrafficPriority.GOLD,   # Critical infra
    TrafficType.HTTP: TrafficPriority.BRONZE,# General web
    TrafficType.NTP: TrafficPriority.GOLD,   # Critical infra
}

# ============================================================================
# DEVICE REGISTRY - Real-world network identifiers for realistic logging
# Private SD-WAN uses RFC 1918 private IP ranges (10.x.x.x)
# ============================================================================
DEVICE_REGISTRY = {
    "Server Room": {"ip": "10.0.0.1", "mac": "00:1A:2B:3C:4D:01", "hostname": "srv-dc-01", "vlan": 100},
    "ICU-A": {"ip": "10.0.1.10", "mac": "00:1A:2B:3C:4D:10", "hostname": "icu-a-gw", "vlan": 110},
    "ICU-B": {"ip": "10.0.1.20", "mac": "00:1A:2B:3C:4D:20", "hostname": "icu-b-gw", "vlan": 110},
    "OT-1": {"ip": "10.0.1.30", "mac": "00:1A:2B:3C:4D:30", "hostname": "ot-surgical-01", "vlan": 115},
    "Radiology": {"ip": "10.0.2.10", "mac": "00:1A:2B:3C:4D:40", "hostname": "rad-pacs-gw", "vlan": 120},
    "Lab": {"ip": "10.0.2.20", "mac": "00:1A:2B:3C:4D:50", "hostname": "lab-lis-gw", "vlan": 125},
    "Admin": {"ip": "10.0.3.10", "mac": "00:1A:2B:3C:4D:60", "hostname": "admin-sw-01", "vlan": 130},
    "Wards": {"ip": "10.0.3.20", "mac": "00:1A:2B:3C:4D:70", "hostname": "ward-sw-01", "vlan": 135},
    "Public-Wifi": {"ip": "10.0.3.50", "mac": "00:1A:2B:3C:4D:80", "hostname": "guest-wifi-ap", "vlan": 199},
}

# Internal threat scenarios for private SD-WAN
THREAT_TYPES = {
    "COMPROMISED_IOT": "Compromised IoT",
    "LATERAL_MOVEMENT": "Lateral Movement",
    "INSIDER_THREAT": "Insider Threat",
    "DATA_EXFIL": "Data Exfiltration",
}

# Simulated compromised IoT devices (internal threat sources)
COMPROMISED_IOT_DEVICES = [
    {"ip": "10.0.1.45", "hostname": "icu-infusion-pump-03", "type": "Infusion Pump"},
    {"ip": "10.0.1.46", "hostname": "icu-patient-monitor-07", "type": "Patient Monitor"},
    {"ip": "10.0.2.33", "hostname": "lab-analyzer-02", "type": "Blood Analyzer"},
    {"ip": "10.0.3.88", "hostname": "ward-bedside-terminal-12", "type": "Bedside Terminal"},
    {"ip": "10.0.3.52", "hostname": "guest-laptop-infected", "type": "Guest Device"},
]

def get_random_compromised_device():
    return random.choice(COMPROMISED_IOT_DEVICES)

def get_device_info(node_id):
    return DEVICE_REGISTRY.get(node_id, {"ip": "10.0.0.0", "mac": "00:00:00:00:00:00", "hostname": "unknown", "vlan": 0})


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
        
        # QoS Stats - Drops by priority class
        self.gold_drops = 0
        self.silver_drops = 0
        self.bronze_drops = 0
        self.gold_served = 0
        self.silver_served = 0
        self.bronze_served = 0
        self.buffer_occupancy = 0.0  # 0-1 percentage
        self.choke_active = False    # Choke Packet mechanism
        
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
        if dt <= 0: return
        self.last_update_time = now
        
        refill = self.capacity * dt
        self.tokens = min(self.bucket_capacity, self.tokens + refill)

        # 2. Weighted Fair Queuing with Choke Packet
        # Sort traffic by priority (Gold first)
        sorted_traffic = sorted(
            self.active_traffic,
            key=lambda t: PRIORITY_WEIGHTS.get(TRAFFIC_PRIORITY_MAP.get(t['type'], TrafficPriority.BRONZE), 1.0),
            reverse=True
        )
        
        # Calculate buffer occupancy
        total_load = sum(t['amount'] for t in self.active_traffic)
        self.buffer_occupancy = min(1.0, total_load / self.capacity) if self.capacity > 0 else 0
        
        # Choke Packet: If buffer > 70%, activate choke mode (only during heavy congestion/DDoS)
        self.choke_active = self.buffer_occupancy > 0.7
        
        served_load = 0.0
        remaining_capacity = self.capacity * dt
        
        for traffic in sorted_traffic:
            priority = TRAFFIC_PRIORITY_MAP.get(traffic['type'], TrafficPriority.BRONZE)
            amount = traffic['amount'] * dt
            
            # Choke Packet: In choke mode, drop non-Gold traffic
            if self.choke_active and priority != TrafficPriority.GOLD:
                if priority == TrafficPriority.SILVER:
                    self.silver_drops += 1
                else:
                    self.bronze_drops += 1
                continue
            
            # Serve traffic if capacity available
            if amount <= remaining_capacity:
                remaining_capacity -= amount
                served_load += traffic['amount']
                if priority == TrafficPriority.GOLD:
                    self.gold_served += 1
                elif priority == TrafficPriority.SILVER:
                    self.silver_served += 1
                else:
                    self.bronze_served += 1
            else:
                # WFQ Preemption: If Gold and no capacity, drop Bronze if any served
                if priority == TrafficPriority.GOLD and self.bronze_served > 0:
                    self.bronze_drops += 1
                    self.bronze_served -= 1
                    remaining_capacity += amount  # Reclaim
                    served_load += traffic['amount']
                    self.gold_served += 1
                else:
                    if priority == TrafficPriority.GOLD:
                        self.gold_drops += 1
                    elif priority == TrafficPriority.SILVER:
                        self.silver_drops += 1
                    else:
                        self.bronze_drops += 1
        
        # REPORTING LOGIC UPDATE: 
        # For visualization, we want to show the ATTACK magnitude (Offered Load)
        # But we also need to know what actually got through (Served Load)
        
        # current_load = Traffic attempting to enter (Offered Load)
        # This allows the "Throughput" graph to spike during DDoS
        self.current_load = total_load
        
        # Update utilization based on OFFERED load to show saturation
        # If we used served_load, utilization would drop during effective attacks
        
        self.load_history.append(self.current_load)
        self.packet_loss = 1.0 - (served_load / total_load) if total_load > 0 else 0.0


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

        # 4. Entropy Logic (Volume-Based)
        type_vol = {}
        total_vol = sum(t['amount'] for t in self.active_traffic)
        
        if total_vol > 0:
            for t in self.active_traffic:
                type_vol[t['type']] = type_vol.get(t['type'], 0) + t['amount']
            
            entropy_sum = 0
            for vol in type_vol.values():
                p = vol / total_vol
                if p > 0:
                    entropy_sum -= p * math.log2(p)
            
            # Normalize
            # If we have N types present, max entropy is log2(N)
            # But we want a fixed scale. Let's assume max diversity is ~6 types (log2(6)=2.58)
            # Or better, normalize by log2(types_present) so 1 type = 0 entropy always.
            
            num_types = len(type_vol)
            if num_types > 1:
                max_ent = math.log2(num_types) 
                self.entropy = min(1.0, entropy_sum / max_ent)
            else:
                self.entropy = 0.0 # Single type dominant = 0 entropy (e.g. Pure Attack)
                
                # Special Case: If load is very low (e.g. just one ping), don't flag as anomaly
                if self.buffer_occupancy < 0.1:
                    self.entropy = 1.0
        else:
            self.entropy = 1.0

    def to_dict(self):
        total_served = self.gold_served + self.silver_served + self.bronze_served
        total_drops = self.gold_drops + self.silver_drops + self.bronze_drops
        return {
            "source": self.source,
            "target": self.target,
            "capacity": round(self.capacity),
            "load": round(self.current_load, 1),
            "utilization": round((self.current_load / self.capacity) * 100, 1) if self.capacity else 0,
            "latency": round(self.ewma_rtt, 1),
            "jitter": round(self.jitter, 1),
            "packet_loss": round(self.packet_loss * 100, 1),
            "entropy": round(self.entropy, 2),
            "status": "CRITICAL" if self.packet_loss > 0.05 else ("WARNING" if self.current_load > self.capacity * 0.8 else "NORMAL"),
            # QoS Stats
            "qos": {
                "gold_drops": self.gold_drops,
                "silver_drops": self.silver_drops,
                "bronze_drops": self.bronze_drops,
                "gold_served": self.gold_served,
                "silver_served": self.silver_served,
                "bronze_served": self.bronze_served,
                "buffer_occupancy": round(self.buffer_occupancy * 100, 1),
                "choke_active": self.choke_active,
                "gold_loss_pct": round((self.gold_drops / max(1, self.gold_served + self.gold_drops)) * 100, 1),
                "bronze_loss_pct": round((self.bronze_drops / max(1, self.bronze_served + self.bronze_drops)) * 100, 1)
            }
        }

class NetworkSimulation:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.nodes = []
        self.links = {}
        self.alerts = []
        self.running = False
        self.traffic_mode = 'NORMAL'  # NORMAL, CONGESTED, DDOS
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

        # CLEAR PREVIOUS TRAFFIC
        for link in self.links.values():
            link.active_traffic = []

        # Initialize base variables
        jitter = random.uniform(0.9, 1.1)
        
        # 1. TRAFFIC GENERATION
        if self.traffic_mode == 'NORMAL':
            # Normal: Low load, High Entropy (Balanced types)
            multiplier = 0.5 * jitter
            for link in self.links.values():
                link.active_traffic.append({"type": TrafficType.IOT, "amount": random.uniform(5, 10)})
                link.active_traffic.append({"type": TrafficType.DNS, "amount": random.uniform(5, 10)})
                link.active_traffic.append({"type": TrafficType.HTTP, "amount": random.uniform(5, 15)})
                if random.random() > 0.5:
                     link.active_traffic.append({"type": TrafficType.NTP, "amount": random.uniform(5, 10)})

        elif self.traffic_mode == 'CONGESTED':
            # Congestion: High Load, High Entropy (All types scaled up)
            # Differentiate from DDoS by keeping diversity high
            # REDUCED SCALE FURTHER (was 1.8-2.5)
            global_congestion_factor = random.uniform(1.2, 1.8) * jitter
            
            for link in self.links.values():
                # Scale EVERYTHING up
                link.active_traffic.append({"type": TrafficType.IOT, "amount": random.uniform(15, 25) * global_congestion_factor})
                link.active_traffic.append({"type": TrafficType.DNS, "amount": random.uniform(15, 25) * global_congestion_factor})
                link.active_traffic.append({"type": TrafficType.HTTP, "amount": random.uniform(30, 60) * global_congestion_factor})
                # Add heavy legitimate traffic (DICOM/Video) but distributed
                link.active_traffic.append({"type": TrafficType.DICOM, "amount": random.uniform(60, 150) * global_congestion_factor})
                link.active_traffic.append({"type": TrafficType.VOIP, "amount": random.uniform(30, 60) * global_congestion_factor})

            # Bottleneck Simulation: Pick random links to be super-congested
            bottlenecks = random.sample(list(self.links.values()), k=min(len(self.links), 4))
            for link in bottlenecks:
                 # Massive surge on these specific links
                 link.active_traffic.append({"type": TrafficType.EMR, "amount": random.uniform(300, 600)})

        else:  # DDOS
            # DDoS: High Load, Low Entropy (Single dominant attack type)
            # Background traffic remains NORMAL (don't suppress it, let it be dropped by queue)
            multiplier = 0.5 * jitter 
            for link in self.links.values():
                link.active_traffic.append({"type": TrafficType.IOT, "amount": random.uniform(5, 10)})
                link.active_traffic.append({"type": TrafficType.DNS, "amount": random.uniform(5, 10)})
                link.active_traffic.append({"type": TrafficType.HTTP, "amount": random.uniform(5, 15)})
                
                # REFLECTION ATTACK: Mild attack traffic on ALL links to boost global load
                link.active_traffic.append({"type": TrafficType.ATTACK, "amount": random.uniform(100, 300)})

        # 2. Random Mesh Traffic (Make sure packets travel through all nodes)
        if random.random() > 0.4: 
            source = random.choice(self.nodes)['id']
            target = random.choice(self.nodes)['id']
            if source != target:
                try:
                    path = nx.shortest_path(self.graph, source, target)
                    amount = random.uniform(20, 60) * jitter
                    if self.traffic_mode == 'CONGESTED':
                        amount *= 2.0 # Mesh traffic
                    
                    for i in range(len(path)-1):
                        u, v = path[i], path[i+1]
                        if (u,v) in self.links:
                            self.links[(u,v)].active_traffic.append({"type": TrafficType.HTTP, "amount": amount})
                except:
                    pass

        # 3. DDoS ATTACK LOGIC - Multi-vector Attack
        if self.traffic_mode == 'DDOS':
            # Target: Server Room
            # Sources: Public-Wifi, Guest networks, Compromised IoT in Lab/Wards
            attack_sources = ["Public-Wifi", "Lab", "Wards", "OT-1"]
            target = "Server Room"
            
            for source in attack_sources:
                try:
                    path = nx.shortest_path(self.graph, source, target)
                    for i in range(len(path)-1):
                        u, v = path[i], path[i+1]
                        if (u,v) in self.links:
                            # Massive attack traffic - overwhelm capacity
                            # BOOSTED: 3500-6000 (was 3000-5000)
                            attack_amount = random.uniform(3500, 6000)
                            self.links[(u,v)].active_traffic.append({"type": TrafficType.ATTACK, "amount": attack_amount})
                except:
                    continue

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
            # Only run anomaly detection if NOT in Normal mode (Normal has intended fluctuations)
            if self.traffic_mode != 'NORMAL' and len(link.load_history) > 10:
                avg_load = sum(link.load_history) / len(link.load_history)
                # std_dev calc
                variance = sum((x - avg_load) ** 2 for x in link.load_history) / len(link.load_history)
                std_dev = math.sqrt(variance)
                
                if std_dev > 0:
                    z_score = (link.current_load - avg_load) / std_dev
                    if z_score > 3.0: # 3 Sigma Rule
                        self.add_alert(f"Anomaly (Z-Score {z_score:.1f}) on {link.source}->{link.target}", "WARNING")

            # Check CSS threshold - Suppress critical alerts in Normal mode
            if css > 4.0 and self.traffic_mode != 'NORMAL':
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
        
        # WEIGHTED ENTROPY: Prioritize entropy of links under heavy load
        # If simulation has no load, default to 1.0
        if total_load > 0:
            weighted_entropy_sum = sum(l.entropy * l.current_load for l in self.links.values())
            avg_entropy = weighted_entropy_sum / total_load
            # DEBUG LOG
            print(f"[DEBUG] Mode: {self.traffic_mode} | Total Load: {total_load:.1f} | Weighted Entropy: {avg_entropy:.4f}", flush=True)
        else:
            avg_entropy = 1.0
        
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
