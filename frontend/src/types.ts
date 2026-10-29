export interface Repo {
  gh_id: number;
  full_name: string;
  owner: string;
  owner_type: string | null;
  avatar_url: string | null;
  description: string | null;
  language: string | null;
  topics: string[];
  license: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  created_at: string | null;
  pushed_at: string | null;
  first_seen: string;
  stars_1d: number | null;
  stars_7d: number | null;
  stars_28d: number | null;
  velocity_est: number;
  score: number;
  black_horse: number;
  is_ai: number;
  commentary: string | null;
  commentary_why: string | null;
  commentary_model: string | null;
  track_id: number | null;
  spark: [string, number][] | null;
  updated_at: string;
}

export interface Track {
  id: number;
  label: string;
  summary: string | null;
  size: number;
  heat: number;
  method: string | null;
  repos: { full_name: string; stars: number; language: string | null }[];
}

export interface Stats {
  total_repos: number;
  today_new_stars: number;
  newcomers: number;
  black_horses: number;
  tracks: number;
  last_fetch: { started_at: string; finished_at: string; repos_seen: number; repos_new: number; note: string | null } | null;
  llm_ready: boolean;
  llm_model: string | null;
  github_token: boolean;
  server_time: string;
}

export interface BoardResp {
  repos: Repo[];
  languages: string[];
  board: string;
  window: string;
}

export interface Snapshot {
  stars: number;
  taken_at: string;
}

export interface RepoDetail extends Repo {
  snapshots: Snapshot[];
}
