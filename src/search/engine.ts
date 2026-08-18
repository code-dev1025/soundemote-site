// The ranking engine. Small enough corpus (a few thousand docs) that a linear
// scan over pre-tokenized docs beats maintaining an inverted index -- a query
// costs well under a millisecond, and every doc keeps its full field context
// for scoring.
//
// Scoring model, highest signal first:
//   title exact > keyword exact > title prefix > keyword prefix > subtitle >
//   body occurrence > fuzzy (one typo)
// A query term that only matches through an alias expansion scores at a
// discount, so a literal hit always outranks an inferred one. Docs must match
// every term of the query (AND); partial matches only survive for single-term
// queries where the term is a prefix.

import { expandQuery } from "./aliases";
import { isNearMatch, makeSnippet, stem, tokenize, tokenizeQuery } from "./text";
import type { SearchDoc, SearchOptions, SearchResult } from "./types";

type Field = {
  tokens: string[];
  exact: Set<string>;
  stems: Set<string>;
};

type IndexedDoc = {
  doc: SearchDoc;
  title: Field;
  keywords: Field;
  subtitle: Field;
  titleLower: string;
  subtitleLower: string;
  bodyLower: string;
};

const KIND_WEIGHT: Record<SearchDoc["kind"], number> = {
  module: 1,
  patch: 1,
  demo: 1.05,
  article: 1.08,
  section: 0.82,
  wiki: 0.95,
  page: 0.92,
};

const FIELD_SCORE = {
  titleExact: 14,
  titlePrefix: 8,
  titleFuzzy: 4.5,
  keywordExact: 10,
  keywordPrefix: 5.5,
  keywordFuzzy: 3,
  subtitleExact: 5,
  subtitlePrefix: 2.5,
  bodyHit: 1.8,
};

/** Terms reached through the alias table count, but count for less. */
const ALIAS_DISCOUNT = 0.55;

function makeField(values: string[]): Field {
  const tokens: string[] = [];
  for (const value of values) {
    if (!value) continue;
    tokens.push(...tokenize(value));
  }
  const exact = new Set(tokens);
  const stems = new Set(tokens.map(stem));
  return { tokens: [...exact], exact, stems };
}

function fieldHit(field: Field, term: string): "exact" | "prefix" | "fuzzy" | null {
  if (field.exact.has(term) || field.stems.has(stem(term))) return "exact";
  if (term.length >= 2) {
    for (const token of field.tokens) {
      if (token.length > term.length && token.startsWith(term)) return "prefix";
    }
  }
  if (term.length >= 4) {
    for (const token of field.tokens) {
      if (isNearMatch(token, term)) return "fuzzy";
    }
  }
  return null;
}

function bodyHit(bodyLower: string, term: string): boolean {
  if (!bodyLower || term.length < 3) return false;
  let from = 0;
  for (;;) {
    const at = bodyLower.indexOf(term, from);
    if (at < 0) return false;
    const before = at === 0 ? " " : bodyLower[at - 1];
    if (!/[a-z0-9]/.test(before)) return true;
    from = at + term.length;
  }
}

export class SearchIndex {
  private readonly docs: IndexedDoc[];

  constructor(docs: SearchDoc[]) {
    this.docs = docs.map((doc) => ({
      doc,
      title: makeField([doc.title]),
      keywords: makeField([...(doc.keywords || []), doc.category || ""]),
      subtitle: makeField([doc.subtitle || ""]),
      titleLower: doc.title.toLowerCase(),
      subtitleLower: (doc.subtitle || "").toLowerCase(),
      bodyLower: (doc.body || "").toLowerCase(),
    }));
  }

  get size(): number {
    return this.docs.length;
  }

  all(): SearchDoc[] {
    return this.docs.map((entry) => entry.doc);
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const raw = query.trim();
    if (!raw) return [];
    const terms = tokenizeQuery(raw);
    if (!terms.length) return [];
    const expansions = expandQuery(terms);
    const phrase = raw.toLowerCase().trim();
    const kinds = options.kinds?.length ? new Set(options.kinds) : null;
    const results: SearchResult[] = [];

    for (const entry of this.docs) {
      if (kinds && !kinds.has(entry.doc.kind)) continue;
      let score = 0;
      let missing = 0;
      const matched: string[] = [];
      let snippet: string | undefined;

      for (const term of terms) {
        const direct = this.scoreTerm(entry, term);
        let best = direct.score;
        let bestTerm = direct.score > 0 ? term : "";
        let bestSnippetTerm = direct.fromBody ? term : "";

        if (best < FIELD_SCORE.titleExact) {
          for (const alias of expansions.get(term) || []) {
            const hit = this.scoreTerm(entry, alias);
            const discounted = hit.score * ALIAS_DISCOUNT;
            if (discounted > best) {
              best = discounted;
              bestTerm = alias;
              bestSnippetTerm = hit.fromBody ? alias : "";
            }
          }
        }

        if (best <= 0) {
          missing++;
          continue;
        }
        score += best;
        if (bestTerm) matched.push(bestTerm);
        if (!snippet && bestSnippetTerm && entry.doc.body) {
          snippet = makeSnippet(entry.doc.body, bestSnippetTerm);
        }
      }

      if (!matched.length) continue;
      // Every word has to land somewhere, otherwise "bessel filter" would drag
      // in every filter on the site. One miss out of three-plus is tolerated
      // at a steep discount so long queries still return their best answer.
      if (missing) {
        if (terms.length - missing < 2 || missing > 1) continue;
        score *= 0.45;
      }

      if (entry.titleLower === phrase) score += 30;
      else if (entry.titleLower.startsWith(phrase)) score += 12;
      else if (entry.titleLower.includes(phrase)) score += 6;
      if (entry.subtitleLower.includes(phrase)) score += 3;

      score *= KIND_WEIGHT[entry.doc.kind] ?? 1;
      score += entry.doc.boost || 0;
      if (entry.doc.live) score += 1.5;
      // Placeholder modules are real entries with real names ("Wavetable2D"),
      // so a title match alone would float them above shipping modules that
      // only match on a keyword. Steep enough that a working module wins on a
      // topic query; a search for the placeholder by name still finds it.
      if (entry.doc.meta?.underConstruction) score *= 0.4;

      results.push({ doc: entry.doc, score, snippet, matched });
    }

    results.sort((a, b) => b.score - a.score || a.doc.title.length - b.doc.title.length);
    return options.limit ? results.slice(0, options.limit) : results;
  }

  private scoreTerm(entry: IndexedDoc, term: string): { score: number; fromBody: boolean } {
    const title = fieldHit(entry.title, term);
    if (title === "exact") return { score: FIELD_SCORE.titleExact, fromBody: false };
    const keyword = fieldHit(entry.keywords, term);
    if (keyword === "exact") return { score: FIELD_SCORE.keywordExact, fromBody: false };
    if (title === "prefix") return { score: FIELD_SCORE.titlePrefix, fromBody: false };
    if (keyword === "prefix") return { score: FIELD_SCORE.keywordPrefix, fromBody: false };

    const subtitle = fieldHit(entry.subtitle, term);
    if (subtitle === "exact") return { score: FIELD_SCORE.subtitleExact, fromBody: false };
    if (subtitle === "prefix") return { score: FIELD_SCORE.subtitlePrefix, fromBody: false };

    if (bodyHit(entry.bodyLower, term)) return { score: FIELD_SCORE.bodyHit, fromBody: true };

    if (title === "fuzzy") return { score: FIELD_SCORE.titleFuzzy, fromBody: false };
    if (keyword === "fuzzy") return { score: FIELD_SCORE.keywordFuzzy, fromBody: false };
    return { score: 0, fromBody: false };
  }
}

/** Group results by kind, preserving rank order inside each group. */
export function groupResults(results: SearchResult[]): Map<SearchDoc["kind"], SearchResult[]> {
  const groups = new Map<SearchDoc["kind"], SearchResult[]>();
  for (const result of results) {
    const bucket = groups.get(result.doc.kind);
    if (bucket) bucket.push(result);
    else groups.set(result.doc.kind, [result]);
  }
  return groups;
}
