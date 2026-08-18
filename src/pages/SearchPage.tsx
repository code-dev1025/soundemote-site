// /search?q=… — the full-page counterpart to the ⌘K palette. Same index, same
// ranking; this one shows every hit, grouped, with per-kind filters and body
// snippets, and keeps the query in the URL so a search is a shareable link.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search } from "lucide-react";
import Nav from "@/components/soundemote/Nav";
import Footer from "@/components/soundemote/Footer";
import { KIND_LABEL, KIND_ORDER, useSiteSearch } from "@/search";
import type { SearchKind, SearchResult } from "@/search";
import { cn } from "@/lib/utils";

const EXAMPLES = ["sine wave", "reverb", "doppler", "bessel", "polyblep", "supersaw", "rgb", "limiter", "vactrol"];

const CARD_CLASS =
  "block rounded-lg border border-border/60 bg-card/30 p-4 transition-colors hover:border-scope/50 hover:bg-card/60";

function ResultCard({ result }: { result: SearchResult }) {
  const { doc, snippet } = result;
  const external = /^https?:\/\//.test(doc.url);

  const body = (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base text-foreground">{doc.title}</h3>
        {doc.category ? (
          <span className="mono text-[0.65rem] uppercase tracking-wider text-muted-foreground/70">{doc.category}</span>
        ) : null}
        {doc.live ? (
          <span className="mono rounded-sm border border-scope/50 bg-scope/10 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-scope">
            live
          </span>
        ) : null}
      </div>
      {doc.subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{doc.subtitle}</p> : null}
      {snippet && snippet !== doc.subtitle ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">{snippet}</p>
      ) : null}
      <p className="mono mt-2 text-[0.65rem] text-muted-foreground/60">{doc.url}</p>
    </>
  );

  return external ? (
    <a href={doc.url} target="_blank" rel="noopener noreferrer" className={CARD_CLASS}>
      {body}
    </a>
  ) : (
    <Link to={doc.url} className={CARD_CLASS}>
      {body}
    </Link>
  );
}

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [kind, setKind] = useState<SearchKind | "all">("all");

  // Back/forward navigation rewrites the box.
  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  const { results, loading, corpusSize } = useSiteSearch(query, { limit: 200 });

  const counts = useMemo(() => {
    const byKind = new Map<SearchKind, number>();
    for (const result of results) byKind.set(result.doc.kind, (byKind.get(result.doc.kind) || 0) + 1);
    return byKind;
  }, [results]);

  const visible = useMemo(
    () => (kind === "all" ? results : results.filter((result) => result.doc.kind === kind)),
    [kind, results],
  );

  const grouped = useMemo(() => {
    const groups = new Map<SearchKind, SearchResult[]>();
    for (const result of visible) {
      const bucket = groups.get(result.doc.kind);
      if (bucket) bucket.push(result);
      else groups.set(result.doc.kind, [result]);
    }
    return KIND_ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!] as const);
  }, [visible]);

  const trimmed = query.trim();

  return (
    <main className="relative z-10 min-h-screen text-foreground">
      <Helmet>
        <title>{trimmed ? `${trimmed} — soundemote search` : "Search — soundemote"}</title>
        <meta
          name="description"
          content="Search every soemdsp module, patch, live demo, article and wiki page on soundemote."
        />
        {trimmed ? <meta name="robots" content="noindex, follow" /> : null}
      </Helmet>
      <Nav />

      <div className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="display text-2xl">Search</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Modules, patches, live demos, explanations — {corpusSize.toLocaleString()} things indexed
          {loading ? " (still loading)" : ""}.
        </p>

        <form
          className="mt-6 flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-4 py-2 focus-within:border-scope/60"
          onSubmit={(event) => {
            event.preventDefault();
            setParams(trimmed ? { q: trimmed } : {}, { replace: false });
          }}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="sine wave, reverb, bessel, polyblep…"
            aria-label="Search soundemote"
            className="mono w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </form>

        {trimmed ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKind("all")}
              className={cn(
                "mono rounded-full border px-3 py-1 text-[0.7rem] transition-colors",
                kind === "all"
                  ? "border-scope/60 bg-scope/10 text-scope"
                  : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
              )}
            >
              all {results.length}
            </button>
            {KIND_ORDER.filter((k) => counts.get(k)).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "mono rounded-full border px-3 py-1 text-[0.7rem] transition-colors",
                  kind === k
                    ? "border-scope/60 bg-scope/10 text-scope"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground",
                )}
              >
                {KIND_LABEL[k].toLowerCase()} {counts.get(k)}
              </button>
            ))}
          </div>
        ) : null}

        {!trimmed ? (
          <div className="mt-8">
            <p className="mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/70">try</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setQuery(example);
                    setParams({ q: example });
                  }}
                  className="mono rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-scope/50 hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              Or browse the <Link to="/modules" className="text-scope underline underline-offset-4">module index</Link>{" "}
              — every module in the sandbox, by department.
            </p>
          </div>
        ) : visible.length ? (
          <div className="mt-8 space-y-8">
            {grouped.map(([groupKind, group]) => (
              <section key={groupKind}>
                <h2 className="mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
                  {KIND_LABEL[groupKind]}
                </h2>
                <div className="mt-3 space-y-3">
                  {group.map((result) => (
                    <ResultCard key={result.doc.id} result={result} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-lg border border-border/60 bg-card/30 p-6">
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading the index…" : `Nothing matched “${trimmed}”.`}
            </p>
            {!loading ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Try a nearby term —{" "}
                {EXAMPLES.slice(0, 4).map((example, i) => (
                  <span key={example}>
                    {i ? ", " : ""}
                    <button
                      type="button"
                      className="text-scope underline underline-offset-4"
                      onClick={() => {
                        setQuery(example);
                        setParams({ q: example });
                      }}
                    >
                      {example}
                    </button>
                  </span>
                ))}
                {" — or open the "}
                <button
                  type="button"
                  className="text-scope underline underline-offset-4"
                  onClick={() => navigate("/modules")}
                >
                  module index
                </button>
                .
              </p>
            ) : null}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
};

export default SearchPage;
