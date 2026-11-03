export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.?0+$/, "") + "k";
  return String(Math.round(n));
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "尚未观测";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const diff = Math.max(0, Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export function ageDays(createdIso: string | null | undefined): number | null {
  if (!createdIso) return null;
  const t = new Date(createdIso).getTime();
  return (Date.now() - t) / 86400000;
}

export function fmtAge(createdIso: string | null | undefined): string {
  const d = ageDays(createdIso);
  if (d == null) return "—";
  if (d < 1) return "今天";
  if (d < 30) return `${Math.floor(d)} 天`;
  if (d < 365) return `${Math.floor(d / 30)} 个月`;
  return `${(d / 365).toFixed(1)} 年`;
}

const LANG_COLORS: Record<string, string> = {
  Python: "#4B8BBE",
  TypeScript: "#3178C6",
  JavaScript: "#E8D44D",
  Rust: "#E4622E",
  Go: "#00ADD8",
  "C++": "#F34B7D",
  C: "#A8B9CC",
  "C#": "#9B4F96",
  Java: "#E76F00",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Zig: "#EC915C",
  Shell: "#89E051",
  HTML: "#E34C26",
  CSS: "#563D7C",
  Vue: "#41B883",
  Svelte: "#FF3E00",
  "Jupyter Notebook": "#DA5B0B",
  Lua: "#000080",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
  Lean: "#D4A855",
  MDX: "#FCB32C",
  Dart: "#00B4AB",
};

/** 午夜线网:赛道线路色环(按 track id 稳定取色) */
export const TRACK_COLORS = [
  "#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#76b7b2",
  "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#5f7d8c",
  "#86bcb6", "#d37295", "#a0cbe8",
];

export function trackColor(id: number | null | undefined): string {
  if (!id) return "var(--accent)";
  return TRACK_COLORS[(id - 1 + TRACK_COLORS.length * 10) % TRACK_COLORS.length];
}

export function langColor(lang: string | null | undefined): string {
  if (!lang) return "#5F6B85";
  return LANG_COLORS[lang] ?? "#7C8DB0";
}
