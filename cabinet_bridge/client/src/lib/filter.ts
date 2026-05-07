import type { Filter } from "@/components/Sidebar";
import { SYSTEMS, type SystemId } from "@/data/library";

const SYSTEM_IDS = new Set<SystemId>(SYSTEMS.map((s) => s.id));
const SPECIAL: ReadonlyArray<SystemId> = ["favorites", "recent", "all"];

export const DEFAULT_FILTER: Filter = "favorites";

export function filterToPath(filter: Filter): string {
  if (typeof filter === "string" && filter.startsWith("collection:")) {
    const id = filter.slice("collection:".length);
    return `/library/collection/${id}`;
  }
  return `/library/${filter}`;
}

export function parseFilter(value: string | undefined): Filter {
  if (!value) return DEFAULT_FILTER;
  const decoded = decodeURIComponent(value).toLowerCase();
  if ((SPECIAL as readonly string[]).includes(decoded)) return decoded as Filter;
  if (SYSTEM_IDS.has(decoded as SystemId)) return decoded as SystemId;
  return DEFAULT_FILTER;
}

export function parseCollectionFilter(id: string | undefined): Filter {
  if (!id) return DEFAULT_FILTER;
  const num = Number(id);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_FILTER;
  return `collection:${num}` as Filter;
}
