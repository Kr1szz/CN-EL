"""
Network Simulator Analysis Package

This package contains tools for analyzing the network simulation:
- plot_modes.py: Generates time-series plots of Throughput, Entropy, and Packet Loss.
- generate_pcap.py: Uses Scapy to generate Wireshark-compatible .pcap files.
"""

from .plot_modes import run_analysis
from .generate_pcap import generate_pcap
