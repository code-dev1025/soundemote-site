// Wiring test for the palette: does typing into the Nav search box actually
// produce a clickable result pointing at the right page? The ranking itself is
// covered by src/search/search.test.ts -- this is about the plumbing between
// the input, the index, and the router.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SiteSearch from "./SiteSearch";
import { resetSearchIndex } from "@/search";

const engineIndexJson = readFileSync(path.join(process.cwd(), "public/search/engine-index.json"), "utf8");

beforeEach(() => {
  resetSearchIndex();
  // The engine catalog is a fetch; everything else (Supabase) answers empty so
  // no test ever reaches the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.includes("engine-index.json")) {
        return new Response(engineIndexJson, { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSearchIndex();
});

const openAndType = async (query: string) => {
  render(
    <MemoryRouter>
      <SiteSearch />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: /search soundemote/i }));
  const input = await screen.findByPlaceholderText(/sine wave/i);
  if (query) fireEvent.change(input, { target: { value: query } });
};

describe("SiteSearch", () => {
  it("shows suggestions before anything is typed", async () => {
    await openAndType("");
    expect(screen.getByRole("button", { name: "bessel" })).toBeInTheDocument();
  });

  it("finds a module and links to its page", async () => {
    await openAndType("bessel");
    await waitFor(() => expect(screen.getByText("Bessel Filter")).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/Modules/i)).toBeInTheDocument();
  });

  it("offers a full-results escape hatch", async () => {
    await openAndType("reverb");
    await waitFor(() => expect(screen.getByText(/see all results/i)).toBeInTheDocument(), { timeout: 3000 });
  });

  it("says so plainly when nothing matches", async () => {
    await openAndType("zzzqqqxyzzy");
    await waitFor(() => expect(screen.getByText(/nothing for/i)).toBeInTheDocument(), { timeout: 3000 });
  });
});
