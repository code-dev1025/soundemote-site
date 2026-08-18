// Text plumbing for the search engine: how a string becomes tokens, how two
// tokens are judged close enough, and how a body match becomes a snippet.
//
// The corpus is full of camelCase module types (polyBlep, besselThomson) and
// the queries people type are spaced words ("poly blep", "bessel filter"), so
// tokenizing splits camelCase apart AND keeps a joined form of every adjacent
// pair. "sine wave" and "sinewave" and "sineWavetable" all land on shared
// tokens without any per-term configuration.

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "how",
  "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "then",
  "this", "to", "was", "what", "when", "which", "with", "you", "your",
]);

/** Lowercase, strip accents, and reduce anything non-alphanumeric to a space. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** polyBlep -> "poly Blep", RGBShape -> "RGB Shape", saw2 -> "saw 2". */
export function splitCamel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-zA-Z])([0-9])/g, "$1 $2");
}

/** Crude singularizer: filters -> filter, bass -> bass, oscs -> osc. */
export function stem(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/**
 * Tokens for one piece of text. `joinPairs` also emits the concatenation of
 * each adjacent pair, so a doc titled "Sine Wave" is findable as "sinewave"
 * (and vice versa, since queries are tokenized the same way).
 */
export function tokenize(value: string, { joinPairs = true, dropStopWords = false } = {}): string[] {
  const words = normalize(splitCamel(value)).split(" ").filter(Boolean);
  const kept = dropStopWords ? words.filter((word) => !STOP_WORDS.has(word)) : words;
  if (!joinPairs || kept.length < 2) return kept;
  const joined: string[] = [];
  for (let i = 0; i < kept.length - 1; i++) {
    const pair = kept[i] + kept[i + 1];
    if (pair.length <= 24) joined.push(pair);
  }
  return [...kept, ...joined];
}

/** Query tokens: stop words dropped, whole-query concatenation appended. */
export function tokenizeQuery(value: string): string[] {
  const words = normalize(splitCamel(value)).split(" ").filter(Boolean);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  const base = meaningful.length ? meaningful : words;
  if (base.length < 2) return base;
  const glued = base.join("");
  return glued.length <= 24 ? [...base, glued] : base;
}

/** True when `b` is within one edit of `a`. Cheap bounded Levenshtein. */
export function isNearMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const lengthDelta = a.length - b.length;
  if (lengthDelta > 1 || lengthDelta < -1) return false;
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diffs > 1) return false;
    }
    return diffs === 1;
  }
  const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i++;
      j++;
      continue;
    }
    if (skipped) return false;
    skipped = true;
    i++;
  }
  return true;
}

/** A short body excerpt centered on the first occurrence of `term`. */
export function makeSnippet(body: string, term: string, radius = 90): string | undefined {
  const haystack = body.toLowerCase();
  const at = haystack.indexOf(term.toLowerCase());
  if (at < 0) return undefined;
  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + term.length + radius);
  const text = body
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim();
  return `${start > 0 ? "…" : ""}${text}${end < body.length ? "…" : ""}`;
}

/** Markdown -> plain-ish text, so bodies index words instead of syntax. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[#>\-*+\s]+/gm, " ")
    .replace(/[*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
