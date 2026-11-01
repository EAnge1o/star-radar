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
  prev_score?: number | null;
  size?: number | null;
  commits_7d?: number | null;
  hn_points?: number | null;
  hn_comments?: number | null;
  hn_time?: string | null;
  resonance?: number;
  cooling?: number;
  marketing?: number;
  marketing_method?: string | null;
  readme_summary?: string | null;
  prev_rank?: number | null;
  owner_hot?: number;
  added_at?: string;
  last_milestone?: number | null;
  note?: string | null;
  related?: RelatedRepo[];
  snapshots?: Snapshot[];
}

export interface RelatedRepo {
  full_name: string;
  stars: number;
  language: string | null;
  description: string | null;
  commentary: string | null;
  is_ai: number;
}

export interface Snapshot {
  stars: number;
  taken_at: string;
}

export type RepoDetail = Repo;

export interface Track {
  id: number;
  label: string;
  summary: string | null;
  size: number;
  heat: number;
  method: string | null;
  repos: { full_name: string; stars: number; language: string | null }[];
}

export interface TrackHeatPoint {
  heat: number;
  size: number;
  taken_at: string;
}

export interface TrackPageData {
  track: Track & { heat_history: TrackHeatPoint[] };
  members: Repo[];
}

export interface WatchItem extends Repo {}

export interface Sub {
  id: number;
  name: string;
  query: string;
  created_at: string;
  results: number;
}

export interface ReportSection {
  full_name: string;
  description: string | null;
  language: string | null;
  stars?: number;
  stars_7d?: number | null;
  stars_1d?: number | null;
  commentary?: string | null;
  is_ai?: number;
  black_horse?: number;
  created_at?: string | null;
  gained?: number;
  prev_score?: number | null;
}

export interface Report {
  kind: string;
  generated_at: string;
  window_days: number;
  movers: ReportSection[];
  newcomers: ReportSection[];
  cooling: ReportSection[];
  tracks_up: { label: string; heat: number; delta: number }[];
  tracks_down: { label: string; heat: number; delta: number }[];
  stats_line: string;
  intro: string;
}

export interface Notification {
  id: number;
  gh_id: number | null;
  full_name: string | null;
  kind: string;
  title: string;
  message: string | null;
  link: string | null;
  channel: string;
  delivered: number;
  created_at: string;
}

export interface Stats {
  total_repos: number;
  today_new_stars: number;
  newcomers: number;
  black_horses: number;
  resonant: number;
  watch_count: number;
  subs_count: number;
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
