// Build step: writes public/sitemap.xml from what the site actually contains.
//
// The site's real surface area is far bigger than the handful of hand-written
// routes: 250+ module reference pages, a dozen long-form articles, the patch
// wiki. A crawler can't discover any of it from the SPA shell, so the sitemap
// has to be generated rather than maintained by hand.
//
// Sources are deliberately dumb: the generated engine index (JSON) plus a
// slug scrape of the two article data files. If a scrape comes back empty the
// script says so instead of silently shipping a shorter sitemap.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const siteUrl = "https://soundemote.io";

/** Hand-maintained: routes with no data file behind them. */
const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/sandbox", priority: "0.9", changefreq: "weekly" },
  { path: "/modules", priority: "0.9", changefreq: "weekly" },
  { path: "/search", priority: "0.5", changefreq: "monthly" },
  { path: "/wiki", priority: "0.7", changefreq: "weekly" },
  { path: "/learning-lab", priority: "0.7", changefreq: "monthly" },
  { path: "/gradient-curve", priority: "0.6", changefreq: "monthly" },
  { path: "/oscilloscope", priority: "0.6", changefreq: "monthly" },
  { path: "/changelog", priority: "0.5", changefreq: "weekly" },
  { path: "/webring", priority: "0.4", changefreq: "monthly" },
];

const read = (file) => readFileSync(path.join(root, file), "utf8");

/** `slug: "x"` occurrences in a data file, in order, deduped. */
function scrapeSlugs(file) {
  if (!existsSync(path.join(root, file))) return [];
  const matches = [...read(file).matchAll(/^\s{2,4}slug:\s*"([a-z0-9-]+)"/gm)];
  return [...new Set(matches.map((match) => match[1]))];
}

/** Keys of the `articleRoutes` / `patchRoutes` tables in src/config/site.ts. */
function scrapeRouteTable(source, table) {
  const start = source.indexOf(`${table}: {`);
  if (start < 0) return [];
  const end = source.indexOf("}", start);
  const block = source.slice(start, end);
  return [...block.matchAll(/^\s{4}"?([a-z0-9-]+)"?:/gm)].map((match) => match[1]);
}

function url(loc, priority, changefreq) {
  return [
    "  <url>",
    `    <loc>${siteUrl}${loc}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

function main() {
  const entries = STATIC_ROUTES.map((route) => url(route.path, route.priority, route.changefreq));
  const seen = new Set(STATIC_ROUTES.map((route) => route.path));
  const add = (loc, priority, changefreq = "monthly") => {
    if (seen.has(loc)) return;
    seen.add(loc);
    entries.push(url(loc, priority, changefreq));
  };

  const siteSource = existsSync(path.join(root, "src/config/site.ts")) ? read("src/config/site.ts") : "";
  const articleRoutes = scrapeRouteTable(siteSource, "articleRoutes");
  const patchRoutes = scrapeRouteTable(siteSource, "patchRoutes");
  if (!articleRoutes.length) console.warn("[sitemap] no articleRoutes found in src/config/site.ts");
  for (const route of articleRoutes) add(`/${route}`, "0.8", "weekly");
  for (const route of patchRoutes) add(`/${route}`, "0.7", "monthly");

  const patchArticles = scrapeSlugs("src/data/patchArticles.ts");
  if (!patchArticles.length) console.warn("[sitemap] no slugs scraped from src/data/patchArticles.ts");
  for (const slug of patchArticles) add(`/article/${slug}`, "0.8", "weekly");

  const indexFile = path.join(root, "public", "search", "engine-index.json");
  let modules = [];
  if (existsSync(indexFile)) {
    modules = JSON.parse(readFileSync(indexFile, "utf8")).modules || [];
  } else {
    console.warn("[sitemap] public/search/engine-index.json missing -- run `npm run search:index` first");
  }
  for (const module of modules) {
    add(`/module/${module.type}`, module.underConstruction ? "0.3" : "0.6");
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");

  writeFileSync(path.join(root, "public", "sitemap.xml"), xml, "utf8");
  console.log(
    `[sitemap] ${entries.length} urls ` +
      `(${modules.length} modules, ${patchArticles.length} patch articles, ${articleRoutes.length} articles) ` +
      "-> public/sitemap.xml",
  );
}

main();
