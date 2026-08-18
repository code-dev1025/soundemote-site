// Site-wide search, mounted in the Nav on every page.
//
// One query hits every kind of thing the site knows about at once -- modules,
// patches you can hear, the article that explains the idea, the section inside
// that article, wiki pages, routes. cmdk drives the list (keyboard nav, ARIA)
// with its own filtering turned off: ranking is ours, in src/search/engine.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { KIND_LABEL, KIND_ORDER, prefetchSearchIndex, useSiteSearch } from "@/search";
import type { SearchResult } from "@/search";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["sine wave", "reverb", "bessel", "polyblep", "supersaw", "rgb", "limiter", "chaos"];

/** Kind badge text -- singular, since it labels one row. */
const KIND_TAG: Record<SearchResult["doc"]["kind"], string> = {
  module: "module",
  patch: "patch",
  demo: "live",
  article: "explains",
  section: "section",
  wiki: "wiki",
  page: "page",
};

function ResultRow({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}) {
  const { doc, snippet } = result;
  return (
    <CommandItem
      value={doc.id}
      onSelect={() => onSelect(result)}
      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 aria-selected:bg-muted/50"
    >
      <span
        className={cn(
          "mono mt-0.5 shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider",
          doc.live
            ? "border-scope/50 bg-scope/10 text-scope"
            : "border-border/60 bg-muted/30 text-muted-foreground",
        )}
      >
        {KIND_TAG[doc.kind]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm text-foreground">{doc.title}</span>
          {doc.category ? (
            <span className="mono shrink-0 truncate text-[0.65rem] text-muted-foreground/70">{doc.category}</span>
          ) : null}
        </span>
        {doc.subtitle || snippet ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{doc.subtitle || snippet}</span>
        ) : null}
      </span>
    </CommandItem>
  );
}

export function SearchResultsList({
  query,
  results,
  loading,
  onSelect,
  onSeeAll,
}: {
  query: string;
  results: SearchResult[];
  loading: boolean;
  onSelect: (result: SearchResult) => void;
  onSeeAll: () => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<SearchResult["doc"]["kind"], SearchResult[]>();
    for (const result of results) {
      const bucket = groups.get(result.doc.kind);
      if (bucket) bucket.push(result);
      else groups.set(result.doc.kind, [result]);
    }
    return KIND_ORDER.filter((kind) => groups.has(kind)).map((kind) => [kind, groups.get(kind)!] as const);
  }, [results]);

  return (
    <CommandList className="max-h-[60vh]">
      {query.trim() && !results.length ? (
        <CommandEmpty className="px-4 py-8 text-center text-sm text-muted-foreground">
          {loading ? "still loading the index…" : `nothing for “${query}” yet.`}
        </CommandEmpty>
      ) : null}

      {grouped.map(([kind, group]) => (
        <CommandGroup key={kind} heading={KIND_LABEL[kind]} className="mono [&_[cmdk-group-heading]]:text-[0.65rem] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest">
          {group.map((result) => (
            <ResultRow key={result.doc.id} result={result} onSelect={onSelect} />
          ))}
        </CommandGroup>
      ))}

      {results.length ? (
        <CommandGroup>
          <CommandItem
            value="__see_all__"
            onSelect={onSeeAll}
            className="mono cursor-pointer justify-center rounded-md px-2 py-2 text-xs text-muted-foreground aria-selected:bg-muted/50"
          >
            see all results for “{query.trim()}”
          </CommandItem>
        </CommandGroup>
      ) : null}
    </CommandList>
  );
}

export function SiteSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { results, loading } = useSiteSearch(query, { limit: 24, enabled: open });

  // ⌘K / Ctrl-K anywhere; "/" when the caret isn't already in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
        return;
      }
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = useCallback(
    (url: string) => {
      setOpen(false);
      setQuery("");
      if (/^https?:\/\//.test(url)) window.open(url, "_blank", "noopener,noreferrer");
      else navigate(url);
    },
    [navigate],
  );

  const seeAll = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    go(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [go, query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={prefetchSearchIndex}
        onFocus={prefetchSearchIndex}
        aria-label="Search soundemote"
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-1.5 text-muted-foreground transition-colors hover:border-scope/50 hover:text-foreground",
          className,
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="mono hidden text-[0.7rem] sm:inline">search</span>
        <kbd className="mono hidden rounded border border-border/60 bg-background/60 px-1 text-[0.6rem] text-muted-foreground/80 md:inline">
          /
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">Search soundemote</DialogTitle>
          <DialogDescription className="sr-only">
            Search every module, patch, live demo, article and wiki page on the site.
          </DialogDescription>
          <Command shouldFilter={false} loop className="bg-transparent">
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="sine wave, reverb, bessel, polyblep…"
              className="mono text-sm"
            />
            {query.trim() ? (
              <SearchResultsList
                query={query}
                results={results}
                loading={loading}
                onSelect={(result) => go(result.doc.url)}
                onSeeAll={seeAll}
              />
            ) : (
              <div className="px-4 py-6">
                <p className="mono text-[0.65rem] uppercase tracking-widest text-muted-foreground/70">try</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setQuery(suggestion)}
                      className="mono rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-scope/50 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <p className="mt-5 text-xs text-muted-foreground">
                  Every module, patch, live demo, article and wiki page on the site — one box.
                </p>
              </div>
            )}
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SiteSearch;
