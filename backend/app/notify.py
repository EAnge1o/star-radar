"""通知中枢:站内通知表 + 飞书 webhook + Telegram。通道配置存 settings 表。"""
import json
from datetime import datetime, timezone
from typing import Optional

import httpx

from . import db

CONFIG_KEYS = ["feishu_webhook", "telegram_token", "telegram_chat"]

EPOCH = "1970-01-01T00:00:00Z"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_setting(key: str) -> Optional[str]:
    with db.db() as con:
        row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row and row["value"] else None


def set_setting(key: str, value: Optional[str]):
    with db.db() as con:
        if value:
            con.execute(
                "INSERT INTO settings(key, value) VALUES(?,?)"
                " ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )
        else:
            con.execute("DELETE FROM settings WHERE key=?", (key,))


def config() -> dict:
    return {k: (get_setting(k) or "") for k in CONFIG_KEYS}


def push(kind: str, title: str, message: str = "",
         full_name: Optional[str] = None, gh_id: Optional[int] = None,
         link: Optional[str] = None) -> dict:
    """记入站内通知表,并投递到已配置的外部通道。返回投递结果。"""
    with db.db() as con:
        cur = con.execute(
            "INSERT INTO notifications(gh_id, full_name, kind, title, message, link, channel,"
            " delivered, created_at) VALUES (?,?,?,?,?,?,?,0,?)",
            (gh_id, full_name, kind, title, message, link, "inbox", _now_iso()),
        )
        nid = cur.lastrowid

    results = {"inbox": nid}
    text = title + (f"\n{message}" if message else "")
    feishu = get_setting("feishu_webhook")
    tg_token = get_setting("telegram_token")
    tg_chat = get_setting("telegram_chat")

    async def _send():
        async with httpx.AsyncClient(timeout=httpx.Timeout(15)) as c:
            if feishu:
                try:
                    r = await c.post(feishu, json={
                        "msg_type": "text",
                        "content": {"text": text + (f"\n{link}" if link else "")},
                    })
                    results["feishu"] = r.status_code
                except Exception as e:
                    results["feishu"] = str(e)[:80]
            if tg_token and tg_chat:
                try:
                    r = await c.post(
                        f"https://api.telegram.org/bot{tg_token}/sendMessage",
                        json={"chat_id": tg_chat, "text": text + (f"\n{link}" if link else "")},
                    )
                    results["telegram"] = r.status_code
                except Exception as e:
                    results["telegram"] = str(e)[:80]

    try:
        import asyncio
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(1) as ex:
                ex.submit(asyncio.run, _send()).result(timeout=40)
        else:
            asyncio.run(_send())
    except Exception as e:
        results["error"] = str(e)[:120]

    delivered = 1 if any(v == 200 for k, v in results.items() if k != "inbox") else 0
    channel = ",".join(k for k, v in results.items() if k != "inbox" and v == 200) or "inbox"
    with db.db() as con:
        con.execute(
            "UPDATE notifications SET delivered=?, channel=? WHERE id=?",
            (delivered, channel, nid),
        )
    return results


def recent(since_id: int = 0, limit: int = 30) -> list[dict]:
    with db.db() as con:
        rows = con.execute(
            "SELECT * FROM notifications WHERE id > ? ORDER BY id DESC LIMIT ?",
            (since_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]
