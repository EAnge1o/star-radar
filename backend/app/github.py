"""GitHub API 客户端:ETag 条件请求省配额、限流感知、stargazers 采样。"""
import asyncio
import json
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from . import config


class RateLimitPause(Exception):
    pass


class GitHubClient:
    # 全局标记:当前会话是否因网络拦截降级了 TLS 校验(stats 里如实展示)
    TLS_INSECURE = False

    def __init__(self, token: str = ""):
        self.token = token or config.GITHUB_TOKEN
        self._verify = True
        self._build_client()
        # ETag 缓存持久化:相同请求 304 不消耗配额
        self._etag_path = config.CACHE_PATH
        try:
            self._etags: dict[str, dict] = json.loads(self._etag_path.read_text("utf-8"))
        except Exception:
            self._etags = {}

    def _build_client(self):
        self._client = httpx.AsyncClient(
            base_url=config.GITHUB_API,
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "StarRadar/1.0",
                **({"Authorization": f"Bearer {self.token}"} if self.token else {}),
            },
            timeout=httpx.Timeout(30),
            verify=self._verify,
        )

    async def _tls_fallback(self, e: Exception) -> bool:
        """api.github.com 被网络中间人拦截时,降级为不校验并重建客户端。仅此一处。"""
        if self._verify and isinstance(e, httpx.ConnectError) and \
                "certificate verify failed" in str(e).lower():
            print("[github] TLS interception detected for api.github.com; "
                  "falling back to verify=False for this client")
            self._verify = False
            GitHubClient.TLS_INSECURE = True
            await self._client.aclose()
            self._build_client()
            return True
        return False

    async def close(self):
        await self._client.aclose()

    # ---------------- core ----------------

    async def _request(self, method: str, url: str, *, params=None,
                       headers=None, resource: str = "core") -> Optional[httpx.Response]:
        extra = dict(headers or {})
        cache_key = url + json.dumps(params or {}, sort_keys=True)
        saved = self._etags.get(cache_key)
        if saved:
            extra["If-None-Match"] = saved["etag"]

        try:
            r = await self._client.request(method, url, params=params, headers=extra)
        except httpx.ConnectError as e:
            if await self._tls_fallback(e):
                r = await self._client.request(method, url, params=params, headers=extra)
            else:
                raise
        if r.status_code == 304 and saved:
            return _FakeResponse(saved["body"])
        if r.status_code in (403, 429):
            reset = float(r.headers.get("X-RateLimit-Reset", 0))
            remaining = r.headers.get("X-RateLimit-Remaining")
            if remaining == "0" and reset > time.time():
                wait = min(reset - time.time() + 2, 600)
                print(f"[github] rate limit hit, sleeping {wait:.0f}s ({resource})")
                await asyncio.sleep(wait)
                r = await self._client.request(method, url, params=params, headers=extra)
        if r.status_code in (403, 404, 401):
            # 403 无 permission、404 不存在等,返回 None 让调用方降级
            return None
        r.raise_for_status()

        etag = r.headers.get("ETag")
        if etag:
            self._etags[cache_key] = {"etag": etag, "body": _safe_json(r)}
            self._save_etags()
        return r

    def _save_etags(self):
        try:
            self._etag_path.write_text(
                json.dumps(self._etags, ensure_ascii=False), "utf-8"
            )
        except Exception:
            pass

    async def search_repos(self, q: str, *, sort: str = "stars",
                           per_page: int = 100, pages: int = 1) -> list[dict]:
        items: list[dict] = []
        for page in range(1, pages + 1):
            r = await self._request(
                "GET", "/search/repositories",
                params={"q": q, "sort": sort, "order": "desc",
                        "per_page": per_page, "page": page},
                resource="search",
            )
            if r is None:
                break
            data = _safe_json_obj(r)
            items.extend(data.get("items", []))
            if len(data.get("items", [])) < per_page:
                break
        return items

    async def get_repo(self, full_name: str) -> Optional[dict]:
        r = await self._request("GET", f"/repos/{full_name}")
        return _safe_json_obj(r) if r is not None else None

    async def sample_recent_stars(self, full_name: str, stars: int,
                                  max_deep_pages: int = 3) -> Optional[list[str]]:
        """取最后一页 stargazers(带 starred_at),返回最近至多 100 条时间戳。

        需要认证;未认证直接返回 None,调用方走估算路径。
        """
        if not self.token:
            return None
        last_page = max(1, math.ceil(min(stars, 40000) / 100))
        r = await self._request(
            "GET", f"/repos/{full_name}/stargazers",
            params={"per_page": 100, "page": last_page},
            headers={"Accept": "application/vnd.github.star+json"},
        )
        if r is None:
            return None
        items = _safe_json_list(r)
        return [x["starred_at"] for x in items if x.get("starred_at")]

    async def count_commits_since(self, full_name: str, days: int = 7) -> Optional[int]:
        """近 N 天 commit 数(用 per_page=1 的 Link 头 last 页码推算;需 token 才划算)。"""
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        r = await self._request(
            "GET", f"/repos/{full_name}/commits",
            params={"since": since, "per_page": 1},
        )
        if r is None:
            return None
        link = r.headers.get("Link")
        if link and 'rel="last"' in link:
            import re as _re
            m = _re.search(r'[?&]page=(\d+)>; rel="last"', link)
            if m:
                return int(m.group(1))
        items = _safe_json_list(r)
        return len(items)

    async def get_readme(self, full_name: str) -> Optional[str]:
        """取 README 原文(截断);用于摘要。"""
        r = await self._client.get(
            f"/repos/{full_name}/readme",
            headers={"Accept": "application/vnd.github.raw"},
        )
        if r.status_code != 200:
            return None
        try:
            return r.text[:6000]
        except Exception:
            return None

    def get_readme_sync(self, full_name: str) -> Optional[str]:
        """同步版 README 抓取(供线程池中的 API 端点使用);含 TLS 拦截降级。"""
        verify = self._verify
        for attempt in range(2):
            try:
                r = httpx.get(
                    f"{self._client.base_url}/repos/{full_name}/readme",
                    headers={**dict(self._client.headers), "Accept": "application/vnd.github.raw"},
                    timeout=20,
                    verify=verify,
                )
                if r.status_code != 200:
                    return None
                return r.text[:6000]
            except Exception as e:
                if attempt == 0 and verify and "certificate verify failed" in str(e).lower():
                    verify = False
                    GitHubClient.TLS_INSECURE = True
                    continue
                return None

    def has_token(self) -> bool:
        return bool(self.token)


class _FakeResponse:
    """304 命中缓存时伪装的响应对象。"""

    def __init__(self, body):
        self._body = body
        self.status_code = 200
        self.headers = {}

    def raise_for_status(self):
        pass


def _safe_json(r) -> Any:
    try:
        return r.json()
    except Exception:
        return None


def _safe_json_obj(r) -> dict:
    try:
        return r.json() or {}
    except Exception:
        return {}


def _safe_json_list(r) -> list:
    try:
        v = r.json()
        return v if isinstance(v, list) else []
    except Exception:
        return []
