"""赛道聚类:优先 embedding 语义聚类(LLM 命名),无 key 时退化为主题词典分组。"""
import asyncio
import math
from collections import defaultdict
from typing import Optional

from . import ai

# 主题词典(退化路径用):赛道名 -> 命中关键词(topic 或 desc 中的子串)
TOPIC_RULES: list[tuple[str, str, list[str]]] = [
    # (赛道名, 一句话概述, 关键词)
    ("Agent 框架", "构建自主智能体与多智能体编排的框架与运行时",
     ["agent", "agentic", "multi-agent", "autonomous", "crewai", "langgraph", "swarm", "orchestrat"]),
    ("LLM 推理与部署", "大模型推理引擎、量化与本地部署",
     ["inference", "llama.cpp", "vllm", "quantiz", "gguf", "ollama", "runtime for llm", "推理"]),
    ("RAG 与知识库", "检索增强生成、向量库与知识管理",
     ["rag", "retrieval", "vector", "embedding", "knowledge", "向量"]),
    ("训练与微调", "大模型训练、微调与对齐工具链",
     ["fine-tun", "finetun", "training", "sft", "rlhf", "lora", "unsloth", "trainer", "align"]),
    ("语音与音频", "语音识别、合成与数字人",
     ["tts", "speech", "voice", "asr", "audio", "whisper", "sing", "配音", "语音"]),
    ("视觉与生成", "图像/视频生成与理解",
     ["image", "video", "diffusion", "stable", "flux", "vision", "ocr", "photo", "render", "3d"]),
    ("MCP 与工具链", "模型上下文协议与工具集成",
     ["mcp", "model context protocol", "tool-call", "function call", "tool-use"]),
    ("开发效率工具", "CLI、终端、编辑器与效率小工具",
     ["cli", "terminal", "editor", "productivity", "workflow", "launcher", "shell", "devtool"]),
    ("Web 全栈框架", "Web 框架、模板与全栈脚手架",
     ["framework", "fullstack", "web ", "http", "ui ", "component", "template", "dashboard"]),
    ("数据库与存储", "数据库、缓存与向量存储引擎",
     ["database", "sql", "postgres", "sqlite", "storage", "key-value", "时序"]),
    ("爬虫与自动化", "浏览器自动化、爬虫与 RPA",
     ["crawl", "scrap", "spider", "browser automation", "playwright", "puppeteer", "自动化"]),
    ("区块链与量化", "加密货币、链上工具与量化交易",
     ["bitcoin", "crypto", "blockchain", "solana", "defi", "trading bot", "量化"]),
]


def _cos(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-9
    nb = math.sqrt(sum(x * x for x in b)) or 1e-9
    return dot / (na * nb)


def topic_cluster(repos: list[dict]) -> list[dict]:
    """退化路径:按词典规则分组。返回 [{label, summary, names}]。"""
    groups: dict[str, list[str]] = defaultdict(list)
    for r in repos:
        hay = " ".join([
            " ".join(r.get("topics") or []),
            (r.get("description") or ""),
            (r.get("language") or ""),
        ]).lower()
        hit = None
        for label, _s, kws in TOPIC_RULES:
            if any(k in hay for k in kws):
                hit = label
                break
        groups[hit or "其他新锐"].append(r["full_name"])
    summaries = {label: s for label, s, _k in TOPIC_RULES}
    out = []
    for label, names in groups.items():
        if label == "其他新锐" and len(names) < 4:
            continue
        out.append({
            "label": label,
            "summary": summaries.get(label, "本周值得关注的新兴项目集合"),
            "names": names,
        })
    return out


async def semantic_cluster(repos: list[dict]) -> Optional[list[dict]]:
    """embedding 聚类 + LLM 命名;任何一步失败返回 None(上层退化为词典)。"""
    if not ai.available() or len(repos) < 6:
        return None
    texts = []
    for r in repos:
        texts.append(
            f"{r['full_name']}: {r.get('description') or ''} "
            f"[{' '.join((r.get('topics') or [])[:8])}]"
        )
    vecs = await ai.embed_texts(texts)
    if not vecs or len(vecs) != len(repos):
        return None

    # 简单贪心聚类:余弦相似度 >= 0.60 归入首个可用簇
    TH = 0.60
    clusters: list[list[int]] = []
    for i, v in enumerate(vecs):
        best, best_sim = None, TH
        for ci, members in enumerate(clusters):
            sim = sum(_cos(v, vecs[j]) for j in members) / len(members)
            if sim > best_sim:
                best, best_sim = ci, sim
        if best is None:
            clusters.append([i])
        else:
            clusters[best].append(i)
    clusters = [c for c in clusters if len(c) >= 3][:8]

    desc_by_name = {r["full_name"]: (r.get("description") or "")[:80] for r in repos}
    out = []
    for members in clusters:
        names = [repos[i]["full_name"] for i in members]
        info = await ai.name_track([f"{n}({desc_by_name[n]})" for n in names])
        out.append({
            "label": (info or {}).get("label") or names[0].split("/")[1][:8],
            "summary": (info or {}).get("summary") or "",
            "names": names,
        })
    return out or None


def cluster_repos(repos: list[dict]) -> tuple[list[dict], str]:
    """入口:返回 (clusters, method)。在独立线程跑事件循环,避免与主循环冲突。"""
    sem = None
    if ai.available() and len(repos) >= 6:
        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(1) as ex:
                sem = ex.submit(asyncio.run, semantic_cluster(repos)).result(timeout=300)
        except Exception as e:
            print(f"[tracks] semantic cluster failed: {e}")
    if sem:
        return sem, "llm-embed"
    return topic_cluster(repos), "topics"


def heat_score(names: list[str], stars7_map: dict[str, float], total_stars7: float) -> float:
    """赛道热度 = 组内近7日 star 占比,归一到 0.05..1。"""
    s = sum(stars7_map.get(n, 0) for n in names)
    if total_stars7 <= 0:
        return 0.0
    return max(0.05, min(1.0, s / total_stars7))
