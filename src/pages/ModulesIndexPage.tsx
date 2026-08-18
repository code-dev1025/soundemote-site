// /modules — the whole catalog on one crawlable page, by department, with a
// local filter box for the "I know roughly what it's called" case. The ⌘K
// palette answers questions; this page answers "what is even in here".

import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search } from "lucide-react";
import Nav from "@/components/soundemote/Nav";
import Footer from "@/components/soundemote/Footer";
import { groupModulesByDepartment, useEngineIndex } from "@/search/useEngineIndex";
import { modulePath } from "@/search/links";
import { normalize } from "@/search/text";

const ModulesIndexPage = () => {
  const { index, loading } = useEngineIndex();
  const [filter, setFilter] = useState("");
  const deferred = useDeferredValue(filter);

  const groups = useMemo(() => {
    if (!index) return [];
    const all = groupModulesByDepartment(index);
    const needle = normalize(deferred);
    if (!needle) return all;
    return all
      .map((group) => ({
        ...group,
        modules: group.modules.filter((module) =>
          normalize(
            `${module.label} ${module.type} ${module.description} ${module.notes.join(" ")} ${module.categoryLabel}`,
          ).includes(needle),
        ),
      }))
      .filter((group) => group.modules.length);
  }, [deferred, index]);

  const total = index?.modules.length ?? 0;
  const shown = groups.reduce((sum, group) => sum + group.modules.length, 0);

  return (
    <main className="relative z-10 min-h-screen text-foreground">
      <Helmet>
        <title>Module index — soundemote</title>
        <meta
          name="description"
          content="Every module in the soemdsp sandbox: oscillators, filters, chaos, envelopes, scopes, RGB and more — each with its own page."
        />
        <link rel="canonical" href="https://soundemote.io/modules" />
      </Helmet>
      <Nav />

      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="display text-2xl">Module index</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {loading ? "Loading the catalog…" : `${total} modules in the sandbox, by department.`}{" "}
          <Link to="/search" className="text-scope underline underline-offset-4">
            Search everything
          </Link>{" "}
          instead.
        </p>

        <div className="mt-6 flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-4 py-2 focus-within:border-scope/60">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="filter modules…"
            aria-label="Filter modules"
            className="mono w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {filter ? (
            <span className="mono shrink-0 text-xs text-muted-foreground">{shown}</span>
          ) : null}
        </div>

        {!loading && !index ? (
          <p className="mt-10 text-sm text-muted-foreground">
            The module catalog could not be loaded. Try the{" "}
            <Link to="/sandbox" className="text-scope underline underline-offset-4">
              sandbox
            </Link>{" "}
            directly.
          </p>
        ) : null}

        <div className="mt-10 space-y-10">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="display text-lg">
                {group.emoji ? <span className="mr-2">{group.emoji}</span> : null}
                {group.title}
                <span className="mono ml-2 text-xs text-muted-foreground">{group.modules.length}</span>
              </h2>
              {group.pitch ? <p className="mt-1 text-sm text-muted-foreground">{group.pitch}</p> : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {group.modules.map((module) => (
                  <Link
                    key={module.type}
                    to={modulePath(module.type)}
                    className="block rounded-lg border border-border/60 bg-card/30 p-3 transition-colors hover:border-scope/50 hover:bg-card/60"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-foreground">{module.label}</span>
                      {module.native ? (
                        <span className="mono shrink-0 text-[0.6rem] uppercase tracking-wider text-scope">native</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {module.description}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {!loading && index && !groups.length ? (
          <p className="mt-10 text-sm text-muted-foreground">
            Nothing matches “{filter}”. Try{" "}
            <Link to={`/search?q=${encodeURIComponent(filter)}`} className="text-scope underline underline-offset-4">
              searching the whole site
            </Link>
            .
          </p>
        ) : null}
      </div>

      <Footer />
    </main>
  );
};

export default ModulesIndexPage;
