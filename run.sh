#!/usr/bin/env bash
# ==========================================================
# CourtBook Pro - Easy Start Script
# ==========================================================
set -e

# Change to the script's directory
cd "$(dirname "$0")"

echo "🏸 Starting Sports Court Booking Platform..."

# 1. Detect Python
if command -v python3 &>/dev/null; then
    PYTHON_CMD=python3
elif command -v python &>/dev/null; then
    PYTHON_CMD=python
else
    echo "❌ Error: Python is not installed or not in PATH."
    exit 1
fi

# 2. Check / Create Virtual Environment
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment (.venv)..."
    $PYTHON_CMD -m venv .venv
fi

# 3. Activate Virtual Environment
source .venv/bin/activate

# 4. Install / Update Dependencies
echo "🔄 Verifying dependencies..."
pip install -q -r requirements.txt

# 5. Initialize & Seed Database if needed
echo "🗄️ Initializing database..."
python cli.py init-db
python cli.py seed-data

echo "=========================================================="
echo "🚀 Application is ready!"
echo "👉 Web URL:        http://127.0.0.1:5002"
echo "👤 Default Admin:  admin / Admin@123456"
echo "=========================================================="

# 6. Start the Application Server
exec python app.py
