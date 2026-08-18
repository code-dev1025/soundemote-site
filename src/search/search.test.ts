// The promise this feature makes is "type the thing, get the thing" -- so the
// tests are written as that promise: a query, and the result that must come
// back at or near the top. Built against the real corpus (generated engine
// index + the real article data), not fixtures, so a renamed module or a
// rewritten article shows up here before it shows up in the search box.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SearchIndex } from "./engine";
import { articleDocs, coreDocs, moduleDocs, patchDocs } from "./sources";
import type { EngineIndex } from "./sources";
import type { SearchDoc, SearchResult } from "./types";

// Read from disk rather than importing: the generated index lives outside
// src/, and this way the test fails loudly if the generator was never run.
const engineIndex = JSON.parse(
  readFileSync(path.join(process.cwd(), "public/search/engine-index.json"), "utf8"),
) as EngineIndex;

const docs: SearchDoc[] = [
  ...coreDocs(),
  ...moduleDocs(engineIndex),
  ...patchDocs(engineIndex),
  ...articleDocs(),
];
const index = new SearchIndex(docs);

const ids = (results: SearchResult[]) => results.map((result) => result.doc.id);

/** Every id that came back, so "somewhere in the results" assertions read well. */
const search = (query: string, limit = 12) => ids(index.search(query, { limit }));

describe("corpus", () => {
  it("indexes the whole site", () => {
    expect(index.size).toBeGreaterThan(250);
  });

  it("gives every module a page to land on", () => {
    const modules = moduleDocs(engineIndex);
    expect(modules.length).toBeGreaterThan(200);
    for (const doc of modules) expect(doc.url).toMatch(/^\/module\/[A-Za-z0-9_]+$/);
  });

  it("never points a patch result at a dead end", () => {
    for (const doc of patchDocs(engineIndex)) expect(doc.url).toMatch(/^\//);
  });
});

describe("you search X, you get X", () => {
  it("bessel -> the shipping Bessel filter, not the placeholder", () => {
    const results = search("bessel", 20);
    expect(results[0]).toBe("module:bessel");
    // The Bessel-Thomson placeholder still shows up, just not first.
    expect(results.indexOf("module:besselThomson")).toBeGreaterThan(0);
  });

  it("polyblep -> the explanation and the module, both up top", () => {
    const results = search("polyblep", 20);
    expect(results.slice(0, 3)).toContain("article:polyblep");
    expect(results.slice(0, 3)).toContain("module:polyBlep");
    // The long-form explanation leads; the module page is the reference.
    expect(results.indexOf("article:polyblep")).toBeLessThan(results.indexOf("module:polyBlep"));
  });

  it("sine wave -> sine-generating modules and the sine wave explanation", () => {
    const results = search("sine wave", 20);
    expect(results.some((id) => /^module:(sineWavetable|aliasSine|robinSinusoid)$/.test(id))).toBe(true);
    expect(results).toContain("article:sinewave");
  });

  it("reverb -> the reverb modules, the patch, and the live demo", () => {
    const results = search("reverb", 20);
    expect(results.some((id) => id.startsWith("module:") && /reverb/i.test(id))).toBe(true);
    expect(results).toContain("demo:/reverb-live");
  });

  it("saw -> saw oscillators", () => {
    const results = search("saw", 20);
    expect(results.some((id) => /^module:(antisaw|hypersaw|robinSupersaw|polyBlep)$/.test(id))).toBe(true);
  });

  it("supersaw -> the supersaw work", () => {
    const results = search("supersaw", 20);
    expect(results.some((id) => /supersaw/i.test(id))).toBe(true);
  });

  it("limiter -> the limiters", () => {
    const results = search("limiter", 20);
    expect(results.some((id) => /^module:(clipperLimiter|lookaheadLimiter|slewLimiter)$/.test(id))).toBe(true);
  });

  it("rgb -> the RGB/video modules", () => {
    const results = search("rgb", 20);
    expect(results.filter((id) => id.startsWith("module:")).length).toBeGreaterThan(2);
  });

  it("doppler -> whatever on the site actually does doppler", () => {
    expect(search("doppler", 20).length).toBeGreaterThan(0);
  });

  it("chaos -> the chaos department", () => {
    const results = search("chaos", 20);
    expect(results.some((id) => /^module:(lorenzAttractor|chuaAttractor|henonMap|logisticMap)$/.test(id))).toBe(true);
  });

  it("vactrol -> the vactrol envelopes", () => {
    const results = search("vactrol", 20);
    expect(results.some((id) => /vactrol/i.test(id))).toBe(true);
  });
});

describe("query understanding", () => {
  it("matches across camelCase boundaries", () => {
    // The module type is "polyBlep"; nobody types it that way.
    expect(search("poly blep", 20).slice(0, 3)).toContain("module:polyBlep");
  });

  it("survives a typo", () => {
    expect(search("polyblip", 20).some((id) => id === "module:polyBlep")).toBe(true);
  });

  it("handles plurals", () => {
    const singular = search("filter", 20);
    const plural = search("filters", 20);
    expect(plural.length).toBeGreaterThan(0);
    expect(plural[0]).toBe(singular[0]);
  });

  it("reaches synonyms the corpus does not spell out", () => {
    // "anti aliasing" never appears as a title; PolyBLEP/BLIT are the answer.
    const results = search("anti aliasing", 20);
    expect(results.some((id) => /^module:(polyBlep|blit)$/.test(id))).toBe(true);
  });

  it("requires every word to land, so it stays precise", () => {
    // "bessel" narrows the filters; a generic filter must not outrank it.
    const results = search("bessel filter", 20);
    expect(results[0]).toBe("module:bessel");
    expect(results.slice(0, 3)).toContain("module:besselThomson");
  });

  it("returns nothing for nonsense instead of guessing", () => {
    expect(search("zzzqqqxyzzy")).toHaveLength(0);
  });

  it("ignores empty and whitespace queries", () => {
    expect(index.search("")).toHaveLength(0);
    expect(index.search("   ")).toHaveLength(0);
  });
});

describe("ranking", () => {
  it("puts an exact title above a body mention", () => {
    const results = index.search("sandbox", { limit: 10 });
    expect(results[0].doc.title.toLowerCase()).toContain("sandbox");
  });

  it("ranks a shipping module above a placeholder that owns the word", () => {
    // "Wavetable2D" is an under-construction stub whose title is the query;
    // SinCos is the real wavetable sine. The shipping one has to win.
    const results = index.search("wavetable", { limit: 20 });
    const real = results.findIndex((result) => result.doc.id === "module:sineWavetable");
    const wip = results.findIndex((result) => result.doc.id === "module:wavetable2d");
    expect(real).toBeGreaterThanOrEqual(0);
    expect(wip).toBeGreaterThan(real);
  });

  it("can filter to one kind", () => {
    const results = index.search("filter", { limit: 20, kinds: ["article"] });
    for (const result of results) expect(result.doc.kind).toBe("article");
  });
});
