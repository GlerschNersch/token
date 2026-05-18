import { escapeHtml } from "./utils";

// ── EJS default controls builder ───────────────────────────────────────────
const EJS_DEFAULT_KEYS: Record<number, string> = {
  0: "z", 1: "a", 2: "shift", 3: "enter",
  4: "up arrow", 5: "down arrow", 6: "left arrow", 7: "right arrow",
  8: "x", 9: "s", 10: "q", 11: "w",
  12: "e", 13: "r", 14: "tab", 15: "c",
  24: "1", 25: "2", 26: "3",
};

const EJS_VALUE2: Record<number, string> = {
  0: "0", 1: "2", 2: "8", 3: "9",
  4: "12", 5: "13", 6: "14", 7: "15",
  8: "1", 9: "3", 10: "4", 11: "5",
  12: "6", 13: "7", 14: "10", 15: "11",
};

function buildPlayerControls(
  core: string,
  customKeys: Record<number, string>,
  gamepadBindings: Record<number, number> = {},
): Record<number, { value: string; value2?: string }> {
  const isPS = ["psx", "pcsx2", "ppsspp"].includes(core);
  const maxBtn = isPS ? 15 : 11;
  const controls: Record<number, { value: string; value2?: string }> = {};
  for (let i = 0; i <= maxBtn; i++) {
    const key = customKeys[i] ?? EJS_DEFAULT_KEYS[i];
    if (!key) continue;
    const entry: { value: string; value2?: string } = { value: key };
    if (gamepadBindings[i] !== undefined) {
      entry.value2 = String(gamepadBindings[i]);
    } else if (EJS_VALUE2[i]) {
      entry.value2 = EJS_VALUE2[i];
    }
    controls[i] = entry;
  }
  for (const idx of [24, 25, 26]) {
    controls[idx] = { value: customKeys[idx] ?? EJS_DEFAULT_KEYS[idx] ?? String(idx - 23) };
  }
  return controls;
}

export function buildEjsControls(
  core: string,
  controlDefaults: Record<string, Record<number, string>>,
  gamepadBindings: Record<number, number> = {},
  controlDefaultsP2: Record<number, string> = {},
  gamepadBindingsP2: Record<number, number> = {},
): Record<number, Record<number, { value: string; value2?: string }>> {
  const custom: Record<number, string> = {};
  for (const [k, v] of Object.entries(controlDefaults[core] ?? {})) {
    custom[Number(k)] = v;
  }
  const p1 = buildPlayerControls(core, custom, gamepadBindings);
  const hasP2 = Object.keys(controlDefaultsP2).length > 0 || Object.keys(gamepadBindingsP2).length > 0;
  const p2 = hasP2 ? buildPlayerControls(core, controlDefaultsP2, gamepadBindingsP2) : {};
  return { 0: p1, 1: p2, 2: {}, 3: {} };
}

export function renderPlayerError(message: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        height: 100%;
        margin: 0;
        display: grid;
        place-items: center;
        background: #050507;
        color: #f8fafc;
        font: 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
    </style>
  </head>
  <body>${escapeHtml(message)}</body>
</html>`;
}

export function renderEmulatorPage({ title, returnTo, romHash }: { title: string; returnTo: string; romHash: string | null }) {
  const safeTitle = escapeHtml(title);
  const safeReturnTo = JSON.stringify(returnTo);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} · HomeArcade</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #050507;
        color: #f8fafc;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      .cabinet-menu-button {
        position: fixed;
        z-index: 999999;
        top: max(12px, env(safe-area-inset-top));
        left: max(12px, env(safe-area-inset-left));
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        background: rgba(5, 5, 7, 0.58);
        color: #f8fafc;
        cursor: pointer;
        font: 800 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.14em;
        min-height: 46px;
        padding: 0 18px;
        text-transform: uppercase;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(12px);
        transition: opacity 180ms ease, transform 180ms ease, background 180ms ease, border-color 180ms ease;
      }
      .cabinet-menu-button:hover,
      .cabinet-menu-button:focus-visible,
      .cabinet-menu-button[aria-expanded="true"] {
        background: rgba(236, 72, 153, 0.36);
        border-color: rgba(236, 72, 153, 0.78);
        outline: none;
      }
      .cabinet-menu-button:active {
        transform: translateY(1px) scale(0.98);
      }
      .cabinet-menu-backdrop {
        position: fixed;
        z-index: 999998;
        inset: 0;
        background: rgba(5, 5, 7, 0.54);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease, visibility 180ms ease;
        visibility: hidden;
      }
      .cabinet-menu-panel {
        position: fixed;
        z-index: 999999;
        top: max(70px, calc(env(safe-area-inset-top) + 64px));
        left: max(12px, env(safe-area-inset-left));
        width: min(92vw, 360px);
        max-height: min(82vh, calc(100dvh - 90px));
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 22px;
        background: rgba(11, 11, 16, 0.84);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.58);
        color: #f8fafc;
        opacity: 0;
        pointer-events: none;
        transform: translateY(-8px) scale(0.98);
        transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease;
        visibility: hidden;
        backdrop-filter: blur(18px);
        overscroll-behavior: contain;
      }
      .cabinet-menu-panel.is-open,
      .cabinet-menu-backdrop.is-open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
        visibility: visible;
      }
      .cabinet-menu-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 18px 12px;
      }
      .cabinet-menu-title {
        margin: 0;
        color: #f8fafc;
        font: 900 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .cabinet-menu-subtitle {
        margin: 5px 0 0;
        color: rgba(248, 250, 252, 0.58);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        line-height: 1.5;
        text-transform: uppercase;
      }
      .cabinet-menu-hash {
        margin: 4px 0 0;
        color: rgba(248, 250, 252, 0.28);
        font: 600 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.06em;
        cursor: pointer;
        user-select: all;
      }
      .cabinet-menu-hash:hover { color: rgba(248, 250, 252, 0.55); }
      .cabinet-menu-divider {
        grid-column: 1 / -1;
        height: 1px;
        background: rgba(255, 255, 255, 0.08);
        margin: 2px 0;
      }
      .cabinet-user-badge {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,.75);
        background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 20px;
        padding: 3px 10px;
        white-space: nowrap;
        align-self: flex-start;
        margin-top: 4px;
        letter-spacing: .3px;
        flex-shrink: 0;
      }
      .cabinet-menu-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 8px 18px 24px;
      }
      .cabinet-menu-panel button {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.12em;
        min-height: 54px;
        padding: 10px 12px;
        text-transform: uppercase;
      }
      .cabinet-menu-panel button:hover,
      .cabinet-menu-panel button:focus-visible,
      .cabinet-menu-panel button[aria-pressed="true"] {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      .cabinet-menu-panel .primary-action {
        grid-column: 1 / -1;
        background: rgba(236, 72, 153, 0.42);
        border-color: rgba(236, 72, 153, 0.78);
      }
      .cabinet-menu-panel .danger {
        grid-column: 1 / -1;
      }
      .cabinet-menu-panel .danger:hover,
      .cabinet-menu-panel .danger:focus-visible {
        background: rgba(239, 68, 68, 0.32);
        border-color: rgba(239, 68, 68, 0.72);
      }
      .cabinet-save-panel {
        position: fixed;
        z-index: 1000000;
        left: 50%;
        top: 50%;
        width: min(94vw, 760px);
        max-height: min(86vh, 720px);
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 24px;
        background: rgba(11, 11, 16, 0.9);
        box-shadow: 0 28px 90px rgba(0, 0, 0, 0.66);
        color: #f8fafc;
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, -48%) scale(0.98);
        transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease;
        visibility: hidden;
        backdrop-filter: blur(20px);
      }
      .cabinet-save-panel.is-open {
        opacity: 1;
        pointer-events: auto;
        transform: translate(-50%, -50%) scale(1);
        visibility: visible;
      }
      .cabinet-save-panel__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 18px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .cabinet-save-title {
        margin: 0;
        color: #f8fafc;
        font: 900 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .cabinet-save-subtitle {
        margin: 6px 0 0;
        color: rgba(248, 250, 252, 0.6);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        line-height: 1.5;
        text-transform: uppercase;
      }
      .cabinet-save-close {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 900 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        min-height: 40px;
        min-width: 40px;
      }
      .cabinet-save-close:hover,
      .cabinet-save-close:focus-visible {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      .cabinet-save-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        max-height: calc(min(86vh, 720px) - 94px);
        overflow-y: auto;
        padding: 14px 18px 18px;
      }
      .cabinet-save-slot {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.06);
        padding: 12px;
      }
      .cabinet-save-slot[data-filled="true"] {
        border-color: rgba(236, 72, 153, 0.46);
        background:
          radial-gradient(circle at 12% 0%, rgba(236, 72, 153, 0.2), transparent 44%),
          rgba(255, 255, 255, 0.07);
      }
      .cabinet-save-slot__thumb {
        width: 100%;
        aspect-ratio: 4/3;
        border-radius: 10px;
        overflow: hidden;
        background: rgba(0,0,0,0.35);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cabinet-save-slot__thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        image-rendering: pixelated;
      }
      .cabinet-save-slot__thumb--empty::after {
        content: "NO SAVE";
        color: rgba(248,250,252,0.2);
        font: 800 8px ui-monospace, monospace;
        letter-spacing: 0.2em;
      }
      .cabinet-save-slot__eyebrow {
        color: rgba(248, 250, 252, 0.56);
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .cabinet-save-slot__label {
        margin-top: 5px;
        color: #f8fafc;
        font: 900 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      .cabinet-save-slot__meta {
        min-height: 32px;
        margin-top: 5px;
        color: rgba(248, 250, 252, 0.58);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        line-height: 1.5;
      }
      .cabinet-save-slot__actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        margin-top: 10px;
      }
      .cabinet-save-slot button {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
      }
      .cabinet-save-slot button:hover,
      .cabinet-save-slot button:focus-visible {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      .cabinet-save-slot button:disabled {
        cursor: not-allowed;
        opacity: 0.38;
      }
      .cabinet-save-slot .danger:hover,
      .cabinet-save-slot .danger:focus-visible {
        background: rgba(239, 68, 68, 0.28);
        border-color: rgba(239, 68, 68, 0.68);
      }
      .cabinet-opt {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        background: rgba(255,255,255,0.07);
        color: rgba(248,250,252,0.8);
        cursor: pointer;
        font: 800 9px ui-monospace,monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
      .cabinet-opt:hover,
      .cabinet-opt:focus-visible {
        background: rgba(236,72,153,0.2);
        border-color: rgba(236,72,153,0.55);
        color: #fff;
        outline: none;
      }
      .cabinet-aspect-btn {
        appearance: none;
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 12px;
        background: rgba(255,255,255,0.08);
        color: #f8fafc;
        cursor: pointer;
        font: 800 9px ui-monospace,monospace;
        letter-spacing: 0.12em;
        min-height: 36px;
        padding: 8px 6px;
        text-transform: uppercase;
      }
      .cabinet-aspect-btn:hover,
      .cabinet-aspect-btn:focus-visible,
      .cabinet-aspect-btn[aria-checked="true"] {
        background: rgba(236, 72, 153, 0.34);
        border-color: rgba(236, 72, 153, 0.75);
        outline: none;
      }
      #game canvas {
        transition: filter 0.2s;
      }
      /* Filters */
      #game.cabinet-filter-crt canvas { filter: contrast(1.15) brightness(0.92) saturate(1.2) !important; }
      #game.cabinet-filter-smooth canvas { image-rendering: auto !important; filter: blur(0.5px) brightness(1.02) !important; }
      #game.cabinet-filter-scanlines canvas { image-rendering: pixelated !important; filter: contrast(1.1) brightness(0.85) !important; }
      #game.cabinet-filter-lcd canvas { image-rendering: pixelated !important; filter: contrast(1.3) brightness(1.1) saturate(0.7) !important; }
      #game.cabinet-filter-phosphor canvas { filter: contrast(1.1) brightness(0.95) saturate(0) sepia(1) hue-rotate(90deg) !important; }
      .cabinet-toast {
        position: fixed;
        z-index: 1000000;
        top: max(70px, calc(env(safe-area-inset-top) + 64px));
        left: 50%;
        transform: translateX(-50%);
        max-width: min(90vw, 520px);
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(236, 72, 153, 0.92);
        color: white;
        font: 700 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }
      .cabinet-toast.show { opacity: 1; }
      #game { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
      .cabinet-launch-overlay {
        position: fixed;
        z-index: 999998;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: radial-gradient(circle at 50% 32%, rgba(236, 72, 153, 0.22), transparent 34%), linear-gradient(180deg, rgba(5, 5, 7, 0.92), rgba(5, 5, 7, 0.72));
        color: #f8fafc;
        transition: opacity 240ms ease, visibility 240ms ease;
      }
      .cabinet-launch-overlay.is-hidden { opacity: 0; visibility: hidden; }
      .cabinet-launch-card {
        width: min(88vw, 520px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 22px;
        background: rgba(11, 11, 16, 0.78);
        padding: 22px;
        backdrop-filter: blur(18px);
      }
      .cabinet-progress-track { width: 100%; height: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 999px; background: rgba(255, 255, 255, 0.08); }
      .cabinet-progress-bar { width: 0%; height: 100%; background: linear-gradient(90deg, #ec4899, #f9a8d4); transition: width 260ms ease; }
    </style>
  </head>
  <body>
    <button type="button" class="cabinet-menu-button" id="cabinet-menu-toggle" aria-expanded="false">Menu</button>
    <div class="cabinet-menu-backdrop" id="cabinet-menu-backdrop"></div>
    <nav class="cabinet-menu-panel" id="cabinet-menu-panel">
      <div class="cabinet-menu-grid">
        <button type="button" id="cabinet-resume">Resume Game</button>
        <button type="button" id="cabinet-save">Quick Save</button>
        <button type="button" id="cabinet-load">Quick Load</button>
        <button type="button" id="cabinet-warp-open">Warp Link</button>
        <button type="button" id="cabinet-exit" class="danger">Exit Game</button>
      </div>
    </nav>
    <section class="cabinet-save-panel" id="cabinet-warp-panel">
      <div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;">
        <p style="font-weight:900;text-transform:uppercase;letter-spacing:0.1em;">Warp Link</p>
        <div id="cabinet-warp-qr">Warping...</div>
        <div style="max-width:280px;color:rgba(248,250,252,0.6);font:600 11px ui-monospace,monospace;letter-spacing:0.05em;line-height:1.5;">
          Scan to continue on your phone. <br>
          <span style="color:rgba(236, 72, 153, 0.9);">Make sure you are logged into Home Assistant in your phone's browser!</span>
        </div>
        <div id="cabinet-warp-manual" style="display:none;width:100%;">
          <p style="font-size:10px;opacity:0.6;">Manual link:</p>
          <input id="cabinet-warp-url" type="text" readonly style="width:100%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:8px;border-radius:8px;" />
        </div>
        <button type="button" id="cabinet-warp-close" style="appearance:none;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:10px 20px;border-radius:12px;cursor:pointer;">Close</button>
      </div>
    </section>
    <div class="cabinet-launch-overlay" id="cabinet-launch-overlay">
      <div class="cabinet-launch-card">
        <p style="font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 12px;">Loading ${safeTitle}</p>
        <div class="cabinet-progress-track"><div class="cabinet-progress-bar" id="cabinet-progress-bar"></div></div>
        <p id="cabinet-launch-status" style="margin-top:12px;font-size:11px;opacity:0.6;">Initializing...</p>
      </div>
    </div>
    <div class="cabinet-toast" id="cabinet-toast"></div>
    <div id="game"></div>
    <script>
      window.CABINET_RETURN_TO = ${safeReturnTo};
    </script>
    <script src="./bootstrap.js"></script>
  </body>
</html>`;
}

export function renderEmulatorBootstrap({
  core,
  title,
  gameId,
  romId,
  discs,
  raUsername,
  raToken,
  controlDefaults,
  gamepadBindings,
  controlDefaultsP2,
  gamepadBindingsP2,
  gamepadRumble,
  systemDisplay,
  globalAspectRatio,
  globalShader,
  userId,
  userName,
  profileId,
  cheats,
  biosUrl,
}: any) {
  return `"use strict";
function cabinetToast(msg) {
  var t = document.querySelector("#cabinet-toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(function() { t.classList.remove("show"); }, 2000);
}
var cabinetLaunchProgress = 0;
function cabinetSetLaunchProgress(percent, status) {
  cabinetLaunchProgress = Math.max(cabinetLaunchProgress, percent);
  var bar = document.querySelector("#cabinet-progress-bar");
  var statusText = document.querySelector("#cabinet-launch-status");
  if (bar) bar.style.width = cabinetLaunchProgress + "%";
  if (statusText) statusText.textContent = status || "Loading...";
}
function cabinetSetEmulatorSaveSlot(slot) {
  if (window.EJS_emulator) {
    window.EJS_emulator.settings["save-state-slot"] = String(slot);
    if (typeof window.EJS_emulator.changeSettingOption === "function") {
      window.EJS_emulator.changeSettingOption("save-state-slot", String(slot));
    }
  }
}
async function cabinetRecordSaveSlot(slot) {
  try {
    var res = await fetch("./save-states/" + slot, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({label: "Slot "+slot}) });
    if (!res.ok) {
       var err = await res.json().catch(function(){return {message:"Metadata update failed"};});
       throw new Error(err.message);
    }
  } catch(e) {
    console.error("[Record] Failed:", e);
    throw e;
  }
}
async function cabinetBackupSlot(slot) {
  var emu = window.EJS_emulator;
  if (!emu || !emu.gameManager || !emu.gameManager.FS) throw new Error("Emulator filesystem not ready");
  var FS = emu.gameManager.FS;
  if (typeof FS.syncfs === "function") {
    await new Promise(function(resolve) { FS.syncfs(false, resolve); });
  }
  
  var data = null;
  var gId = ${JSON.stringify(userId + "_" + gameId)};
  var paths = [
    "/" + gId + "-" + slot + ".state", 
    "/" + slot + "-quick.state",
    "/" + gId + "/auto.state",
    "/auto.state"
  ];

  try {
    var files = FS.readdir("/");
    console.log("[Warp] Files on virtual disk:", files);
  } catch(e) {}

  for (var i=0; i<paths.length; i++) {
    try { 
      data = FS.readFile(paths[i]); 
      if (data && data.length > 0) {
        console.log("[Warp] Found save data at " + paths[i]);
        break; 
      }
    } catch(e) {}
  }

  if (!data || data.length === 0) throw new Error("Save file not found on virtual disk");
  
  var res = await fetch("./save-backup/" + slot, { 
    method: "PUT", 
    headers: { "Content-Type": "application/octet-stream" },
    body: data 
  });
  if (!res.ok) {
    var errBody = await res.json().catch(function(){ return {message:"Server rejected backup ("+res.status+")"}; });
    throw new Error(errBody.message);
  }
}
async function cabinetRestoreBackup(slot) {
  var emu = window.EJS_emulator;
  if (!emu || !emu.gameManager || !emu.gameManager.FS) return;
  var FS = emu.gameManager.FS;
  
  console.log("[Warp] Restoring backup for slot " + slot + "...");
  var res = await fetch("./save-backup/" + slot);
  if (!res.ok) {
    console.log("[Warp] No remote backup found for slot " + slot);
    return;
  }
  
  var data = new Uint8Array(await res.arrayBuffer());
  var gId = ${JSON.stringify(userId + "_" + gameId)};
  var paths = [
    "/" + gId + "-" + slot + ".state", 
    "/" + slot + "-quick.state",
    "/" + gId + "/auto.state",
    "/auto.state"
  ];
  
  try { FS.mkdir("/" + gId); } catch(e) {}
  
  for (var i=0; i<paths.length; i++) {
    try {
       FS.writeFile(paths[i], data);
       console.log("[Warp] Restored backup to " + paths[i]);
    } catch(e) {}
  }

  if (typeof FS.syncfs === "function") {
    await new Promise(function(resolve) { FS.syncfs(false, resolve); });
  }
}
function cabinetSetPanelOpen(id, open) {
  var el = document.getElementById(id);
  var backdrop = document.getElementById("cabinet-menu-backdrop");
  if (!el || !backdrop) return;
  el.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
}
function cabinetSetupWarp() {
  var btn = document.querySelector("#cabinet-warp-open");
  if (!btn) return;
  btn.onclick = async function() {
    var menu = document.getElementById("cabinet-menu-panel");
    if (menu) menu.classList.remove("is-open");
    cabinetSetPanelOpen("cabinet-warp-panel", true);
    var qr = document.querySelector("#cabinet-warp-qr");
    qr.innerHTML = '<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#000;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:20px;">Warping...</div>';
    var slot = 9; // Slot 9 is the primary handoff point (Slot 0 is fallback)
    
    cabinetSetEmulatorSaveSlot(slot);
    var emu = window.EJS_emulator;
    var saved = false;
    
    console.log("[Warp] Triggering save to slot " + slot + "...");
    if (emu && emu.gameManager && typeof emu.gameManager.quickSave === "function") {
      try { saved = !!emu.gameManager.quickSave(String(slot)); } catch(e) { saved = false; }
    }
    if (!saved && emu && typeof emu.saveState === "function") {
      try { emu.saveState(); saved = true; } catch(e) { saved = false; }
    }
    if (!saved) { cabinetSendInput(24, "1"); }
    
    var attempt = 0;
    var check = async function() {
      try {
        attempt++;
        await cabinetBackupSlot(slot);
        await cabinetRecordSaveSlot(slot);
        var url = new URL(window.location.href);
        url.searchParams.set("loadSlot", String(slot));
        url.searchParams.set("warp", "true");
        
        // Populate manual link
        var manualBox = document.getElementById("cabinet-warp-manual");
        var manualInput = document.getElementById("cabinet-warp-url");
        if (manualBox && manualInput) {
          manualInput.value = url.toString();
          manualBox.style.display = "block";
        }
        
        // Correct path: from /api/roms/:id/player to /api/roms/warp-qr is ../warp-qr
        var response = await fetch("../warp-qr?url=" + encodeURIComponent(url.toString()));
        var data = await response.json();
        if (data.dataUrl) {
          qr.innerHTML = '<img src="'+data.dataUrl+'" style="display:block;margin:0 auto;max-width:100%;height:auto;border-radius:8px;box-shadow:0 0 20px rgba(0,0,0,0.2);" />';
          cabinetToast("Warp Point Ready ✨");
        } else {
          throw new Error("QR Generation Failed");
        }
      } catch(e) {
        console.warn("[Warp] Sync attempt " + attempt + " failed: " + e.message);
        if (attempt < 8) setTimeout(check, 1500);
        else {
          qr.innerHTML = '<div style="color:#ef4444;font-size:10px;padding:20px;text-transform:uppercase;font-weight:900;">Warp Failed</div><div style="font-size:9px;opacity:0.6;padding:0 10px;">' + e.message + '</div>';
          cabinetToast("Warp failed");
        }
      }
    };
    setTimeout(check, 1200);
  };
  var closeBtn = document.getElementById("cabinet-warp-close");
  if (closeBtn) closeBtn.onclick = function() { cabinetSetPanelOpen("cabinet-warp-panel", false); };
}
function cabinetSetupSystemMenu() {
  var btn = document.getElementById("cabinet-menu-toggle");
  var backdrop = document.getElementById("cabinet-menu-backdrop");
  var panel = document.getElementById("cabinet-menu-panel");
  var exitBtn = document.getElementById("cabinet-exit");
  if (!btn || !backdrop || !panel) return;
  btn.onclick = function() {
    panel.classList.toggle("is-open");
    backdrop.classList.toggle("is-open");
  };
  backdrop.onclick = function() {
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    cabinetSetPanelOpen("cabinet-warp-panel", false);
  };
  if (exitBtn) {
    exitBtn.onclick = function() {
      if (window.CABINET_RETURN_TO) {
        window.location.href = window.CABINET_RETURN_TO;
      } else {
        window.location.href = "/";
      }
    };
  }
}
window.EJS_ready = function () { cabinetSetLaunchProgress(62, "Core ready"); };
window.EJS_onGameStart = function() {
  cabinetSetLaunchProgress(100, "Ready");
  setTimeout(function() { document.getElementById("cabinet-launch-overlay").classList.add("is-hidden"); }, 500);
  var params = new URLSearchParams(window.location.search);
  var loadSlot = params.get("loadSlot");
  if (loadSlot) {
    (async function() {
      try {
        await cabinetRestoreBackup(Number(loadSlot));
        setTimeout(function() { window.EJS_emulator.loadState(Number(loadSlot)); }, 2000);
      } catch(e) {
        console.error("[Warp] Restore failed:", e);
      }
    })();
  }
};
cabinetSetupSystemMenu();
cabinetSetupWarp();
cabinetSetLaunchProgress(20, "Booting...");
window.EJS_player = "#game";
window.EJS_core = ${JSON.stringify(core)};
window.EJS_gameName = ${JSON.stringify(title)};
window.EJS_gameID = ${JSON.stringify(userId + "_" + gameId)};
${discs?.length > 1 ? `window.EJS_discs = ${JSON.stringify(discs.map((d: any) => ({ fileName: `../\${d.id}/file`, label: d.label })))};` : `window.EJS_gameUrl = \"./file\";`}
window.EJS_pathtodata = \"../../emulatorjs/\";
window.EJS_startOnLoaded = true;
var loader = document.createElement(\"script\");
loader.src = \"../../emulatorjs/loader.js\";
document.body.appendChild(loader);
`;
}
