// One index per page load, built in two stages.
//
// The core index (site routes, live demos) is built synchronously the first
// time anything asks, so the palette answers the very first keystroke. The
// full index -- modules, article bodies, wiki pages -- is fetched once, in the
// background, and swapped in when ready. Callers subscribe instead of
// awaiting, so results visibly deepen rather than blocking behind a spinner.

import { SearchIndex } from "./engine";
import { coreDocs, extendedDocs } from "./sources";
import type { SearchDoc } from "./types";

type Listener = () => void;

let coreIndex: SearchIndex | null = null;
let fullIndex: SearchIndex | null = null;
let loading: Promise<SearchIndex> | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/** Whatever index exists right now -- core at worst, full once loaded. */
export function currentIndex(): SearchIndex {
  if (fullIndex) return fullIndex;
  if (!coreIndex) coreIndex = new SearchIndex(coreDocs());
  return coreIndex;
}

export function isFullyLoaded(): boolean {
  return Boolean(fullIndex);
}

/** Kick off (or join) the background build of the full index. */
export function loadFullIndex(): Promise<SearchIndex> {
  if (fullIndex) return Promise.resolve(fullIndex);
  if (loading) return loading;
  loading = extendedDocs()
    .then((docs: SearchDoc[]) => {
      fullIndex = new SearchIndex([...coreDocs(), ...docs]);
      notify();
      return fullIndex;
    })
    .catch(() => {
      // Keep serving the core index; let a later call retry.
      loading = null;
      return currentIndex();
    });
  return loading;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test hook: drop cached state so a suite can rebuild from fresh sources. */
export function resetSearchIndex(): void {
  coreIndex = null;
  fullIndex = null;
  loading = null;
  notify();
}
