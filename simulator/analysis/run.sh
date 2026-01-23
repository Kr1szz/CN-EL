#!/bin/bash
# Wrapper to run analysis scripts using the project's virtual environment

# Get absolute path to the venv python
VENV_PYTHON="$(dirname "$(dirname "$(readlink -f "$0")")")/venv/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: Virtual environment not found at $VENV_PYTHON"
    exit 1
fi

# Run the requested script
if [ "$1" == "plot" ]; then
    "$VENV_PYTHON" "$(dirname "$0")/plot_modes.py"
elif [ "$1" == "pcap" ]; then
    "$VENV_PYTHON" "$(dirname "$0")/generate_pcap.py"
elif [ "$1" == "realtime" ]; then
    "$VENV_PYTHON" "$(dirname "$0")/realtime_plot.py"
else
    echo "Usage: ./run_analysis.sh [plot|pcap|realtime]"
    echo "  plot     : Generate static traffic analysis graphs"
    echo "  pcap     : Generate Wireshark-compatible PCAP files"
    echo "  realtime : Open live dashboard for 40s simulation"
fi
