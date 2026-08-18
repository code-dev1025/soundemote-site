// /module/:type — the destination a module search lands on.
//
// Before this page existed, "bessel" had nowhere to go: the module catalog
// only lived inside the sandbox's own browser UI. Now every one of the 250+
// modules has a crawlable URL that says what it is, what department it lives
// in, which shipped patches use it, where its C++ source is, and what else in
// the catalog is like it.

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Nav from "@/components/soundemote/Nav";
import Footer from "@/components/soundemote/Footer";
import { groupModulesByDepartment, useEngineIndex } from "@/search/useEngineIndex";
import { modulePath, patchLabelFor, patchUrlFor } from "@/search/links";
import type { EngineModule } from "@/search";

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="mono rounded-sm border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
    {children}
  </span>
);

const ModulePage = () => {
  const { type = "" } = useParams<{ type: string }>();
  const { index, loading } = useEngineIndex();

  const module = useMemo<EngineModule | null>(() => {
    if (!index) return null;
    const wanted = type.toLowerCase();
    return index.modules.find((entry) => entry.type.toLowerCase() === wanted) ?? null;
  }, [index, type]);

  const siblings = useMemo(() => {
    if (!index || !module) return [];
    return index.modules
      .filter((entry) => entry.category === module.category && entry.type !== module.type)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 12);
  }, [index, module]);

  if (loading) {
    return (
      <main className="relative z-10 min-h-screen text-foreground">
        <Nav />
        <div className="container mx-auto max-w-3xl px-4 py-24">
          <p className="mono text-sm text-muted-foreground">loading module…</p>
        </div>
      </main>
    );
  }

  if (!module) {
    const departments = index ? groupModulesByDepartment(index) : [];
    return (
      <main className="relative z-10 min-h-screen text-foreground">
        <Helmet>
          <title>No module named {type} — soundemote</title>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <Nav />
        <div className="container mx-auto max-w-2xl px-4 py-24 text-center">
          <p className="mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
          <h1 className="display mt-3 text-3xl">No module called “{type}”</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {departments.length
              ? "It may have been renamed. The full catalog is one click away."
              : "The module catalog could not be loaded."}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link to="/modules" className="mono text-sm text-scope underline underline-offset-4">
              module index
            </Link>
            <Link to={`/search?q=${encodeURIComponent(type)}`} className="mono text-sm text-scope underline underline-offset-4">
              search for “{type}”
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const title = `${module.label} — soundemote module`;
  const description = module.description || `${module.label}, a ${module.categoryLabel} module in the soemdsp sandbox.`;

  return (
    <main className="relative z-10 min-h-screen text-foreground">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`https://soundemote.io${modulePath(module.type)}`} />
        <link rel="canonical" href={`https://soundemote.io${modulePath(module.type)}`} />
      </Helmet>
      <Nav />

      <article className="container mx-auto max-w-3xl px-4 py-12">
        <nav className="mono text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/modules" className="hover:text-foreground">
            modules
          </Link>
          <span className="px-1.5 text-muted-foreground/50">/</span>
          <span className="text-muted-foreground/80">{module.categoryLabel.toLowerCase()}</span>
        </nav>

        <header className="mt-4">
          <h1 className="display text-3xl">{module.label}</h1>
          <p className="mono mt-1 text-xs text-muted-foreground">{module.type}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="mono rounded-sm border border-accent/50 bg-accent/10 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-accent">
              {module.categoryLabel}
            </span>
            {module.native ? (
              <span className="mono rounded-sm border border-scope/50 bg-scope/10 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-scope">
                native c++ · wasm
              </span>
            ) : null}
            {module.underConstruction ? (
              <span className="mono rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                under construction
              </span>
            ) : null}
          </div>
        </header>

        <p className="mt-6 text-base leading-relaxed text-muted-foreground">{description}</p>

        {module.notes.length ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {module.notes.map((note) => (
              <Tag key={note}>{note}</Tag>
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/sandbox"
            className="mono rounded-full border border-scope/50 bg-scope/10 px-4 py-2 text-sm text-scope transition-colors hover:bg-scope/20"
          >
            open the sandbox
          </Link>
          {module.sourceUrl ? (
            <a
              href={module.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono rounded-full border border-border/60 bg-muted/20 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              read the C++ source
            </a>
          ) : null}
          {module.libUrl ? (
            <a
              href={module.libUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono rounded-full border border-border/60 bg-muted/20 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              upstream library
            </a>
          ) : null}
        </div>

        {module.patches.length ? (
          <section className="mt-10">
            <h2 className="mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">Hear it</h2>
            <ul className="mt-3 space-y-2">
              {module.patches.map((slug) => {
                const url = patchUrlFor(slug);
                return (
                  <li key={slug}>
                    {url ? (
                      <Link
                        to={url}
                        className="block rounded-lg border border-border/60 bg-card/30 px-4 py-3 text-sm transition-colors hover:border-scope/50 hover:bg-card/60"
                      >
                        {patchLabelFor(slug)}
                        <span className="mono ml-2 text-xs text-muted-foreground">{url}</span>
                      </Link>
                    ) : (
                      <span className="mono block rounded-lg border border-border/60 bg-card/20 px-4 py-3 text-sm text-muted-foreground">
                        {slug}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {siblings.length ? (
          <section className="mt-10">
            <h2 className="mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
              More {module.categoryLabel.toLowerCase()}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {siblings.map((sibling) => (
                <Link
                  key={sibling.type}
                  to={modulePath(sibling.type)}
                  className="mono rounded-full border border-border/60 bg-muted/20 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-scope/50 hover:text-foreground"
                >
                  {sibling.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12 border-t border-border/40 pt-6">
          <Link
            to={`/search?q=${encodeURIComponent(module.label)}`}
            className="mono text-sm text-scope underline underline-offset-4"
          >
            everything on the site about {module.label.toLowerCase()} →
          </Link>
        </section>
      </article>

      <Footer />
    </main>
  );
};

export default ModulePage;
