// Build step: turns the vendored soemdsp sandbox engine into a compact JSON
// corpus the site-wide search can read (public/search/engine-index.json).
//
// Why a generator instead of importing at runtime: the engine's "what modules
// exist" data lives in two ~400KB browser scripts under
// public/soemdsp-sandbox/public/ that assume a DOM and load-order globals.
// They are a vendored build artifact of the soemdsp-sandbox repo -- we never
// edit them, we read them. So this script evaluates just the data literals
// out of those files (in a throwaway vm context with stubbed globals) and
// writes the parts search cares about: every module's type, label,
// department, description and notes, whether it has a native (C++/wasm)
// implementation, and which shipped patches use it.
//
// Run it with `npm run search:index` (also wired into predev/prebuild) after
// dropping in a new sandbox build; commit the JSON so a plain `npm run dev`
// works without regenerating.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const sandboxDir = path.join(root, "public", "soemdsp-sandbox");
const engineDir = path.join(sandboxDir, "public");
const patchesDir = path.join(root, "public", "patches");
const outFile = path.join(root, "public", "search", "engine-index.json");

const read = (file) => readFileSync(file, "utf8");
const exists = (file) => existsSync(file);

// --- literal extraction -----------------------------------------------------

/**
 * Slice the `{...}` / `[...]` literal assigned to `name` out of a source file,
 * skipping over strings and comments so braces inside them don't end it early.
 */
function extractLiteral(src, name) {
  const at = src.indexOf(name);
  if (at < 0) return null;
  let i = src.indexOf("=", at);
  if (i < 0) return null;
  while (i < src.length && !"{[".includes(src[i])) i++;
  const open = src[i];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let end = i;
  for (; end < src.length; end++) {
    const c = src[end];
    const next = src[end + 1];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") {
        blockComment = false;
        end++;
      }
      continue;
    }
    if (c === "/" && next === "/") {
      lineComment = true;
      end++;
      continue;
    }
    if (c === "/" && next === "*") {
      blockComment = true;
      end++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) {
      end++;
      break;
    }
  }
  return src.slice(i, end);
}

/**
 * A context where every unknown global resolves to a do-nothing stub, so the
 * engine's data literals (which reference helpers and browser globals we
 * don't have) still evaluate.
 */
function makeStubContext() {
  const stub = new Proxy(function () {}, {
    get: () => stub,
    apply: () => ({}),
    construct: () => ({}),
  });
  return vm.createContext(
    new Proxy(
      {},
      {
        has: () => true,
        get: (target, key) => {
          if (key in target) return target[key];
          if (key in globalThis) return globalThis[key];
          return stub;
        },
      },
    ),
  );
}

const evalLiteral = (ctx, src, name, fallback) => {
  const literal = extractLiteral(src, name);
  if (!literal) {
    console.warn(`[search-index] could not find ${name} -- using fallback`);
    return fallback;
  }
  try {
    return vm.runInContext(`(${literal})`, ctx);
  } catch (error) {
    console.warn(`[search-index] ${name} failed to evaluate: ${error.message}`);
    return fallback;
  }
};

// --- sources ----------------------------------------------------------------

/** Chromeless modules (led, stepGrid, xyPad, ...) register themselves from
 *  their own folder, so their catalog rows aren't in the module store file. */
function readChromelessCatalog(ctx) {
  const registry = path.join(engineDir, "node-graph-chromeless-module-registry.js");
  if (!exists(registry)) return {};
  const modulesDir = path.join(engineDir, "modules");
  const registrations = [];
  for (const dir of exists(modulesDir) ? readdirSync(modulesDir) : []) {
    const full = path.join(modulesDir, dir);
    let files = [];
    try {
      files = readdirSync(full);
    } catch {
      continue;
    }
    for (const file of files) {
      if (file.endsWith("-register.js")) registrations.push(path.join(full, file));
    }
  }
  // Each registration file is wrapped so one bad apple (a file that depends on
  // load order we don't reproduce) doesn't lose the rest.
  const source = [
    read(registry),
    ...registrations.map(
      (file) => `try {\n${read(file)}\n} catch (registrationError) { /* skipped: ${path.basename(file)} */ }`,
    ),
    "nodeGraphChromelessModuleCatalogEntries()",
  ].join("\n;\n");
  try {
    return vm.runInContext(source, ctx) || {};
  } catch (error) {
    console.warn(`[search-index] chromeless registry failed: ${error.message}`);
    return {};
  }
}

/** Native (C++ → wasm) module catalog emitted by the sandbox build. */
function readNativeCatalog() {
  const file = path.join(sandboxDir, "native-modules-catalog.json");
  if (!exists(file)) return new Map();
  try {
    const parsed = JSON.parse(read(file));
    const byType = new Map();
    for (const entry of parsed.modules || []) {
      const type = entry.targetType || entry.name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
      byType.set(type, entry);
    }
    return byType;
  } catch (error) {
    console.warn(`[search-index] native catalog unreadable: ${error.message}`);
    return new Map();
  }
}

/** Shipped patches, so "reverb" can surface the patches that contain one. */
function readPatches() {
  if (!exists(patchesDir)) return [];
  const patches = [];
  for (const file of readdirSync(patchesDir)) {
    if (!file.endsWith(".json")) continue;
    const slug = file.replace(/\.json$/, "");
    try {
      const patch = JSON.parse(read(path.join(patchesDir, file)));
      const types = [...new Set((patch.nodes || []).map((node) => node.type).filter(Boolean))].sort();
      patches.push({
        slug,
        title: patch.info?.title || patch.info?.name || slug,
        description: patch.info?.description || "",
        url: `/patches/${file}`,
        modules: types,
      });
    } catch (error) {
      console.warn(`[search-index] patch ${file} unreadable: ${error.message}`);
    }
  }
  return patches;
}

// --- assembly ---------------------------------------------------------------

function main() {
  const storeFile = path.join(engineDir, "node-graph-module-store.js");
  const definitionsFile = path.join(engineDir, "node-graph-module-definitions.js");
  if (!exists(storeFile) || !exists(definitionsFile)) {
    console.warn("[search-index] sandbox engine files missing -- keeping the existing index");
    return;
  }

  const ctx = makeStubContext();
  const storeSrc = read(storeFile);
  const definitionsSrc = read(definitionsFile);

  const catalog = evalLiteral(ctx, storeSrc, "const nodeGraphModuleStoreCatalog", {});
  const departments = evalLiteral(ctx, storeSrc, "const nodeGraphModuleStoreDepartments", []);
  const aliasToId = evalLiteral(ctx, storeSrc, "const nodeGraphModuleStoreDepartmentAliasToId", {});
  const underConstruction = new Set(
    evalLiteral(ctx, storeSrc, "const nodeGraphModuleCatalogUnderConstructionSort", []),
  );
  const labels = evalLiteral(ctx, definitionsSrc, "const nodeGraphNodeLabels", {});
  const chromeless = readChromelessCatalog(ctx);
  const native = readNativeCatalog();
  const patches = readPatches();

  const merged = { ...catalog };
  for (const [type, entry] of Object.entries(chromeless)) {
    merged[type] = { ...(merged[type] || {}), ...entry };
  }

  const departmentById = new Map(departments.map((dep) => [dep.id, dep]));
  const patchesByType = new Map();
  for (const patch of patches) {
    for (const type of patch.modules) {
      if (!patchesByType.has(type)) patchesByType.set(type, []);
      patchesByType.get(type).push(patch.slug);
    }
  }

  const modules = Object.entries(merged)
    .map(([type, entry]) => {
      const categoryId = aliasToId[entry.category] || entry.category || "digital";
      const department = departmentById.get(categoryId);
      const nativeEntry = native.get(type);
      return {
        type,
        label: entry.label || labels[type] || type,
        category: categoryId,
        categoryLabel:
          department?.title ||
          department?.label ||
          categoryId.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()),
        description: entry.description || "",
        notes: Array.isArray(entry.notes) ? entry.notes : [],
        native: Boolean(nativeEntry),
        sourceUrl: nativeEntry?.sourceUrl || "",
        libUrl: nativeEntry?.libUrl || "",
        underConstruction: underConstruction.has(type),
        patches: (patchesByType.get(type) || []).sort(),
      };
    })
    .sort((a, b) => a.type.localeCompare(b.type));

  const index = {
    version: 1,
    departments: departments.map((dep) => ({
      id: dep.id,
      label: dep.label || dep.id,
      title: dep.title || dep.label || dep.id,
      emoji: dep.emoji || "",
      pitch: dep.pitch || "",
    })),
    modules,
    patches,
  };

  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(
    `[search-index] ${modules.length} modules (${modules.filter((m) => m.native).length} native), ` +
      `${index.departments.length} departments, ${patches.length} patches -> public/search/engine-index.json`,
  );
}

main();
