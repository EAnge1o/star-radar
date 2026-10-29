@echo off
REM StarRadar 一键启动(Windows)
cd /d "%~dp0backend"
if not exist .venv (
  echo [StarRadar] 首次运行,创建虚拟环境...
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install -q -r requirements.txt
)
echo [StarRadar] 启动服务: http://127.0.0.1:8000
.venv\Scripts\python.exe -m app.main
