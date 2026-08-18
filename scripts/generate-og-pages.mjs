// Post-build step: writes a static, crawler-friendly index.html for each
// patch wiki route (dist/<slug>/index.html) with page-specific
// title/description/OpenGraph/Twitter meta tags.
//
// Why this exists: Discord, Twitter, Slack, etc. link-preview bots fetch the
// URL and read <meta> tags straight out of the initial HTML response -- they
// do not run JavaScript, so a client-side React Router title/meta update
// (see PatchArticlePage's document.title effect) is invisible to them. Every
// route would otherwise show the same homepage OG tags.
//
// The fix: most static hosts (Lovable's included, most likely, since it's
// the standard convention) serve a physical <path>/index.html file for a
// request to <path> before falling back to the SPA's catch-all index.html.
// So we duplicate the built index.html once per route, swapping only the
// <head> meta values -- the <div id="root"> + script tags are untouched, so
// a real browser hitting the page still boots the normal React app and
// client-side-routes exactly as before. Crawlers just see the right meta on
// the very first byte.
//
// If the host does NOT prioritize static files over the SPA catch-all, this
// is a no-op: requests still resolve to the root index.html exactly as they
// did before this script existed. No regression either way.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, "..", "dist");
const siteUrl = "https://soundemote.io";
const defaultImage =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/EYgj1zfmybWdSJ37FVpPSkoh0wg1/social-images/social-1779702811269-soundemote_logo_youtube_800x800_transparent.webp";

// Keep in sync with src/data/patchArticles.ts -- this is a plain .mjs
// script (no TS loader in the postbuild step), so the title/tagline pairs
// are duplicated here rather than imported directly.
const PAGES = [
  { slug: "sandbox", title: "Sandbox", tagline: "Analog feel, digital precision, phosphor glow — one instrument." },
  { slug: "aliasingwars", title: "Aliasing Wars", tagline: "A grand, ongoing war against digital's ugliest sound." },
  { slug: "shootingstar", title: "Shooting Star", tagline: "🌠Trigger a chaos generator with a shooting star explosion.💥" },
  { slug: "sinewave", title: "Sine Wave", tagline: "The simplest patch in the sandbox." },
  { slug: "dsf", title: "DSF Oscillator", tagline: "A closed-form trick for a whole harmonic series." },
  { slug: "polyblep", title: "PolyBLEP", tagline: "Anti-aliased square, the workhorse trick." },
  { slug: "surgeoscillator", title: "Surge Oscillator", tagline: "Hard sync without the alias war." },
  { slug: "phosphillator", title: "Phosphillator", tagline: "An oscillator with a CRT's memory." },
  { slug: "rhythmandpitchgenerator", title: "Rhythm & Pitch Generator", tagline: "One source, two dimensions of music." },
  { slug: "flowerchildfilter", title: "Flower Child Filter", tagline: "The analog-modeled sibling of an existing module." },
  { slug: "robinschmidt", title: "Robin Schmidt / RS-MET", tagline: "Pitch dithering, RAPT math, and the road toward a Synthwave Orchestra." },
  { slug: "rsmet", title: "Robin Schmidt / RS-MET", tagline: "Pitch dithering, RAPT math, and the road toward a Synthwave Orchestra." },
];

// Module reference pages (/module/<type>) and the patch wiki articles
// (/article/<slug>) are generated rather than listed: there are 250+ of the
// first and the second comes straight out of the same data the site renders.
// Descriptions come from public/search/engine-index.json, written by
// scripts/generate-search-index.mjs during prebuild.
function generatedPages() {
  const pages = [];

  const indexFile = path.join(here, "..", "public", "search", "engine-index.json");
  if (existsSync(indexFile)) {
    const index = JSON.parse(readFileSync(indexFile, "utf8"));
    for (const module of index.modules || []) {
      pages.push({
        slug: `module/${module.type}`,
        title: module.label,
        suffix: "soundemote module",
        description:
          module.description ||
          `${module.label}, a ${module.categoryLabel} module in the soemdsp sandbox.`,
      });
    }
  } else {
    console.warn("[generate-og-pages] engine-index.json missing -- no module pages written");
  }

  // slug/title/tagline triples straight out of the patch article data file.
  const articleFile = path.join(here, "..", "src", "data", "patchArticles.ts");
  if (existsSync(articleFile)) {
    const source = readFileSync(articleFile, "utf8");
    const entryPattern =
      /^\s{4}slug: "([a-z0-9-]+)",\s*\n\s{4}title: "([^"]*)",\s*\n\s{4}tagline: "([^"]*)",/gm;
    const entries = [...source.matchAll(entryPattern)];
    for (const [, slug, title, tagline] of entries) {
      pages.push({ slug: `article/${slug}`, title, suffix: "soundemote wiki", description: tagline });
    }
    if (!entries.length) console.warn("[generate-og-pages] no article entries scraped from patchArticles.ts");
  }

  pages.push({
    slug: "modules",
    title: "Module index",
    suffix: "soundemote",
    description: "Every module in the soemdsp sandbox, by department — oscillators, filters, chaos, envelopes, scopes, RGB.",
  });
  pages.push({
    slug: "search",
    title: "Search",
    suffix: "soundemote",
    description: "Search every soemdsp module, patch, live demo, article and wiki page on soundemote.",
  });

  return pages;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function main() {
  let template;
  try {
    template = readFileSync(path.join(distDir, "index.html"), "utf8");
  } catch {
    console.warn("[generate-og-pages] dist/index.html not found -- skipping (did the build run?)");
    return;
  }

  const pages = [
    ...PAGES.map((page) => ({
      slug: page.slug,
      title: page.title,
      suffix: "soundemote wiki",
      description: `${page.tagline} A soundemote.io patch wiki page.`,
    })),
    ...generatedPages(),
  ];

  for (const page of pages) {
    const title = `${escapeHtml(page.title)} — ${page.suffix}`;
    const description = escapeHtml(page.description);
    const url = `${siteUrl}/${page.slug}`;

    let html = template;
    html = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`);
    html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`);
    html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
    html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`);
    html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`);
    html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`);
    html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`);
    // og:image / twitter:image stay on the shared default artwork for now --
    // swap in a per-page image later if these pages get dedicated art.
    void defaultImage;

    const outDir = path.join(distDir, page.slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "index.html"), html);
  }
  console.log(`[generate-og-pages] wrote ${pages.length} crawler-facing pages into dist/`);
}

main();
