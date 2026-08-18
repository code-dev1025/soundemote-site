// Public surface of the search module.
export { SearchIndex, groupResults } from "./engine";
export { expandQuery, knownTerms } from "./aliases";
export { articleDocs, coreDocs, extendedDocs, fetchEngineIndex, moduleDocs, patchDocs } from "./sources";
export { articlePath, modulePath, patchLabelFor, patchUrlFor } from "./links";
export type { EngineIndex, EngineModule, EnginePatch } from "./sources";
export { currentIndex, isFullyLoaded, loadFullIndex, resetSearchIndex, subscribe } from "./store";
export { prefetchSearchIndex, useSiteSearch } from "./useSiteSearch";
export type { SearchDoc, SearchKind, SearchOptions, SearchResult } from "./types";
export { KIND_LABEL, KIND_ORDER } from "./labels";
