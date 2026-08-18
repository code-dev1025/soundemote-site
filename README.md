# soundemote

**soundemote.io** — the production site. Real accounts, a real DSP sandbox
running in the browser, and a growing wiki of patch articles that read more
like documentation than blog posts.

## What lives here

- **Site-wide search** ([`src/search/`](src/search/)) — one box that answers
  with everything: type `sine wave` and you get the sine oscillators, the
  patches built from them, the live demo, and the article that explains the
  physics. ⌘K / `/` from any page, or the full page at
  [`/search`](src/pages/SearchPage.tsx). Every module has its own page at
  [`/module/<type>`](src/pages/ModulePage.tsx); the whole catalog is at
  [`/modules`](src/pages/ModulesIndexPage.tsx).
- **The sandbox** ([`SandboxPage.tsx`](src/pages/SandboxPage.tsx)) — the
  soemdsp modular DSP engine, embedded live. Every signal on screen is an
  equation evaluated fresh every sample, not a recording — this is SVG for
  audio.
- **Patch articles** ([`PatchArticlePage.tsx`](src/pages/PatchArticlePage.tsx),
  [`FeaturedArticlePage.tsx`](src/pages/FeaturedArticlePage.tsx)) — GitHub
  README meets Wikipedia. Each one explains a patch by walking through the
  physics of the modules that make it up.
- **The wiki** ([`WikiPage.tsx`](src/pages/WikiPage.tsx),
  [`WikiArticlePage.tsx`](src/pages/WikiArticlePage.tsx)) — community-editable,
  moderated through the admin tools below.
- **User space** ([`UserPage.tsx`](src/pages/UserPage.tsx),
  [`FilesPage.tsx`](src/pages/FilesPage.tsx)) — `/:handle`, `/:handle/:bank`,
  `/:handle/:bank/:patch` — every user gets a bank of patches at a URL.
- **The video engine's first module** —
  [`gradient-curve-widget`](src/good-code/gradient-curve-widget/), live at
  [`/gradient-curve`](src/pages/GradientCurvePage.tsx). Same idea as the
  audio side: a dot drawn from a curve instead of a stored image. The falloff
  handles reshape the curve; the render is just the curve, evaluated.
- **Bezier control surface** ([`public/apps/bezier-controls/`](public/apps/bezier-controls/)) —
  interactive cubic graph editor, embedded on the home page under the gradient
  widget (`?embed=1`). Full page at `/apps/bezier-controls/index.html`.
- **Scratch space** ([`src/good-code/`](src/good-code/)) — vendored or
  in-progress widgets that haven't earned a permanent home yet.
- **Admin** ([`AdminDashboard.tsx`](src/pages/AdminDashboard.tsx) and
  friends) — wiki edit review, user management, claims.

## Stack

React + Vite + TypeScript, `react-router-dom` for routing, Tailwind for
styling, Supabase for auth/data.

```
npm install
npm run dev
```

## Site-wide search

Three moving parts:

1. **The corpus** ([`src/search/sources.ts`](src/search/sources.ts)) — site
   routes and live demos are bundled; module catalog, article bodies, article
   sections, wiki pages and named patches load in the background on first use.
   Adding a source means adding one builder function there.
2. **The ranking** ([`src/search/engine.ts`](src/search/engine.ts)) — title →
   keywords → subtitle → body, with camelCase splitting, plurals, one-typo
   tolerance, and a DSP synonym table
   ([`src/search/aliases.ts`](src/search/aliases.ts)) so `anti aliasing` finds
   PolyBLEP and `linear phase` finds the Bessel filter. Expansions score at a
   discount, so a literal hit always wins.
3. **The generated index** (`public/search/engine-index.json`) — the vendored
   sandbox engine's module catalog, flattened to JSON by
   [`scripts/generate-search-index.mjs`](scripts/generate-search-index.mjs).
   It reads (never edits) `public/soemdsp-sandbox/`, so after dropping in a new
   sandbox build:

   ```
   npm run search:index   # rebuild the module corpus
   npm run sitemap        # rebuild public/sitemap.xml from it
   ```

   Both run automatically as part of `npm run build`. Commit the output.

[`src/search/search.test.ts`](src/search/search.test.ts) asserts the promise the
feature makes — search `bessel`, get the Bessel-Thomson filter — against the
real corpus, so a rename breaks the test before it breaks the search box.

## Routing convention

All routes live in [`src/App.tsx`](src/App.tsx). New pages go above the
`*` catch-all. Curated content (patch articles, featured articles) resolves
both dashed and non-dashed slugs to the same route where there's no
conflict with an existing one.
