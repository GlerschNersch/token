import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, apiUrl } from "./queryClient";

/**
 * HomeArcade integration layer.
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
  tgdbApiKey?: string;
  /** PC status panel */
  pcHostname?: string;
  pcOnlineEntityId?: string;
  pcCpuEntityId?: string;
  pcRamEntityId?: string;
  pcAppEntityId?: string;
  /**
   * Per-system default key bindings.
   * Key: EmulatorJS core string (e.g. "psx", "snes", "nes").
   * Value: map of button index → key name (same format as EJS_defaultControls value).
   */
  controlDefaults?: Record<string, Record<number, string>>;
  /** Enable gamepad rumble/haptics */
  gamepadRumble?: boolean;
  /** Per-system display overrides: { [core]: { aspectRatio?, integerScale?, shader? } } */
  systemDisplay?: Record<string, { aspectRatio?: string; integerScale?: boolean; shader?: string }>;
  /** UI navigation mapping: { [action]: buttonIndex } */
  uiGamepadMapping?: Record<string, number>;
  /** UI theme name */
  theme?: string;
  /** UI language (ISO 639-1 code, e.g. "en", "es") */
  language?: string;
  /** Show console names on game cards */
  showSystemLabels?: boolean;
  /** Default emulator aspect ratio */
  globalAspectRatio?: string;
  /** Default emulator shader */
  globalShader?: string;
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
  tgdbApiKey: "",
  haToken: "",
  liveMode: false,
  endpoints: {},
  controlDefaults: {},
  gamepadRumble: true,
  systemDisplay: {},
  uiGamepadMapping: { select: 0, back: 1, favorite: 3, menu: 9 },
  theme: "default",
  language: undefined,
  showSystemLabels: true,
  globalAspectRatio: "auto",
  globalShader: "none",
};

const defaultPc: PcStatus = {
  online: false,
  state: "offline",
  ip: "",
  hostname: "ARCADE-PC",
  cpu: 0,
  ram: 0,
  uptimeMin: 0,
  currentApp: null,
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
    tgdbApiKey: typeof source.tgdbApiKey === "string" ? source.tgdbApiKey : "",
    pcHostname: typeof source.pcHostname === "string" ? source.pcHostname : "ARCADE-PC",
    pcOnlineEntityId: typeof source.pcOnlineEntityId === "string" ? source.pcOnlineEntityId : "",
    pcCpuEntityId: typeof source.pcCpuEntityId === "string" ? source.pcCpuEntityId : "",
    pcRamEntityId: typeof source.pcRamEntityId === "string" ? source.pcRamEntityId : "",
    pcAppEntityId: typeof source.pcAppEntityId === "string" ? source.pcAppEntityId : "",
    controlDefaults: (source.controlDefaults && typeof source.controlDefaults === "object")
      ? source.controlDefaults as Record<string, Record<number, string>>
      : {},
    gamepadRumble: typeof source.gamepadRumble === "boolean" ? source.gamepadRumble : true,
    systemDisplay: (source.systemDisplay && typeof source.systemDisplay === "object")
      ? source.systemDisplay as Record<string, { aspectRatio?: string; integerScale?: boolean; shader?: string }>
      : {},
    uiGamepadMapping: (source.uiGamepadMapping && typeof source.uiGamepadMapping === "object")
      ? source.uiGamepadMapping as Record<string, number>
      : { select: 0, back: 1, favorite: 3, menu: 9 },
    theme: typeof source.theme === "string" ? source.theme : "default",
    language: typeof source.language === "string" ? source.language : undefined,
    showSystemLabels: typeof source.showSystemLabels === "boolean" ? source.showSystemLabels : true,
    globalAspectRatio: typeof source.globalAspectRatio === "string" ? source.globalAspectRatio : "auto",
    globalShader: typeof source.globalShader === "string" ? source.globalShader : "none",
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
  if (a.pcHostname !== b.pcHostname) return false;
  if (a.pcOnlineEntityId !== b.pcOnlineEntityId) return false;
  if (a.pcCpuEntityId !== b.pcCpuEntityId) return false;
  if (a.pcRamEntityId !== b.pcRamEntityId) return false;
  if (a.pcAppEntityId !== b.pcAppEntityId) return false;
  if (a.gamepadRumble !== b.gamepadRumble) return false;
  if (a.theme !== b.theme) return false;
  if (a.language !== b.language) return false;
  if (a.showSystemLabels !== b.showSystemLabels) return false;
  if (a.globalAspectRatio !== b.globalAspectRatio) return false;
  if (a.globalShader !== b.globalShader) return false;

  const aKeys = Object.keys(a.endpoints);
  const bKeys = Object.keys(b.endpoints);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a.endpoints[k] !== b.endpoints[k]) return false;
  }

  const aMap = a.uiGamepadMapping || {};
  const bMap = b.uiGamepadMapping || {};
  const mapKeys = Object.keys(aMap);
  if (mapKeys.length !== Object.keys(bMap).length) return false;
  for (const k of mapKeys) {
    if (aMap[k] !== bMap[k]) return false;
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
        if (loaded.pcHostname) setPc((p) => ({ ...p, hostname: loaded.pcHostname! }));
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

  // ── Live PC status polling ──────────────────────────────────────────────────
  // When Live Mode is on and at least one HA entity ID is configured, poll the
  // HA REST API every 5 s to update the PC status panel with real values.
  useEffect(() => {
    if (!config.liveMode || !config.haBaseUrl) return;
    const hasAny = config.pcOnlineEntityId || config.pcCpuEntityId || config.pcRamEntityId;
    if (!hasAny) return;

    const headers: HeadersInit = config.haToken
      ? { Authorization: `Bearer ${config.haToken}` }
      : {};

    const fetchEntity = async (id: string) => {
      if (!id) return null;
      try {
        const r = await fetch(`${config.haBaseUrl}/api/states/${id}`, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) return null;
        return r.json() as Promise<{ state: string; attributes?: Record<string, unknown> }>;
      } catch {
        return null;
      }
    };

    const poll = async () => {
      const [onlineRes, cpuRes, ramRes, appRes] = await Promise.all([
        fetchEntity(config.pcOnlineEntityId ?? ""),
        fetchEntity(config.pcCpuEntityId ?? ""),
        fetchEntity(config.pcRamEntityId ?? ""),
        fetchEntity(config.pcAppEntityId ?? ""),
      ]);

      setPc((prev) => {
        const next = { ...prev };
        // Hostname from config
        if (config.pcHostname) next.hostname = config.pcHostname;
        // Online state
        if (onlineRes) {
          const on = onlineRes.state === "on" || onlineRes.state === "home" || onlineRes.state === "online" || onlineRes.state === "true";
          next.online = on;
          next.state = on ? "online" : "offline";
          const attrs = onlineRes.attributes ?? {};
          if (typeof attrs.ip_address === "string") next.ip = attrs.ip_address;
        }
        // CPU %
        if (cpuRes) {
          const v = parseFloat(cpuRes.state);
          if (!isNaN(v)) next.cpu = Math.min(100, Math.round(v));
        }
        // RAM %
        if (ramRes) {
          const v = parseFloat(ramRes.state);
          if (!isNaN(v)) next.ram = Math.min(100, Math.round(v));
        }
        // Current app / foreground window
        if (appRes && appRes.state !== "unavailable" && appRes.state !== "unknown") {
          next.currentApp = appRes.state || null;
        }
        return next;
      });
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.liveMode,
    config.haBaseUrl,
    config.haToken,
    config.pcHostname,
    config.pcOnlineEntityId,
    config.pcCpuEntityId,
    config.pcRamEntityId,
    config.pcAppEntityId,
  ]);

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

  // ── Activity Log ───────────────────────────────────────────────────────────
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await fetch("/api/activity-log");
        if (res.ok) setLog(await res.json());
      } catch (err) {
        console.error("Failed to load activity log:", err);
      }
    };
    loadLogs();
  }, []);

  const dispatch = useCallback<IntegrationContextValue["dispatch"]>(
    async ({ actionId, label, endpoint, onSettle }) => {
      const ts = Date.now();
      const resolved = config.endpoints[actionId] || endpoint;
      const live = config.liveMode && /^https?:\/\//i.test(resolved);

      // 1. Optimistic Log Update (Local UI)
      const tempId = `temp-${Date.now()}`;
      setLog((prev) => [
        { id: tempId as any, ts, label, endpoint: resolved, status: "queued" as CallStatus },
        ...prev,
      ].slice(0, 100));

      // 2. Optimistic PC State Update (Edge logic)
      setPc((p) => {
        const next = { ...p };
        if (actionId === "sleep_pc") {
          next.online = false;
          next.state = "sleeping";
          next.currentApp = null;
        } else if (actionId === "shutdown_pc") {
          next.online = false;
          next.state = "offline";
          next.currentApp = null;
        } else if (actionId === "wake_pc") {
          next.online = true;
          next.state = "starting";
          next.currentApp = null;
          next.uptimeMin = 0;
          setTimeout(() => {
            setPc((current) => (current.state === "starting" ? { ...current, state: "online", currentApp: "Windows" } : current));
          }, 1500);
        } else if (actionId === "launch_retrobat") {
          next.online = true;
          next.state = "online";
          next.currentApp = "RetroBat";
        } else if (actionId === "restart_pc") {
          next.state = "starting";
          next.currentApp = null;
          setTimeout(() => {
            setPc((current) => (current.state === "starting" ? { ...current, state: "online", currentApp: "Windows" } : current));
          }, 1500);
        } else if (actionId.startsWith("launch_game:")) {
          const title = label.replace(/^Launch\s+/i, "");
          next.online = true;
          next.state = "online";
          next.currentApp = title;
        }
        return next;
      });

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
        await new Promise((r) => setTimeout(r, 320));
        detail = "Simulated — enable Live mode in Settings to call HA";
      }

      // 3. Persist to Server
      try {
        const res = await apiRequest("POST", "/api/activity-log", {
          ts, label, endpoint: resolved, status, detail
        });
        if (res.ok) {
          const saved = await res.json();
          // Swap temp entry with real one from DB
          setLog((prev) => prev.map((e) => (e.id as any) === tempId ? saved : e));
        }
      } catch (err) {
        console.error("Failed to persist log entry:", err);
      }

      if (status === "ok" || status === "simulated") {
        onSettle?.();
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

export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "never";
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
