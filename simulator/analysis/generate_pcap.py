import sys
import os
import time
import random

# Add parent directory to path to import simulation logic if needed
# But for Scapy we can just replicate the logic to generate packets
try:
    from scapy.all import *
except ImportError:
    print("Error: Scapy not installed. Please run: pip install scapy")
    sys.exit(1)

# Configuration
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

def generate_pcap(mode, filename, packet_count=1000):
    print(f"Generating {mode} traffic capture ({packet_count} packets)...")
    packets = []
    
    # IP Addresses
    IP_SRC_IOT = "192.168.1.50"
    IP_SRC_GUEST = "10.0.0.15"
    IP_SRC_ATTACKER = "203.0.113.66" # External IP
    IP_DST_SERVER = "192.168.0.10" # Data Center
    IP_DST_EHR = "192.168.0.20"
    
    start_time = time.time()
    
    for i in range(packet_count):
        # Base Time (incremental)
        pkt_time = start_time + (i * 0.001) 
        
        # 1. NORMAL TRAFFIC PATTERN
        if mode == "NORMAL":
            # Balanced mix
            r = random.random()
            if r < 0.4: # IoT Heartbeat (Small UDP)
                p = IP(src=IP_SRC_IOT, dst=IP_DST_SERVER)/UDP(dport=8080)/Raw(load="cnt=123&temp=36.5")
            elif r < 0.7: # HTTP (TCP)
                p = IP(src=IP_SRC_GUEST, dst=IP_DST_SERVER)/TCP(dport=80, flags="PA")/Raw(load="GET /index.html HTTP/1.1\r\n\r\n")
            else: # DNS (UDP)
                p = IP(src=IP_SRC_GUEST, dst="8.8.8.8")/UDP(dport=53)/DNS(rd=1, qd=DNSQR(qname="hospital-portal.local"))
                
        # 2. CONGESTION PATTERN
        elif mode == "CONGESTED":
            # High Volume Legitimate Traffic (Video/Imaging)
            # Lots of big packets, diverse sources
            r = random.random()
            if r < 0.6: # DICOM Image Transfer (Heavy TCP)
                p = IP(src="192.168.2.50", dst="192.168.2.60")/TCP(dport=104, flags="PA")/Raw(load="X"*1400) # Max MTU
            elif r < 0.8: # VoIP (UDP)
                p = IP(src="192.168.1.100", dst="192.168.1.200")/UDP(dport=5060)/Raw(load="\x80\x00\x00\x00"*40)
            else: # Background noise
                p = IP(src=IP_SRC_GUEST, dst="8.8.8.8")/UDP(dport=53)/DNS(rd=1, qd=DNSQR(qname="google.com"))

        # 3. DDoS PATTERN
        elif mode == "DDOS":
            # Syn Flood / UDP Flood (Low Entropy)
            # Same source or spoofed sources, same destination, same payload
            r = random.random()
            if r < 0.95: # 95% ATTACK TRAFFIC
                # Randomize Source slightly to simulate botnet but keep structure identical
                src_ip = f"203.0.113.{random.randint(1, 200)}"
                # SYN Flood
                p = IP(src=src_ip, dst=IP_DST_SERVER)/TCP(dport=80, flags="S") 
            else: # 5% Background traffic trying to survive
                p = IP(src=IP_SRC_IOT, dst=IP_DST_SERVER)/UDP(dport=8080)/Raw(load="heartbeat")

        p.time = pkt_time
        packets.append(p)

    output_path = os.path.join(OUTPUT_DIR, filename)
    wrpcap(output_path, packets)
    print(f"saved to {output_path}")

if __name__ == "__main__":
    generate_pcap("NORMAL", "capture_normal.pcap", 1000)
    generate_pcap("CONGESTED", "capture_congested.pcap", 2000)
    generate_pcap("DDOS", "capture_ddos.pcap", 5000)
    print("\nPCAP Generation Complete. You can open these files in Wireshark.")
