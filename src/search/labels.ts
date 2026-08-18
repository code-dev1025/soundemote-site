// Display vocabulary for result kinds, shared by the palette and /search so
// the two never drift.
import type { SearchKind } from "./types";

export const KIND_LABEL: Record<SearchKind, string> = {
  module: "Modules",
  patch: "Patches",
  demo: "Live demos",
  article: "Explanations",
  section: "Sections",
  wiki: "Wiki",
  page: "Pages",
};

/** The order groups appear in. Playable things first, reference last. */
export const KIND_ORDER: SearchKind[] = ["module", "demo", "patch", "article", "section", "wiki", "page"];
