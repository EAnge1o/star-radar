import type {
  BoardResp,
  FetchRun,
  Notification,
  Report,
  Repo,
  RepoDetail,
  Stats,
  Sub,
  Track,
  TrackPageData,
} from "./types";

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function delJSON<T>(path: string): Promise<T> {
  const r = await fetch(path, { method: "DELETE" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export interface BoardQuery {
  board: string;
  window: string;
  lang: string;
  q: string;
  ai_only: boolean;
  track_id: number;
  sub_id: number;
  limit: number;
}

export const api = {
  board: (b: BoardQuery) =>
    getJSON<BoardResp>(
      `/api/board?board=${b.board}&window=${b.window}&lang=${encodeURIComponent(b.lang)}` +
      `&q=${encodeURIComponent(b.q)}&ai_only=${b.ai_only}&track_id=${b.track_id}` +
      `&sub_id=${b.sub_id}&limit=${b.limit}`
    ),
  tracks: () => getJSON<{ tracks: Track[] }>("/api/tracks"),
  trackView: (label: string) =>
    getJSON<TrackPageData>(`/api/tracks/view?label=${encodeURIComponent(label)}`),
  stats: () => getJSON<Stats>("/api/stats"),
  runs: (limit = 20) => getJSON<{ runs: FetchRun[] }>(`/api/runs?limit=${limit}`),
  agentStatus: () =>
    getJSON<{ running: boolean; last_run: FetchRun | null; interval_hours: number; llm_ready: boolean; github_token: boolean }>(
      "/api/agent/status"
    ),
  repo: (fullName: string) => getJSON<RepoDetail>(`/api/repos/${fullName}`),
  refresh: () => postJSON<{ ok: boolean; repos: number; new: number }>("/api/refresh"),

  watch: {
    list: () => getJSON<{ repos: Repo[] }>("/api/watch"),
    add: (fullName: string) => postJSON<{ ok: boolean; gh_id: number }>("/api/watch", { full_name: fullName }),
    remove: (ghId: number) => delJSON<{ ok: boolean }>(`/api/watch/${ghId}`),
  },

  subs: {
    list: () => getJSON<{ subs: Sub[] }>("/api/subs"),
    add: (name: string, query: string) => postJSON<{ ok: boolean; id: number }>("/api/subs", { name, query }),
    remove: (id: number) => delJSON<{ ok: boolean }>(`/api/subs/${id}`),
  },

  report: (kind: "daily" | "weekly") => getJSON<Report>(`/api/report/${kind}`),
  reportPush: (kind: "daily" | "weekly") =>
    postJSON<{ ok: boolean; delivered: Record<string, unknown> }>("/api/report/push", { kind }),

  notifications: (since: number) =>
    getJSON<{ notifications: Notification[] }>(`/api/notifications?since=${since}`),
  testNotify: () => postJSON<{ ok: boolean; result: Record<string, unknown> }>("/api/notifications/test"),

  settings: () => getJSON<{ settings: Record<string, string> }>("/api/settings"),
  setSettings: (kv: Record<string, string>) =>
    postJSON<{ ok: boolean; settings: Record<string, string> }>("/api/settings", kv),

  llmEnable: (key: string) =>
    postJSON<{ ok: boolean; probe: { llm: boolean; model?: string; error?: string } }>(
      "/api/llm/enable",
      { key }
    ),
  llmComment: () => postJSON<{ ok: boolean }>("/api/llm/comment"),
};

export type { Repo, RepoDetail, Stats, Track, TrackPageData, Sub, Report, Notification };
