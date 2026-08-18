// The generated engine catalog (public/search/engine-index.json), fetched once
// per page load and shared by the module pages and the search index.

import { useEffect, useState } from "react";
import { fetchEngineIndex } from "./sources";
import type { EngineIndex, EngineModule } from "./sources";

let cache: Promise<EngineIndex | null> | null = null;

export function loadEngineIndex(): Promise<EngineIndex | null> {
  if (!cache) cache = fetchEngineIndex();
  return cache;
}

export function useEngineIndex(): { index: EngineIndex | null; loading: boolean } {
  const [index, setIndex] = useState<EngineIndex | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadEngineIndex().then((loaded) => {
      if (cancelled) return;
      setIndex(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { index, loading };
}

/** Modules grouped by department, in the department order the engine defines. */
export function groupModulesByDepartment(index: EngineIndex): { title: string; emoji: string; pitch: string; modules: EngineModule[] }[] {
  const byCategory = new Map<string, EngineModule[]>();
  for (const module of index.modules) {
    const bucket = byCategory.get(module.category);
    if (bucket) bucket.push(module);
    else byCategory.set(module.category, [module]);
  }

  const groups: { title: string; emoji: string; pitch: string; modules: EngineModule[] }[] = [];
  const seen = new Set<string>();
  for (const department of index.departments) {
    const modules = byCategory.get(department.id);
    if (!modules?.length) continue;
    seen.add(department.id);
    groups.push({
      title: department.title || department.label,
      emoji: department.emoji,
      pitch: department.pitch,
      modules: [...modules].sort((a, b) => a.label.localeCompare(b.label)),
    });
  }
  // Categories the department table doesn't know about still get a shelf.
  for (const [category, modules] of byCategory) {
    if (seen.has(category)) continue;
    groups.push({
      title: modules[0]?.categoryLabel || category,
      emoji: "",
      pitch: "",
      modules: [...modules].sort((a, b) => a.label.localeCompare(b.label)),
    });
  }
  return groups;
}
