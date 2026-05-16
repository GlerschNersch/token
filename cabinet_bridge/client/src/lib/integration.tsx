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
  return JSON.stringify(a) === JSON.stringify(b);
}

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<IntegrationConfig>(defaultConfig);
  const [pc, setPc] = useState<PcStatus>(defaultPc);
  const [log, setLog] = useState<CallLogEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState<IntegrationSaveStatus>("loading");
  const lastPersistedRef = useRef<IntegrationConfig | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (config.pcHostname) next.hostname = config.pcHostname;
        if (onlineRes) {
          const on = onlineRes.state === "on" || onlineRes.state === "home" || onlineRes.state === "online" || onlineRes.state === "true";
          next.online = on;
          next.state = on ? "online" : "offline";
          const attrs = onlineRes.attributes ?? {};
          if (typeof attrs.ip_address === "string") next.ip = attrs.ip_address;
        }
        if (cpuRes) {
          const v = parseFloat(cpuRes.state);
          if (!isNaN(v)) next.cpu = Math.min(100, Math.round(v));
        }
        if (ramRes) {
          const v = parseFloat(ramRes.state);
          if (!isNaN(v)) next.ram = Math.min(100, Math.round(v));
        }
        if (appRes && appRes.state !== "unavailable" && appRes.state !== "unknown") {
          next.currentApp = appRes.state || null;
        }
        return next;
      });
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
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
    setConfigState(defaultConfig);
  }, []);

  const dispatch = useCallback(
    async ({
      actionId,
      label,
      endpoint,
      onSettle,
    }: {
      actionId: string;
      label: string;
      endpoint: string;
      onSettle?: () => void;
    }) => {
      const id = String(++logSeq);
      const entry: CallLogEntry = { id, ts: Date.now(), label, endpoint, status: "queued" };
      setLog((prev) => [entry, ...prev].slice(0, 40));

      const finish = (status: CallStatus, detail?: string) => {
        setLog((prev) => prev.map((e) => (e.id === id ? { ...e, status, detail } : e)));
        onSettle?.();
      };

      if (!config.liveMode) {
        setTimeout(() => finish("simulated"), 320);
        return;
      }

      try {
        const fullUrl = endpoint.startsWith("http") ? endpoint : `${config.haBaseUrl}${endpoint}`;
        const res = await fetch(fullUrl, {
          method: "POST",
          headers: config.haToken ? { Authorization: `Bearer ${config.haToken}` } : {},
          body: JSON.stringify({ action: actionId, ts: Date.now() }),
        });

        if (res.ok) {
          finish("ok", `${res.status} ${res.statusText}`);
        } else {
          finish("error", `${res.status} ${res.statusText}`);
        }
      } catch (err) {
        finish("error", err instanceof Error ? err.message : "Network error");
      }
    },
    [config.haBaseUrl, config.haToken, config.liveMode]
  );

  const value = useMemo(
    () => ({ config, setConfig, setEndpoint, resetConfig, saveStatus, pc, log, dispatch }),
    [config, setConfig, setEndpoint, resetConfig, saveStatus, pc, log, dispatch]
  );

  return <IntegrationContext.Provider value={value}>{children}</IntegrationContext.Provider>;
}

export function useIntegration() {
  const ctx = useContext(IntegrationContext);
  if (!ctx) throw new Error("useIntegration must be used within IntegrationProvider");
  return ctx;
}
