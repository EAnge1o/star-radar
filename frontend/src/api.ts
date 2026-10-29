import type { BoardResp, RepoDetail, Stats, Track } from "./types";

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

export interface BoardQuery {
  board: string;
  window: string;
  lang: string;
  q: string;
  ai_only: boolean;
  track_id: number;
  limit: number;
}

export const api = {
  board: (b: BoardQuery) =>
    getJSON<BoardResp>(
      `/api/board?board=${b.board}&window=${b.window}&lang=${encodeURIComponent(b.lang)}` +
      `&q=${encodeURIComponent(b.q)}&ai_only=${b.ai_only}&track_id=${b.track_id}&limit=${b.limit}`
    ),
  tracks: () => getJSON<{ tracks: Track[] }>("/api/tracks"),
  stats: () => getJSON<Stats>("/api/stats"),
  repo: (fullName: string) => getJSON<RepoDetail>(`/api/repos/${fullName}`),
  refresh: () => postJSON<{ ok: boolean; repos: number; new: number }>("/api/refresh"),
  llmEnable: (key: string) =>
    postJSON<{ ok: boolean; probe: { llm: boolean; model?: string; error?: string } }>(
      "/api/llm/enable",
      { key }
    ),
  llmComment: () => postJSON<{ ok: boolean }>("/api/llm/comment"),
  llmTracks: () => postJSON<{ ok: boolean }>("/api/llm/tracks"),
};
