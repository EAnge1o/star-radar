"""LLM 能力:中文点评、赛道命名、语义聚类。全部优雅降级(无 key 时返回 None)。"""
import asyncio
import json
import re
from typing import Any, Optional

import httpx

from . import config


def available() -> bool:
    return bool(config.ZHIPU_API_KEY)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=config.LLM_BASE,
        headers={"Authorization": f"Bearer {config.ZHIPU_API_KEY}"},
        timeout=httpx.Timeout(120),
    )


async def _chat(client: httpx.AsyncClient, prompt: str, system: str) -> Optional[str]:
    body = {
        "model": config.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 2000,
    }
    r = await client.post("/chat/completions", json=body)
    if r.status_code != 200:
        print(f"[ai] chat {r.status_code}: {r.text[:200]}")
        return None
    try:
        return r.json()["choices"][0]["message"]["content"]
    except Exception:
        return None


def _extract_json(text: str) -> Optional[Any]:
    if not text:
        return None
    m = re.search(r"\{.*\}|\[.*\]", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        try:
            return json.loads(m.group(0).replace("\n", "").replace(",}", "}"))
        except Exception:
            return None


async def comment_repos(batch: list[dict]) -> dict[str, dict[str, str]]:
    """批量生成中文点评。入参为 repo 摘要列表,返回 {full_name: {point, why}}。"""
    if not available() or not batch:
        return {}
    rows = []
    for r in batch:
        age = r.get("age_days") or 0
        rows.append(
            f"- {r['full_name']} | 语言:{r.get('language') or '-'} | "
            f"stars:{r.get('stars')} | 近7日约:{r.get('stars_7d')} | 仓库年龄:{age}天 | "
            f"topics:{','.join((r.get('topics') or [])[:6])} | 简介:{(r.get('description') or '')[:160]}"
        )
    prompt = (
        "以下是 GitHub 上近期热门的开源项目列表。请为每一个项目生成中文点评。\n"
        "要求:point 是一句话点评(不超过40字),讲清「这是什么项目、为什么值得关注」;"
        "why 是它近期火起来的原因(不超过28字),结合增长情况,不要空话。\n"
        "只用输出 JSON:{\"owner/repo\": {\"point\": \"...\", \"why\": \"...\"}, ...} 必须覆盖列表中每个项目。\n\n"
        + "\n".join(rows)
    )
    async with _client() as c:
        text = await _chat(
            c, prompt,
            "你是资深开源技术观察者,点评犀利、具体、不写营销腔。中文输出。"
        )
    data = _extract_json(text)
    out: dict[str, dict[str, str]] = {}
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, dict) and v.get("point"):
                out[k] = {"point": str(v["point"])[:60], "why": str(v.get("why") or "")[:40]}
    return out


async def embed_texts(texts: list[str]) -> Optional[list[list[float]]]:
    if not available() or not texts:
        return None
    out: list[list[float]] = []
    async with _client() as c:
        for i in range(0, len(texts), 16):
            chunk = texts[i:i + 16]
            r = await c.post("/embeddings", json={
                "model": config.EMBED_MODEL, "input": chunk,
            })
            if r.status_code != 200:
                print(f"[ai] embed {r.status_code}: {r.text[:200]}")
                return None
            data = sorted(r.json().get("data", []), key=lambda x: x["index"])
            out.extend([d["embedding"] for d in data])
    return out


async def name_track(projects: list[str]) -> Optional[dict]:
    """给一组项目起赛道名。"""
    if not available() or not projects:
        return None
    prompt = (
        "这些 GitHub 项目因为主题相近被聚成一组,请给这个「赛道」起名并写一句概述。\n"
        "名字 2-6 个中文字(如「Agent 框架」「语音合成」「LLM 推理」),"
        "概述不超过 30 字,说明这批项目共同在解决什么问题。\n"
        "只输出 JSON:{\"label\": \"...\", \"summary\": \"...\"}\n\n项目:\n"
        + "\n".join(f"- {p}" for p in projects[:15])
    )
    async with _client() as c:
        text = await _chat(c, prompt, "你是技术趋势分析师。中文输出。")
    data = _extract_json(text)
    if isinstance(data, dict) and data.get("label"):
        return {"label": str(data["label"])[:12], "summary": str(data.get("summary") or "")[:40]}
    return None


async def probe() -> dict:
    if not available():
        return {"llm": False, "model": None}
    try:
        async with _client() as c:
            text = await _chat(c, "回复:OK", "只回复两个字:OK")
        return {"llm": bool(text), "model": config.LLM_MODEL}
    except Exception as e:
        return {"llm": False, "model": None, "error": str(e)[:120]}
