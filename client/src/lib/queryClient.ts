import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Detect the path prefix the app is served under, so absolute "/api/..." calls
// resolve to the correct upstream when the SPA is mounted under a non-root
// base path (e.g. Home Assistant ingress: "/api/hassio_ingress/<token>/").
//
// The SPA uses hash routing, so window.location.pathname is purely the deploy
// base path — anything between the host and the hash. We trim a trailing
// "index.html" and any trailing slash so we can prepend it to URLs that begin
// with "/".
function detectApiBase(): string {
  const placeholder = "__PORT_5000__";
  // The dev harness substitutes __PORT_5000__ at runtime; honour it when set.
  if (!placeholder.startsWith("__")) return placeholder as string;

  if (typeof window === "undefined") return "";

  let pathname = window.location.pathname || "/";
  // Strip a trailing index.html (some ingress proxies serve it explicitly).
  pathname = pathname.replace(/\/index\.html?$/i, "/");
  // Drop the trailing slash so we can safely concatenate with "/api/...".
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (pathname === "/" || pathname === "") return "";
  return pathname;
}

let cachedApiBase: string | null = null;

export function getApiBase(): string {
  if (cachedApiBase === null) cachedApiBase = detectApiBase();
  return cachedApiBase;
}

export function apiUrl(url: string): string {
  const base = getApiBase();
  if (!base) return url;
  // Only rewrite root-relative paths; leave fully-qualified URLs alone.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  init: RequestInit = {},
): Promise<Response> {
  const isBodyInit =
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    typeof data === "string" ||
    data instanceof URLSearchParams ||
    data instanceof FormData;
  const headers =
    data && !isBodyInit
      ? { "Content-Type": "application/json", ...(init.headers ?? {}) }
      : init.headers;
  const body =
    data === undefined
      ? undefined
      : isBodyInit
      ? (data as BodyInit)
      : JSON.stringify(data);

  const res = await fetch(apiUrl(url), {
    method,
    ...init,
    headers,
    body,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(apiUrl(queryKey.join("/")));

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
