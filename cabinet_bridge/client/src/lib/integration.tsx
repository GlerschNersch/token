import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, apiUrl } from "./queryClient";

/**
 * Cabinet Bridge integration layer.
 *
 * In production this calls Home Assistant webhooks (see Settings page for the
 * endpoint URLs). For the prototype every action runs through `dispatch` which
 * logs the call, optionally fires `fetch`, and feeds an in-memory log that the
 * Activity panel renders.
 *
 * Persistence: integration settings (HA base URL, token, live mode, endpoint
 * overrides) are stored server-side in SQLite via /api/settings/integration so
 * they survive add-on restarts and HA ingress iframe reloads. The browser
 * never writes to localStorage / cookies — those APIs are unreliable inside
 * Home Assistant's sandboxed iframe.
 */

export type CallStatus = "queued" | "ok" | "error" | "simulated";

export interface CallLogEntry {
  id: string;
  ts: number;
  label: string;
  endpoint: string;
  status: CallStatus;
  detail?: string;
}

export interface IntegrationConfig {
  /** Base URL of the Home Assistant instance, e.g. https://ha.local:8123 */
  haBaseUrl: string;
  /** Long-lived access token (optional — webhooks usually don't need one). */
  haToken: string;
  /** When false, calls are logged locally but no fetch() is made. */
  liveMode: boolean;
  /** Override map for action endpoints by id. */
  endpoints: Record<string, string>;
  /** ScreenScraper.fr credentials */
  ssUserId?: string;
  ssPassword?: string;
  /** Kiosk / arcade mode */
  kioskMode?: boolean;
  kioskPin?: string;
  kioskCollectionId?: number | null;
  /** RetroAchievements */
  raUsername?: string;
  raToken?: string;
}

export type IntegrationSaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

export interface PcStatus {
  online: boolean;
  state: "online" | "sleeping" | "offline" | "starting";
  ip: string;
  hostname: string;
  cpu: number; // 0-100
  ram: number; // 0-100
  uptimeMin: number;
  currentApp: string | null;
}

interface IntegrationContextValue {
  config: IntegrationConfig;
  setConfig: (next: Partial<IntegrationConfig>) => void;
  setEndpoint: (id: string, url: string) => void;
  resetConfig: () => void;
  saveStatus: IntegrationSaveStatus;
  pc: PcStatus;
  log: CallLogEntry[];
  dispatch: (params: {
    actionId: string;
    label: string;
    endpoint: string;
    /** Optional side-effect to simulate after the call resolves. */
    onSettle?: () => void;
  }) => Promise<void>;
}

const defaultConfig: IntegrationConfig = {
  haBaseUrl: "https://homeassistant.local:8123",
  ssUserId: "",
  ssPassword: "",
  kioskMode: false,
  kioskPin: "",
  kioskCollectionId: null,
  raUsername: "",
  raToken: "",
  haToken: "",
  liveMode: false,
  endpoints: {},
};

const defaultPc: PcStatus = {
  online: true,
  state: "online",
  ip: "192.168.1.42",
  hostname: "ARCADE-PC",
  cpu: 14,
  ram: 38,
  uptimeMin: 184,
  currentApp: "RetroBat",
};

const IntegrationContext = createContext<IntegrationContextValue | null>(null);

let logSeq = 0;

const SETTINGS_PATH = "/api/settings/integration";
const SAVE_DEBOUNCE_MS = 400;

function normalizeConfig(raw: unknown): IntegrationConfig {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<IntegrationConfig>;
  const endpointsRaw = source.endpoints;
  const endpoints: Record<string, string> = {};
  if (endpointsRaw && typeof endpointsRaw === "object") {
    for (const [key, value] of Object.entries(endpointsRaw)) {
      if (typeof value === "string") endpoints[key] = value;
    }
  }
  return {
    haBaseUrl: typeof source.haBaseUrl === "string" ? source.haBaseUrl : defaultConfig.haBaseUrl,
    haToken: typeof source.haToken === "string" ? source.haToken : defaultConfig.haToken,
    liveMode: typeof source.liveMode === "boolean" ? source.liveMode : defaultConfig.liveMode,
    endpoints,
    ssUserId: typeof source.ssUserId === "string" ? source.ssUserId : "",
    ssPassword: typeof source.ssPassword === "string" ? source.ssPassword : "",
    kioskMode: typeof source.kioskMode === "boolean" ? source.kioskMode : false,
    kioskPin: typeof source.kioskPin === "string" ? source.kioskPin : "",
    kioskCollectionId: (typeof source.kioskCollectionId === "number" || source.kioskCollectionId === null) ? source.kioskCollectionId : null,
    raUsername: typeof source.raUsername === "string" ? source.raUsername : "",
    raToken: typeof source.raToken === "string" ? source.raToken : "",
  };
}

function configsEqual(a: IntegrationConfig, b: IntegrationConfig): boolean {
  if (a.haBaseUrl !== b.haBaseUrl) return false;
  if (a.haToken !== b.haToken) return false;
  if (a.liveMode !== b.liveMode) return false;
  if (a.ssUserId !== b.ssUserId) return false;
  if (a.ssPassword !== b.ssPassword) return false;
  if (a.kioskMode !== b.kioskMode) return false;
  if (a.kioskPin !== b.kioskPin) return false;
  if (a.kioskCollectionId !== b.kioskCollectionId) return false;
  if (a.raUsername !== b.raUsername) return false;
  if (a.raToken !== b.raToken) return false;
  const aKeys = Object.keys(a.endpoints);
  const bKeys = Object.keys(b.endpoints);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a.endpoints[k] !== b.endpoints[k]) return false;
  }
  return true;
}

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<IntegrationConfig>(defaultConfig);
  const [pc, setPc] = useState<PcStatus>(defaultPc);
  const [log, setLog] = useState<CallLogEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<IntegrationSaveStatus>("loading");
  // Track the last value we either loaded from or successfully wrote to the
  // server so we can skip persisting echoes of the loaded state.
  const lastPersistedRef = useRef<IntegrationConfig | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted settings on mount. If the request fails (backend unavailable
  // or older server without the route), keep defaults — the UI still works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(SETTINGS_PATH));
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const loaded = normalizeConfig(data);
        lastPersistedRef.current = loaded;
        setConfigState(loaded);
        setSaveStatus("idle");
      } catch {
        if (cancelled) return;
        lastPersistedRef.current = { ...defaultConfig };
        setSaveStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced server-side persistence whenever config changes.
  useEffect(() => {
    if (saveStatus === "loading") return;
    const last = lastPersistedRef.current;
    if (last && configsEqual(last, config)) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await apiRequest("PUT", SETTINGS_PATH, config);
        const saved = normalizeConfig(await res.json());
        lastPersistedRef.current = saved;
        setSaveStatus("saved");
        if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
        savedFlashTimerRef.current = setTimeout(() => {
          setSaveStatus((s) => (s === "saved" ? "idle" : s));
        }, 1500);
      } catch {
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [config, saveStatus]);

  const setConfig = useCallback((next: Partial<IntegrationConfig>) => {
    setConfigState((prev) => ({ ...prev, ...next }));
  }, []);

  const setEndpoint = useCallback((id: string, url: string) => {
    setConfigState((prev) => ({
      ...prev,
      endpoints: { ...prev.endpoints, [id]: url },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState({ ...defaultConfig });
  }, []);

  const dispatch = useCallback<IntegrationContextValue["dispatch"]>(
    async ({ actionId, label, endpoint, onSettle }) => {
      const id = `call-${++logSeq}`;
      const ts = Date.now();
      const resolved = config.endpoints[actionId] || endpoint;
      const live = config.liveMode && /^https?:\/\//i.test(resolved);

      setLog((prev) => [
        { id, ts, label, endpoint: resolved, status: "queued" as CallStatus },
        ...prev,
      ].slice(0, 40));

      // Simulate light-touch effects on PC state for power actions.
      const settleFromAction = () => {
        if (actionId === "sleep_pc") {
          setPc((p) => ({ ...p, online: false, state: "sleeping", currentApp: null }));
        } else if (actionId === "shutdown_pc") {
          setPc((p) => ({ ...p, online: false, state: "offline", currentApp: null }));
        } else if (actionId === "wake_pc") {
          setPc((p) => ({ ...p, online: true, state: "starting", currentApp: null, uptimeMin: 0 }));
          setTimeout(() => {
            setPc((p) => ({ ...p, state: "online", currentApp: "Windows" }));
          }, 1500);
        } else if (actionId === "launch_retrobat") {
          setPc((p) => ({ ...p, online: true, state: "online", currentApp: "RetroBat" }));
        } else if (actionId === "restart_pc") {
          setPc((p) => ({ ...p, state: "starting", currentApp: null }));
          setTimeout(() => {
            setPc((p) => ({ ...p, state: "online", currentApp: "Windows" }));
          }, 1500);
        } else if (actionId.startsWith("launch_game:")) {
          const title = label.replace(/^Launch\s+/i, "");
          setPc((p) => ({ ...p, online: true, state: "online", currentApp: title }));
        }
        onSettle?.();
      };

      let status: CallStatus = "simulated";
      let detail: string | undefined;

      if (live) {
        try {
          const res = await fetch(resolved, {
            method: "POST",
            headers: config.haToken
              ? { Authorization: `Bearer ${config.haToken}` }
              : undefined,
          });
          status = res.ok ? "ok" : "error";
          detail = `${res.status} ${res.statusText}`;
        } catch (err) {
          status = "error";
          detail = err instanceof Error ? err.message : String(err);
        }
      } else {
        // Brief artificial latency so the UI shows the queued state.
        await new Promise((r) => setTimeout(r, 320));
        detail = "Simulated — enable Live mode in Settings to call HA";
      }

      setLog((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, status, detail } : entry,
        ),
      );

      if (status === "ok" || status === "simulated") {
        settleFromAction();
      }
    },
    [config],
  );

  const value = useMemo<IntegrationContextValue>(
    () => ({ config, setConfig, setEndpoint, resetConfig, saveStatus, pc, log, dispatch }),
    [config, setConfig, setEndpoint, resetConfig, saveStatus, pc, log, dispatch],
  );

  return (
    <IntegrationContext.Provider value={value}>
      {children}
    </IntegrationContext.Provider>
  );
}

export function useIntegration() {
  const ctx = useContext(IntegrationContext);
  if (!ctx) throw new Error("useIntegration must be used inside IntegrationProvider");
  return ctx;
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
