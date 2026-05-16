import { SYSTEMS, type SystemId } from "@/data/library";

// ── Filter type (discriminated union) ────────────────────────────────────────
//
// A Filter is always a structured object so callers can pattern-match on `type`
// without string-splitting. The raw string representation lives only at the
// URL / storage boundary and is converted by parseFilter / filterToPath.

export type Filter =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "recent" }
  | { type: "backlog" }
  | { type: "playing" }
  | { type: "completed" }
  | { type: "dropped" }
  | { type: "system"; value: SystemId }
  | { type: "status"; value: string }
  | { type: "collection"; value: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_IDS = new Set<SystemId>(SYSTEMS.map((s) => s.id));

const SIMPLE_TYPES = new Set(["all", "favorites", "recent", "backlog", "playing", "completed", "dropped"]);

export const DEFAULT_FILTER: Filter = { type: "favorites" };

// ── filterToPath ──────────────────────────────────────────────────────────────
//
// Converts a Filter object back to the URL path segment used by the router.

export function filterToPath(filter: Filter): string {
  switch (filter.type) {
    case "collection":
      return `/library/collection/${filter.value}`;
    case "system":
      return `/library/${filter.value}`;
    case "status":
      return `/library/status/${filter.value}`;
    default:
      return `/library/${filter.type}`;
  }
}

// ── filterKey ─────────────────────────────────────────────────────────────────
//
// Returns a stable string key for a Filter — used for active-link comparisons
// and React keys.

export function filterKey(filter: Filter): string {
  switch (filter.type) {
    case "collection":
      return `collection:${filter.value}`;
    case "system":
      return `system:${filter.value}`;
    case "status":
      return `status:${filter.value}`;
    default:
      return filter.type;
  }
}

// ── parseFilter ───────────────────────────────────────────────────────────────
//
// Parses the URL segment (e.g. from router params) into a typed Filter.
// Accepts the following formats:
//   "favorites" | "recent" | "all" | "backlog" | "playing" | "completed" | "dropped"
//   "system:snes"        → { type: 'system', value: 'snes' }
//   "status:completed"   → { type: 'status', value: 'completed' }
//   "collection:42"      → { type: 'collection', value: '42' }
//   <bare SystemId>      → { type: 'system', value: SystemId }
// Unknown values fall back to DEFAULT_FILTER.

export function parseFilter(value: string | undefined): Filter {
  if (!value) return DEFAULT_FILTER;
  const decoded = decodeURIComponent(value).toLowerCase().trim();

  // Prefixed formats
  if (decoded.startsWith("system:")) {
    const sysId = decoded.slice("system:".length) as SystemId;
    if (SYSTEM_IDS.has(sysId)) return { type: "system", value: sysId };
    return DEFAULT_FILTER;
  }

  if (decoded.startsWith("status:")) {
    const status = decoded.slice("status:".length);
    if (status) return { type: "status", value: status };
    return DEFAULT_FILTER;
  }

  if (decoded.startsWith("collection:")) {
    const id = decoded.slice("collection:".length);
    const num = Number(id);
    if (Number.isFinite(num) && num > 0) return { type: "collection", value: id };
    return DEFAULT_FILTER;
  }

  // Simple named filters
  if (SIMPLE_TYPES.has(decoded)) return { type: decoded as Filter["type"] } as Filter;

  // Bare system IDs (legacy URL format: /library/snes)
  if (SYSTEM_IDS.has(decoded as SystemId)) return { type: "system", value: decoded as SystemId };

  return DEFAULT_FILTER;
}

// ── parseCollectionFilter ─────────────────────────────────────────────────────
//
// Convenience wrapper — parses a bare numeric collection ID string (e.g. "42")
// into a collection Filter.

export function parseCollectionFilter(id: string | undefined): Filter {
  if (!id) return DEFAULT_FILTER;
  const num = Number(id);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_FILTER;
  return { type: "collection", value: String(num) };
}
