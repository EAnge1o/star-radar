#!/usr/bin/env bash
# StarRadar 一键启动(macOS / Linux)
cd "$(dirname "$0")/backend"
if [ ! -d .venv ]; then
  echo "[StarRadar] 首次运行,创建虚拟环境..."
  python3 -m venv .venv
  ./.venv/bin/python -m pip install -q -r requirements.txt
fi
echo "[StarRadar] 启动服务: http://127.0.0.1:8000"
./.venv/bin/python -m app.main
