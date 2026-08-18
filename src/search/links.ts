// Where a thing lives. One place decides the canonical URL for a module, a
// patch article, or a shipped patch file, so the palette, /search, the module
// pages and the sitemap generator can never disagree.

import { siteConfig } from "@/config/site";
import { PATCH_ARTICLES } from "@/data/patchArticles";

/** /module/polyBlep — the reference page for one module. */
export const modulePath = (type: string) => `/module/${type}`;

/** /article/sinewave — a patch wiki article. */
export const articlePath = (slug: string) => `/article/${slug}`;

const patchFileSlug = (patchUrl: string) => patchUrl.replace(/^.*\//, "").replace(/\.json$/, "");

/** Patch-file slug -> the article that embeds it, e.g. "sinewave" -> /article/sinewave. */
const ARTICLE_BY_PATCH = new Map<string, string>(
  PATCH_ARTICLES.filter((article) => article.patchUrl).map((article) => [
    patchFileSlug(article.patchUrl as string),
    articlePath(article.slug),
  ]),
);

/**
 * The best page for a shipped patch file: its own site route when it has one
 * (`/reverb`), otherwise the article that embeds it. `null` when the patch has
 * no destination worth linking to.
 */
export function patchUrlFor(slug: string): string | null {
  for (const [path, target] of Object.entries(siteConfig.patchRoutes)) {
    if (target === slug) return `/${path}`;
  }
  return ARTICLE_BY_PATCH.get(slug) ?? null;
}

/** Patch-file slug -> a human label, falling back to the slug itself. */
export function patchLabelFor(slug: string): string {
  const article = PATCH_ARTICLES.find((entry) => entry.patchUrl && patchFileSlug(entry.patchUrl) === slug);
  return article?.title ?? slug;
}
