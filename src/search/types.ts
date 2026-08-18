// Shared shapes for site-wide search. One flat document type covers every
// kind of thing the site can hand back for a query -- a module, a patch you
// can hear, an article, a section inside an article, a wiki page, a route.
// The engine never special-cases a kind; it only reads these fields.

export type SearchKind =
  | "module" // a soemdsp module (polyBlep, besselThomson, ...)
  | "patch" // a loadable patch file
  | "demo" // a live, playable route (hero patch, sandbox entry)
  | "article" // a long-form article or patch wiki page
  | "section" // a heading inside an article -- deep-linkable
  | "wiki" // a community wiki page (Supabase)
  | "page"; // a plain site route

export type SearchDoc = {
  /** Stable, unique across the whole corpus (e.g. "module:polyBlep"). */
  id: string;
  kind: SearchKind;
  title: string;
  /** One-line description shown under the title. */
  subtitle?: string;
  /** Long text -- searched, never fully rendered. */
  body?: string;
  /** Tags, notes, module types, aliases. Weighted just under the title. */
  keywords?: string[];
  /** Where the result navigates to. Internal paths start with "/". */
  url: string;
  /** Human-readable group ("Oscillator", "Filter", "Guide"). */
  category?: string;
  /** True when the destination plays/renders something immediately. */
  live?: boolean;
  /** Extra weight for hand-picked hub results; 0 is neutral. */
  boost?: number;
  /** Kind-specific extras the UI can render (module type, patch slug, ...). */
  meta?: Record<string, string | number | boolean | string[] | undefined>;
};

export type SearchResult = {
  doc: SearchDoc;
  score: number;
  /** Body excerpt around the first match, when the match came from the body. */
  snippet?: string;
  /** Query terms (including expansions) that actually hit this doc. */
  matched: string[];
};

export type SearchOptions = {
  limit?: number;
  kinds?: SearchKind[];
};
