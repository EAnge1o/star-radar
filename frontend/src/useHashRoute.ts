import { useEffect, useState } from "react";

export interface Route {
  path: string;        // "" | "watchlist" | "report/daily" | "track/<label>" ...
  query: URLSearchParams;
}

export function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = h.split("?");
  return { path: pathPart.replace(/\/$/, ""), query: new URLSearchParams(queryPart || "") };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function syncBoardQuery(params: Record<string, string | number | boolean>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v !== 0 && v !== false) sp.set(k, String(v));
  }
  const qs = sp.toString();
  const next = "#/" + (qs ? `?${qs}` : "");
  if (window.location.hash !== next) {
    window.history.replaceState(null, "", next);
  }
}

export function navigate(path: string) {
  window.location.hash = "#/" + path.replace(/^\/?/, "");
}
