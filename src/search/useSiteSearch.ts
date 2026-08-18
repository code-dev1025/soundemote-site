// React binding for the search index. Owns three things the UI shouldn't:
// starting the background index load, re-running the query when a deeper
// index arrives, and keeping typing responsive with a short debounce.

import { useEffect, useMemo, useState } from "react";
import { groupResults } from "./engine";
import { currentIndex, isFullyLoaded, loadFullIndex, subscribe } from "./store";
import type { SearchKind, SearchResult } from "./types";

const DEBOUNCE_MS = 90;

export type UseSiteSearch = {
  results: SearchResult[];
  grouped: Map<SearchKind, SearchResult[]>;
  /** True until the full corpus (modules, articles, wiki) is in memory. */
  loading: boolean;
  /** Documents currently searchable. */
  corpusSize: number;
};

export function useSiteSearch(
  query: string,
  { limit = 30, kinds, enabled = true }: { limit?: number; kinds?: SearchKind[]; enabled?: boolean } = {},
): UseSiteSearch {
  const [debounced, setDebounced] = useState(query);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    void loadFullIndex();
  }, [enabled]);

  useEffect(() => subscribe(() => setRevision((n) => n + 1)), []);

  useEffect(() => {
    if (query === debounced) return;
    const timer = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // `debounced` is intentionally out of the dep list: including it would
    // restart the timer on every settle and stall fast typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return useMemo(() => {
    const index = currentIndex();
    const results = debounced.trim() ? index.search(debounced, { limit, kinds }) : [];
    return {
      results,
      grouped: groupResults(results),
      loading: !isFullyLoaded(),
      corpusSize: index.size,
    };
    // `revision` re-runs the query when the deeper index lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, limit, kinds, revision]);
}

/** Warm the index ahead of the first keystroke (hover/focus on the search box). */
export function prefetchSearchIndex(): void {
  void loadFullIndex();
}
