
import { v4 as uuidv4 } from 'uuid';

export const TrafficPriority = {
    GOLD: "GOLD",       // Mission-critical
    SILVER: "SILVER",   // Important
    BRONZE: "BRONZE"    // Low priority
};

export const TrafficType = {
    VOIP: "VOIP",
    DICOM: "DICOM",
    EMR: "EMR",
    GUEST: "GUEST",
    ATTACK: "DDOS",
    IOT: "IOT",
    DNS: "DNS",
    HTTP: "HTTP",
    NTP: "NTP"
};

const TRAFFIC_PRIORITY_MAP = {
    [TrafficType.VOIP]: TrafficPriority.GOLD,
    [TrafficType.EMR]: TrafficPriority.GOLD,
    [TrafficType.DICOM]: TrafficPriority.SILVER,
    [TrafficType.IOT]: TrafficPriority.SILVER,
    [TrafficType.GUEST]: TrafficPriority.BRONZE,
    [TrafficType.ATTACK]: TrafficPriority.BRONZE,
    [TrafficType.DNS]: TrafficPriority.GOLD,
    [TrafficType.HTTP]: TrafficPriority.BRONZE,
    [TrafficType.NTP]: TrafficPriority.GOLD
};

const PRIORITY_WEIGHTS = {
    [TrafficPriority.GOLD]: 10.0,
    [TrafficPriority.SILVER]: 3.0,
    [TrafficPriority.BRONZE]: 1.0
};

class Link {
    constructor(source, target, capacityMbps, baseLatencyMs) {
        this.source = source;
        this.target = target;
        this.capacity = capacityMbps;
        this.baseLatency = baseLatencyMs;

        // Real-time state
        this.currentLoad = 0.0;
        this.packetLoss = 0.0;
        this.jitter = 0.0;
        this.activeTraffic = [];

        // QoS Stats
        this.goldDrops = 0;
        this.silverDrops = 0;
        this.bronzeDrops = 0;
        this.goldServed = 0;
        this.silverServed = 0;
        this.bronzeServed = 0;
        this.bufferOccupancy = 0.0;
        this.chokeActive = false;

        // EWMA for Latency
        this.ewmaAlpha = 0.125;
        this.ewmaRtt = baseLatencyMs;
        this.currentRtt = baseLatencyMs;

        // Token Bucket
        this.bucketCapacity = capacityMbps * 0.5;
        this.tokens = this.bucketCapacity;
        this.lastUpdateTime = Date.now() / 1000;

        // Entropy
        this.entropy = 1.0;

        // Metrics History
        this.loadHistory = []; // Limit to 50
    }

    update() {
        // 1. Token Bucket Refill
        const now = Date.now() / 1000;
        const dt = now - this.lastUpdateTime;
        if (dt <= 0) return;
        this.lastUpdateTime = now;

        const refill = this.capacity * dt;
        this.tokens = Math.min(this.bucketCapacity, this.tokens + refill);

        // 2. Weighted Fair Queuing
        // Sort traffic by priority
        const getWeight = (t) => PRIORITY_WEIGHTS[TRAFFIC_PRIORITY_MAP[t.type] || TrafficPriority.BRONZE];

        // Clone and sort active traffic to process
        const sortedTraffic = [...this.activeTraffic].sort((a, b) => getWeight(b) - getWeight(a));

        const totalLoad = this.activeTraffic.reduce((sum, t) => sum + t.amount, 0);
        this.bufferOccupancy = this.capacity > 0 ? Math.min(1.0, totalLoad / this.capacity) : 0;

        this.chokeActive = this.bufferOccupancy > 0.7;

        let servedLoad = 0.0;
        let remainingCapacity = this.capacity * dt; // Capacity available for this time slice

        // NOTE: In the Python version, logic was a bit simplified for simulation.
        // We will mimic the exact logic flow.

        // Reset counters for this tick? No, they are cumulative stats in the Python version mostly, 
        // but for a dashboard usually you want rate or cumulative. Python code accumulated drops.
        // Let's keep accumulation but maybe we need a way to show rate. 
        // Python: `self.gold_drops += 1`

        // Wait, Python sim loop runs at 20Hz (sleep 0.05).

        // Temporary holding for logic
        let tempGoldServed = 0;
        let tempSilverServed = 0;
        let tempBronzeServed = 0;

        // We need to properly manage state. 
        // For visual consistency, let's keep the logic close.

        for (const traffic of sortedTraffic) {
            const priority = TRAFFIC_PRIORITY_MAP[traffic.type] || TrafficPriority.BRONZE;
            const amount = traffic.amount * dt; // Load in this time slice

            if (this.chokeActive && priority !== TrafficPriority.GOLD) {
                if (priority === TrafficPriority.SILVER) this.silverDrops++;
                else this.bronzeDrops++;
                continue;
            }

            if (amount <= remainingCapacity) {
                remainingCapacity -= amount;
                servedLoad += traffic.amount; // Add rate back to servedLoad
                if (priority === TrafficPriority.GOLD) this.goldServed++;
                else if (priority === TrafficPriority.SILVER) this.silverServed++;
                else this.bronzeServed++;
            } else {
                // Preemption Logic
                if (priority === TrafficPriority.GOLD && this.bronzeServed > 0) {
                    this.bronzeDrops++;
                    this.bronzeServed--;
                    remainingCapacity += amount; // Simplified assumption from Python code
                    servedLoad += traffic.amount;
                    this.goldServed++;
                } else {
                    if (priority === TrafficPriority.GOLD) this.goldDrops++;
                    else if (priority === TrafficPriority.SILVER) this.silverDrops++;
                    else this.bronzeDrops++;
                }
            }
        }

        this.currentLoad = totalLoad;

        // History
        this.loadHistory.push(this.currentLoad);
        if (this.loadHistory.length > 50) this.loadHistory.shift();

        this.packetLoss = totalLoad > 0 ? 1.0 - (servedLoad / totalLoad) : 0.0;
        if (this.packetLoss < 0) this.packetLoss = 0;

        // 3. Congestion & Latency
        const utilization = this.capacity > 0 ? servedLoad / this.capacity : 0;
        let instantRtt = this.baseLatency;

        if (utilization > 0.6) {
            const queueFactor = (utilization - 0.6) * 15;
            instantRtt = this.baseLatency * (1 + queueFactor);
        }

        // Jitter
        this.jitter = (utilization < 0.8) ? (Math.random() * 2) : (5 + Math.random() * 20);
        instantRtt += this.jitter;

        this.ewmaRtt = (1 - this.ewmaAlpha) * this.ewmaRtt + (this.ewmaAlpha * instantRtt);
        this.currentRtt = instantRtt;

        // 4. Entropy
        const typeVol = {};
        if (totalLoad > 0) {
            for (const t of this.activeTraffic) {
                typeVol[t.type] = (typeVol[t.type] || 0) + t.amount;
            }

            let entropySum = 0;
            for (const vol of Object.values(typeVol)) {
                const p = vol / totalLoad;
                if (p > 0) entropySum -= p * Math.log2(p);
            }

            const numTypes = Object.keys(typeVol).length;
            if (numTypes > 1) {
                const maxEnt = Math.log2(numTypes);
                this.entropy = Math.min(1.0, entropySum / maxEnt);
            } else {
                this.entropy = 0.0;
                if (this.bufferOccupancy < 0.1) this.entropy = 1.0; // Low load exception
            }
        } else {
            this.entropy = 1.0;
        }
    }

    toDict() {
        const totalServed = this.goldServed + this.silverServed + this.bronzeServed;
        const totalDrops = this.goldDrops + this.silverDrops + this.bronzeDrops;

        // Helper to avoid divide by zero
        const safeDiv = (a, b) => b === 0 ? 0 : (a / b) * 100;

        return {
            source: this.source,
            target: this.target,
            capacity: Math.round(this.capacity),
            load: parseFloat(this.currentLoad.toFixed(1)),
            utilization: this.capacity ? parseFloat(((this.currentLoad / this.capacity) * 100).toFixed(1)) : 0,
            latency: parseFloat(this.ewmaRtt.toFixed(1)),
            jitter: parseFloat(this.jitter.toFixed(1)),
            packet_loss: parseFloat((this.packetLoss * 100).toFixed(1)),
            entropy: parseFloat(this.entropy.toFixed(2)),
            status: this.packetLoss > 0.05 ? "CRITICAL" : (this.currentLoad > this.capacity * 0.8 ? "WARNING" : "NORMAL"),
            qos: {
                gold_drops: this.goldDrops,
                silver_drops: this.silverDrops,
                bronze_drops: this.bronzeDrops,
                gold_served: this.goldServed,
                silver_served: this.silverServed,
                bronze_served: this.bronzeServed,
                buffer_occupancy: parseFloat((this.bufferOccupancy * 100).toFixed(1)),
                choke_active: this.chokeActive,
                gold_loss_pct: parseFloat(safeDiv(this.goldDrops, this.goldServed + this.goldDrops).toFixed(1)),
                bronze_loss_pct: parseFloat(safeDiv(this.bronzeDrops, this.bronzeServed + this.bronzeDrops).toFixed(1))
            }
        };
    }
}

export class NetworkSimulation {
    constructor() {
        this.nodes = [];
        this.links = {}; // Key: "source-target"
        this.graph = {}; // Adjacency list: { u: [v1, v2] }
        this.alerts = [];
        this.running = false;
        this.trafficMode = 'NORMAL';
        this.setupNetworkFloors();
    }

    setupNetworkFloors() {
        this.nodes = [
            { id: "Server Room", label: "Main Data Center", floor: 0, type: "server", pos: { x: 500, y: 500 } },
            { id: "ICU-A", label: "ICU Unit A", floor: 1, type: "critical", pos: { x: 300, y: 300 } },
            { id: "ICU-B", label: "ICU Unit B", floor: 1, type: "critical", pos: { x: 700, y: 300 } },
            { id: "OT-1", label: "Operation Theater", floor: 1, type: "critical", pos: { x: 500, y: 200 } },
            { id: "Radiology", label: "Radiology Dept", floor: 2, type: "high_bandwidth", pos: { x: 400, y: 400 } },
            { id: "Lab", label: "Pathology Lab", floor: 2, type: "staff", pos: { x: 600, y: 400 } },
            { id: "Admin", label: "Admin Block", floor: 3, type: "staff", pos: { x: 200, y: 500 } },
            { id: "Wards", label: "Patient Wards", floor: 3, type: "general", pos: { x: 500, y: 600 } },
            { id: "Public-Wifi", label: "Guest Wi-Fi", floor: 3, type: "guest", pos: { x: 800, y: 500 } },
        ];

        this.addLink("Server Room", "ICU-A", 2000, 1);
        this.addLink("Server Room", "ICU-B", 2000, 1);
        this.addLink("Server Room", "Radiology", 5000, 2);
        this.addLink("Server Room", "Admin", 1000, 3);

        this.addLink("ICU-A", "OT-1", 1000, 1);
        this.addLink("Radiology", "ICU-A", 1000, 2);
        this.addLink("Radiology", "Lab", 800, 2);
        this.addLink("Lab", "Server Room", 600, 3);
        this.addLink("Admin", "Public-Wifi", 500, 5);
        this.addLink("Admin", "Wards", 500, 3);
    }

    addLink(u, v, cap, lat) {
        // Bi-directional
        const l1 = new Link(u, v, cap, lat);
        const l2 = new Link(v, u, cap, lat);
        this.links[`${u}-${v}`] = l1;
        this.links[`${v}-${u}`] = l2;

        if (!this.graph[u]) this.graph[u] = [];
        if (!this.graph[v]) this.graph[v] = [];
        this.graph[u].push(v);
        this.graph[v].push(u);
    }

    // BFS Shortest Path
    shortestPath(start, end) {
        const queue = [[start]];
        const visited = new Set();
        visited.add(start);

        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];

            if (node === end) return path;

            const neighbors = this.graph[node] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    const newPath = [...path, neighbor];
                    queue.push(newPath);
                }
            }
        }
        return null;
    }

    generateTraffic() {
        if (!this.running) return;

        // Clear previous
        Object.values(this.links).forEach(l => l.activeTraffic = []);

        const jitter = 0.9 + Math.random() * 0.2;

        // 1. Base Traffic
        if (this.trafficMode === 'NORMAL') {
            Object.values(this.links).forEach(link => {
                link.activeTraffic.push({ type: TrafficType.IOT, amount: 5 + Math.random() * 5 });
                link.activeTraffic.push({ type: TrafficType.DNS, amount: 5 + Math.random() * 5 });
                link.activeTraffic.push({ type: TrafficType.HTTP, amount: 5 + Math.random() * 10 });
                if (Math.random() > 0.5) link.activeTraffic.push({ type: TrafficType.NTP, amount: 5 + Math.random() * 5 });
            });
        } else if (this.trafficMode === 'CONGESTED') {
            const globalFactor = (1.2 + Math.random() * 0.6) * jitter;

            Object.values(this.links).forEach(link => {
                link.activeTraffic.push({ type: TrafficType.IOT, amount: (15 + Math.random() * 10) * globalFactor });
                link.activeTraffic.push({ type: TrafficType.DNS, amount: (15 + Math.random() * 10) * globalFactor });
                link.activeTraffic.push({ type: TrafficType.HTTP, amount: (30 + Math.random() * 30) * globalFactor });
                link.activeTraffic.push({ type: TrafficType.DICOM, amount: (60 + Math.random() * 90) * globalFactor });
                link.activeTraffic.push({ type: TrafficType.VOIP, amount: (30 + Math.random() * 30) * globalFactor });
            });

            // Bottlenecks
            const allLinks = Object.values(this.links);
            const bottlenecks = [];
            for (let i = 0; i < 4; i++) bottlenecks.push(allLinks[Math.floor(Math.random() * allLinks.length)]);

            bottlenecks.forEach(link => {
                link.activeTraffic.push({ type: TrafficType.EMR, amount: 300 + Math.random() * 300 });
            });

        } else { // DDOS
            Object.values(this.links).forEach(link => {
                link.activeTraffic.push({ type: TrafficType.IOT, amount: 5 + Math.random() * 5 });
                link.activeTraffic.push({ type: TrafficType.DNS, amount: 5 + Math.random() * 5 });
                link.activeTraffic.push({ type: TrafficType.HTTP, amount: 5 + Math.random() * 10 });
                // Reflection logic
                link.activeTraffic.push({ type: TrafficType.ATTACK, amount: 100 + Math.random() * 200 });
            });
        }

        // 2. Random Mesh
        if (Math.random() > 0.4) {
            const u = this.nodes[Math.floor(Math.random() * this.nodes.length)].id;
            const v = this.nodes[Math.floor(Math.random() * this.nodes.length)].id;
            if (u !== v) {
                const path = this.shortestPath(u, v);
                if (path) {
                    let amount = (20 + Math.random() * 40) * jitter;
                    if (this.trafficMode === 'CONGESTED') amount *= 2.0;

                    for (let i = 0; i < path.length - 1; i++) {
                        const link = this.links[`${path[i]}-${path[i + 1]}`];
                        if (link) link.activeTraffic.push({ type: TrafficType.HTTP, amount: amount });
                    }
                }
            }
        }

        // 3. DDoS Attack Vector
        if (this.trafficMode === 'DDOS') {
            const attackSources = ["Public-Wifi", "Lab", "Wards", "OT-1"];
            const target = "Server Room";

            attackSources.forEach(source => {
                const path = this.shortestPath(source, target);
                if (path) {
                    for (let i = 0; i < path.length - 1; i++) {
                        const link = this.links[`${path[i]}-${path[i + 1]}`];
                        if (link) {
                            const attackAmount = 3500 + Math.random() * 2500;
                            link.activeTraffic.push({ type: TrafficType.ATTACK, amount: attackAmount });
                        }
                    }
                }
            });
        }
    }

    addAlert(msg, level) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

        // Dedup
        if (this.alerts.length > 0) {
            const last = this.alerts[this.alerts.length - 1];
            if (last.msg === msg && last.time === timeStr) return;
        }

        this.alerts.push({ time: timeStr, msg, level });
        if (this.alerts.length > 50) this.alerts = this.alerts.slice(-50);
    }

    update() {
        if (!this.running) return;

        this.generateTraffic();

        Object.values(this.links).forEach(link => {
            link.update();

            // CSS
            const delayFactor = Math.min(3.0, link.ewmaRtt / link.baseLatency);
            const lossFactor = link.packetLoss * 10;
            const entropyFactor = 1.0 - link.entropy;

            const css = (delayFactor * 0.5) + (lossFactor * 20.0) + (entropyFactor * 2.0);

            // Z-Score Algo
            if (this.trafficMode !== 'NORMAL' && link.loadHistory.length > 10) {
                const avg = link.loadHistory.reduce((a, b) => a + b, 0) / link.loadHistory.length;
                const variance = link.loadHistory.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / link.loadHistory.length;
                const stdDev = Math.sqrt(variance);

                if (stdDev > 0) {
                    const zScore = (link.currentLoad - avg) / stdDev;
                    if (zScore > 3.0) {
                        this.addAlert(`Anomaly (Z-Score ${zScore.toFixed(1)}) on ${link.source}->${link.target}`, "WARNING");
                    }
                }
            }

            if (css > 4.0 && this.trafficMode !== 'NORMAL') {
                this.addAlert(`Critical Congestion (CSS ${css.toFixed(1)}) on ${link.source}->${link.target}`, "CRITICAL");
            }
        });
    }

    getState() {
        const totalLoad = Object.values(this.links).reduce((sum, l) => sum + l.currentLoad, 0);

        let avgEntropy = 1.0;
        if (totalLoad > 0) {
            const weightedSum = Object.values(this.links).reduce((sum, l) => sum + (l.entropy * l.currentLoad), 0);
            avgEntropy = weightedSum / totalLoad;
        }

        // Return simpler structure for frontend
        return {
            nodes: this.nodes,
            links: Object.values(this.links).map(l => l.toDict()),
            alerts: this.alerts.slice(-10),
            global_stats: {
                total_throughput_mbps: parseFloat(totalLoad.toFixed(1)),
                avg_system_entropy: parseFloat(avgEntropy.toFixed(2)),
                active_nodes: this.nodes.length
            },
            traffic_mode: this.trafficMode
        };
    }
}
