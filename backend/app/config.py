"""StarRadar 配置:全部可用环境变量覆盖。"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("SR_DATA_DIR", ROOT / "data"))
DB_PATH = DATA_DIR / "star-radar.db"
CACHE_PATH = DATA_DIR / ".gh_cache.json"

# GitHub
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_API = "https://api.github.com"

# LLM(智谱开放平台,OpenAI 兼容协议)
ZHIPU_API_KEY = (
    os.environ.get("ZHIPU_API_KEY", "").strip()
    or os.environ.get("ZHIPUAI_API_KEY", "").strip()
)
LLM_BASE = os.environ.get("LLM_BASE", "https://open.bigmodel.cn/api/paas/v4")
LLM_MODEL = os.environ.get("LLM_MODEL", "glm-4.6")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "embedding-3")

# 抓取行为
FETCH_INTERVAL_HOURS = float(os.environ.get("SR_FETCH_INTERVAL_H", "6"))
AUTO_FETCH_ON_BOOT = os.environ.get("SR_AUTO_FETCH", "1") != "0"
NEW_COMER_MAX_AGE_DAYS = 30          # 「新秀」定义
VELOCITY_SAMPLE_BUDGET = int(os.environ.get("SR_SAMPLE_BUDGET", "160"))

HOST = os.environ.get("SR_HOST", "127.0.0.1")
PORT = int(os.environ.get("SR_PORT", "8000"))

DATA_DIR.mkdir(parents=True, exist_ok=True)
