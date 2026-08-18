// Where the search corpus comes from.
//
// Three tiers, loaded in this order so the palette is useful immediately and
// gets deeper as data arrives:
//
//   1. static  — site routes + curated shortcuts. Available synchronously.
//   2. content — every article body, plus the engine's module catalog, which
//      is a generated JSON file fetched on first use rather than bundled
//      (250+ modules of description text nobody needs until they search).
//   3. live    — Supabase wiki pages and named page patches. Best effort:
//      if Supabase isn't configured or the request fails, search still works.
//
// Every builder returns plain SearchDocs. Adding a source means adding a
// builder here -- the engine and the UI don't change.

import { extractChapters } from "@/components/soundemote/TableOfContents";
import { PATCH_ARTICLES } from "@/data/patchArticles";
import { featuredArticles } from "@/data/featuredArticles";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { articlePath, modulePath, patchLabelFor, patchUrlFor } from "./links";
import { stripMarkdown } from "./text";
import type { SearchDoc } from "./types";

export type EngineModule = {
  type: string;
  label: string;
  category: string;
  categoryLabel: string;
  description: string;
  notes: string[];
  native: boolean;
  sourceUrl: string;
  libUrl: string;
  underConstruction: boolean;
  patches: string[];
};

export type EnginePatch = {
  slug: string;
  title: string;
  description: string;
  url: string;
  modules: string[];
};

export type EngineIndex = {
  version: number;
  departments: { id: string; label: string; title: string; emoji: string; pitch: string }[];
  modules: EngineModule[];
  patches: EnginePatch[];
};

/** Longest article body we index. Fork READMEs run long; the tail is credits. */
const MAX_BODY_CHARS = 60_000;

// --- tier 1: static site map ------------------------------------------------

type StaticPage = {
  url: string;
  title: string;
  subtitle: string;
  keywords: string[];
  live?: boolean;
  boost?: number;
};

const STATIC_PAGES: StaticPage[] = [
  {
    url: "/",
    title: "soundemote",
    subtitle: "Analog feel, digital precision, phosphor glow — one instrument.",
    keywords: ["home", "front page", "start"],
    boost: 2,
  },
  {
    url: "/sandbox",
    title: "Sandbox",
    subtitle: "The soemdsp modular DSP engine, live in the browser.",
    keywords: ["playground", "patch", "modular", "editor", "live", "try", "demo", "audio"],
    live: true,
    boost: 4,
  },
  {
    url: "/modules",
    title: "Module index",
    subtitle: "Every module in the sandbox, by department.",
    keywords: ["modules", "catalog", "browser", "index", "reference", "all"],
    boost: 3,
  },
  {
    url: "/wiki",
    title: "Wiki",
    subtitle: "Community-editable pages for named patches.",
    keywords: ["wiki", "articles", "docs", "community"],
    boost: 1,
  },
  {
    url: "/learning-lab",
    title: "Learning Lab",
    subtitle: "Signal-theory explainers with the scope running.",
    keywords: ["learn", "teaching", "theory", "lab", "education", "tutorial"],
    live: true,
  },
  {
    url: "/gradient-curve",
    title: "Gradient Curve",
    subtitle: "A dot drawn from a curve — the video engine's first module.",
    keywords: ["gradient", "curve", "falloff", "video", "visual", "widget", "rgb"],
    live: true,
  },
  {
    url: "/oscilloscope",
    title: "Oscilloscope",
    subtitle: "Phosphor-trace scope rendering, full page.",
    keywords: ["scope", "oscilloscope", "xy", "vector", "phosphor", "crt", "trace"],
    live: true,
  },
  {
    url: "/changelog",
    title: "Changelog",
    subtitle: "Notable updates across the soundemote projects.",
    keywords: ["changelog", "releases", "updates", "news", "history", "version"],
  },
  {
    url: "/webring",
    title: "Webring",
    subtitle: "Friends and adjacent creative-tech projects.",
    keywords: ["webring", "links", "friends", "community"],
  },
  {
    url: "/files",
    title: "Files",
    subtitle: "Your uploaded samples and assets.",
    keywords: ["files", "uploads", "samples", "assets", "storage"],
  },
  {
    url: "/auth",
    title: "Sign in",
    subtitle: "Accounts, patch banks, and your own URL space.",
    keywords: ["login", "signin", "signup", "account", "register"],
  },
];

/** Playable routes that load a patch with audio armed. */
const LIVE_DEMOS: { url: string; title: string; subtitle: string; keywords: string[] }[] = [
  {
    url: "/reverb-live",
    title: "Reverb (live demo)",
    subtitle: "The reverb patch, running, with audio armed.",
    keywords: ["reverb", "space", "room", "demo", "live", "playable", "hear"],
  },
  {
    url: "/silentlydreaming-live",
    title: "Silently Dreaming (live demo)",
    subtitle: "A full patch playing itself in the browser.",
    keywords: ["silently dreaming", "demo", "live", "playable", "song"],
  },
  {
    url: "/shootingstar-live",
    title: "Shooting Star (live demo)",
    subtitle: "Chaos generator triggered by a shooting-star explosion.",
    keywords: ["shooting star", "chaos", "demo", "live", "playable", "trigger"],
  },
];

function staticDocs(): SearchDoc[] {
  const docs: SearchDoc[] = STATIC_PAGES.map((page) => ({
    id: `page:${page.url}`,
    kind: "page",
    title: page.title,
    subtitle: page.subtitle,
    keywords: page.keywords,
    url: page.url,
    category: "Site",
    live: page.live,
    boost: page.boost,
  }));

  for (const demo of LIVE_DEMOS) {
    docs.push({
      id: `demo:${demo.url}`,
      kind: "demo",
      title: demo.title,
      subtitle: demo.subtitle,
      keywords: demo.keywords,
      url: demo.url,
      category: "Live demo",
      live: true,
      boost: 1,
    });
  }
  return docs;
}

// --- tier 2: engine catalog -------------------------------------------------

export function moduleDocs(index: EngineIndex): SearchDoc[] {
  return index.modules.map((module) => ({
    id: `module:${module.type}`,
    kind: "module",
    title: module.label,
    subtitle: module.description,
    // Patch names go in the body, not the keywords: a module that merely
    // appears in the reverb patch shouldn't rank as a "reverb" module.
    body: module.patches.length
      ? `${module.description} Used in patches: ${module.patches.join(", ")}.`
      : module.description,
    keywords: [
      module.type,
      module.categoryLabel,
      ...module.notes,
      ...(module.native ? ["native", "c++", "wasm", "source"] : []),
      ...(module.underConstruction ? ["under construction", "wip"] : []),
    ],
    url: modulePath(module.type),
    category: module.categoryLabel,
    live: module.patches.length > 0,
    boost: module.underConstruction ? 0 : 1,
    meta: {
      type: module.type,
      native: module.native,
      underConstruction: module.underConstruction,
      patches: module.patches,
      sourceUrl: module.sourceUrl,
    },
  }));
}

export function patchDocs(index: EngineIndex): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const patch of index.patches) {
    const url = patchUrlFor(patch.slug);
    if (!url) continue; // No destination that plays it -- don't offer a dead end.
    docs.push({
      id: `patch:${patch.slug}`,
      kind: "patch",
      // patch.info.title is whatever the patch was last saved as in the
      // sandbox ("ellipsoid"), which is rarely what the patch is called on
      // the site -- prefer the name its page uses.
      title: patchLabelFor(patch.slug),
      subtitle: patch.description || `Patch built from ${patch.modules.length} modules.`,
      body: [patch.title, patch.description, patch.modules.join(" ")].filter(Boolean).join(" "),
      keywords: [patch.slug, "patch", "preset"],
      url,
      category: "Patch",
      live: true,
      boost: 1,
      meta: { slug: patch.slug, modules: patch.modules },
    });
  }
  return docs;
}

// --- tier 2: articles -------------------------------------------------------

/**
 * Patch wiki articles (src/data/patchArticles.ts) and the long-form featured
 * articles (src/data/featuredArticles.ts), each split into one doc for the
 * article and one per `##` section so a query can land on the right chapter.
 */
export function articleDocs(): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const article of PATCH_ARTICLES) {
    const url = articlePath(article.slug);
    // Badges and facts are short sentences, not tags -- indexing them as
    // keywords would score a passing mention as high as a real title match.
    const facts = [
      ...article.badges.map((badge) => `${badge.label} ${badge.value}`),
      ...article.facts.map((fact) => `${fact.label} ${fact.value}`),
    ].join(". ");
    const body = `${facts}. ${stripMarkdown(article.body)}`.slice(0, MAX_BODY_CHARS);
    docs.push({
      id: `article:${article.slug}`,
      kind: "article",
      title: article.title,
      subtitle: article.tagline,
      body,
      keywords: [article.slug, article.category, "explanation", "wiki"],
      url,
      category: article.category,
      live: article.status === "live",
      boost: 3,
      meta: { slug: article.slug, status: article.status, patchUrl: article.patchUrl },
    });
    docs.push(...sectionDocs(article.title, url, article.body, article.slug));
  }

  for (const article of featuredArticles) {
    const url = `/${article.slug}`;
    docs.push({
      id: `featured:${article.slug}`,
      kind: "article",
      title: article.title,
      subtitle: article.tagline,
      body: stripMarkdown(article.markdown).slice(0, MAX_BODY_CHARS),
      keywords: [article.slug, "article", "explanation", "readme", "research", article.emoji],
      url,
      category: "Article",
      boost: 3,
      meta: { slug: article.slug, sourceUrl: article.sourceUrl },
    });
    docs.push(...sectionDocs(article.title, url, article.markdown, article.slug));
  }

  return docs;
}

function sectionDocs(articleTitle: string, articleUrl: string, markdown: string, slug: string): SearchDoc[] {
  const chapters = extractChapters(markdown);
  if (!chapters.length) return [];
  const plain = markdown.split(/^##\s+.+$/gm);
  return chapters.map((chapter, i) => ({
    id: `section:${slug}:${chapter.anchor || i}`,
    kind: "section",
    title: chapter.label,
    subtitle: `In ${articleTitle}`,
    body: stripMarkdown(plain[i + 1] || "").slice(0, 6_000),
    keywords: [slug, articleTitle, "section", "chapter"],
    url: `${articleUrl}#${chapter.anchor}`,
    category: articleTitle,
    meta: { slug, anchor: chapter.anchor },
  }));
}

// --- tier 3: live data ------------------------------------------------------

/** Supabase-backed pages. Never throws: search degrades, it doesn't break. */
async function liveDocs(): Promise<SearchDoc[]> {
  try {
    if (supabaseConfigError) return [];
    const [wiki, patches] = await Promise.all([
      supabase.from("wiki_pages").select("slug, title, body").limit(500),
      supabase.from("page_patches").select("slug, updated_at").limit(500),
    ]);

    const docs: SearchDoc[] = [];
    for (const row of (wiki.data as { slug: string; title: string | null; body: string | null }[]) || []) {
      docs.push({
        id: `wiki:${row.slug}`,
        kind: "wiki",
        title: row.title || row.slug,
        subtitle: "Community wiki page",
        body: stripMarkdown(row.body || "").slice(0, MAX_BODY_CHARS),
        keywords: [row.slug, "wiki", "community"],
        url: `/wiki/${row.slug}`,
        category: "Wiki",
      });
    }
    for (const row of (patches.data as { slug: string }[]) || []) {
      docs.push({
        id: `pagepatch:${row.slug}`,
        kind: "patch",
        title: row.slug,
        subtitle: "Named patch — opens live in the sandbox",
        keywords: [row.slug, "patch", "named", "live", "sandbox"],
        url: `/patch/${row.slug}`,
        category: "Named patch",
        live: true,
      });
    }
    return docs;
  } catch {
    return [];
  }
}

// --- assembly ---------------------------------------------------------------

export async function fetchEngineIndex(signal?: AbortSignal): Promise<EngineIndex | null> {
  try {
    const response = await fetch("/search/engine-index.json", { signal });
    if (!response.ok) return null;
    return (await response.json()) as EngineIndex;
  } catch {
    return null;
  }
}

/** Instant docs, available before any network work. */
export function coreDocs(): SearchDoc[] {
  return staticDocs();
}

/** Everything else, in one pass. Failures in one tier don't sink the others. */
export async function extendedDocs(): Promise<SearchDoc[]> {
  const [engine, live] = await Promise.all([fetchEngineIndex(), liveDocs()]);

  const docs: SearchDoc[] = [...articleDocs(), ...live];
  if (engine) {
    docs.push(...moduleDocs(engine), ...patchDocs(engine));
  }
  return docs;
}
