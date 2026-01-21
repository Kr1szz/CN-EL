
document.addEventListener('DOMContentLoaded', () => {

    // === 1. TOPOLOGY VISUALIZATION (Fixed "Floor Plan" Layout) ===

    // Define fixed positions for a "Building Like" layout
    const nodePositions = {
        "Main Server (Data Center)": { x: 300, y: 100 },
        "Admin Block": { x: 100, y: 300 },
        "Public Wi-Fi": { x: 100, y: 500 },
        "Radiology": { x: 500, y: 300 },
        "Emergency Dept": { x: 300, y: 400 },
        "ICU": { x: 500, y: 500 }
    };

    const cy = cytoscape({
        container: document.getElementById('cy-container'),
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#fff',
                    'border-width': 2,
                    'border-color': '#007bff',
                    'label': 'data(label)',
                    'color': '#333',
                    'font-size': '12px',
                    'font-weight': 'bold',
                    'text-valign': 'top',
                    'text-margin-y': -10,
                    'width': 60,
                    'height': 60,
                    'shape': 'round-rectangle',
                    'text-wrap': 'wrap'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#ced4da',
                    'target-arrow-color': '#ced4da',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'label': 'data(active_load)',
                    'color': '#666',
                    'font-size': '10px',
                    'text-background-opacity': 1,
                    'text-background-color': '#fff',
                    'text-background-padding': '3px',
                    'text-background-shape': 'roundrectangle'
                }
            },
            // Congestion States
            {
                selector: '.congested',
                style: {
                    'line-color': '#ffc107',
                    'target-arrow-color': '#ffc107',
                    'width': 4
                }
            },
            {
                selector: '.critical',
                style: {
                    'line-color': '#dc3545',
                    'target-arrow-color': '#dc3545',
                    'width': 4
                }
            }
        ],
        layout: { name: 'preset' } // Using manual positions
    });

    // === 2. REAL-TIME CHARTS (Chart.js) ===
    const ctx = document.getElementById('latencyChart').getContext('2d');
    const latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Latency (ms)',
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                data: [],
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [5, 5] }
                }
            },
            plugins: {
                legend: { display: false }
            },
            animation: false
        }
    });

    // === 3. STATE MANAGEMENT ===
    let nodeMap = new Set();

    function updateTopology(nodes, links) {
        // Add new nodes
        nodes.forEach(n => {
            if (!nodeMap.has(n.id)) {
                // Determine icon based on name (mock logic)
                cy.add({
                    group: 'nodes',
                    data: { id: n.id, label: n.label.replace(" ", "\n") }, // Wrap text
                    position: nodePositions[n.id] || { x: 0, y: 0 }
                });
                nodeMap.add(n.id);
            }
        });

        // Update Links
        links.forEach(l => {
            const edgeId = `${l.source}->${l.target}`;
            const utilPercent = Math.round((l.load / l.capacity) * 100);

            let edge = cy.getElementById(edgeId);
            if (edge.length === 0) {
                cy.add({
                    group: 'edges',
                    data: {
                        id: edgeId,
                        source: l.source,
                        target: l.target,
                        active_load: utilPercent > 10 ? `${utilPercent}%` : ''
                    }
                });
            } else {
                edge.data('active_load', utilPercent > 5 ? `${utilPercent}%` : '');

                // Visual feedback for congestion
                edge.removeClass('congested critical');
                if (l.packet_loss > 0.05) edge.addClass('critical');
                else if (utilPercent > 80) edge.addClass('congested');
            }
        });
    }

    function updateStats(state) {
        // Charts
        const now = new Date().toLocaleTimeString();
        if (latencyChart.data.labels.length > 30) {
            latencyChart.data.labels.shift();
            latencyChart.data.datasets[0].data.shift();
        }

        // Compute avg latency
        const totalLatency = state.links.reduce((acc, l) => acc + l.latency, 0);
        const avgLatency = state.links.length ? (totalLatency / state.links.length).toFixed(1) : 0;

        latencyChart.data.labels.push(now);
        latencyChart.data.datasets[0].data.push(avgLatency);
        latencyChart.update();

        document.getElementById('avg-latency').innerText = `${avgLatency} ms`;

        // Packet Loss
        const maxLoss = state.links.length ? Math.max(...state.links.map(l => l.packet_loss)) : 0;
        document.getElementById('avg-loss').innerText = `${(maxLoss * 100).toFixed(1)} %`;

        // Logs
        const logContainer = document.getElementById('event-log');
        logContainer.innerHTML = '';
        state.alerts.forEach(alert => {
            const li = document.createElement('li');
            li.className = alert.level;
            li.innerHTML = `<span class="time">${alert.time}</span> ${alert.msg}`;
            logContainer.prepend(li);
        });
    }

    // === 5. ALERT SYSTEM ===
    const alertModal = document.getElementById('alert-modal');
    const btnDispatch = document.getElementById('btn-dispatch');
    const btnIgnore = document.getElementById('btn-ignore');
    let alertActive = false;

    // Check for critical conditions
    function checkAlertConditions(state) {
        if (alertActive) return; // Don't spam

        // Trigger if any link has > 5% packet loss
        const criticalLink = state.links.find(l => l.packet_loss > 0.05);
        if (criticalLink) {
            // showAlert(); // Disabled as per user request
        }
    }

    function showAlert() {
        alertActive = true;
        alertModal.classList.remove('hidden');
    }

    function hideAlert() {
        alertModal.classList.add('hidden');
        // Prevent immediate re-trigger
        setTimeout(() => { alertActive = false; }, 5000);
    }

    btnDispatch.addEventListener('click', () => {
        // Simulate sending to team
        btnDispatch.innerHTML = '<i class="fa-solid fa-circle-check"></i> TEAM NOTIFIED';
        btnDispatch.classList.remove('pulse-animation');
        btnDispatch.style.background = '#28a745';

        setTimeout(() => {
            hideAlert();
            // Reset button for next time
            setTimeout(() => {
                btnDispatch.innerHTML = '<i class="fa-solid fa-user-shield"></i> DISPATCH AVOIDANCE TEAM';
                btnDispatch.style.background = '';
                btnDispatch.classList.add('pulse-animation');
            }, 1000);
        }, 1500);
    });

    btnIgnore.addEventListener('click', hideAlert);

    async function fetchState() {
        try {
            const res = await fetch('/api/state');
            const data = await res.json();
            updateTopology(data.nodes, data.links);
            updateStats(data);
            checkAlertConditions(data); // Check for alerts
        } catch (e) {
            console.error("Fetch error", e);
        }
    }

    // === 4. CONTROLS ===
    async function sendControl(action) {
        await fetch('/api/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
    }

    async function sendTrigger(event) {
        await fetch('/api/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event })
        });
    }

    document.getElementById('btn-start').addEventListener('click', () => sendControl('start'));
    document.getElementById('btn-stop').addEventListener('click', () => sendControl('stop'));
    document.getElementById('btn-reset').addEventListener('click', () => sendControl('reset'));
    document.getElementById('btn-ddos').addEventListener('click', () => sendTrigger('ddos'));

    // Start polling
    setInterval(fetchState, 1000);
});
