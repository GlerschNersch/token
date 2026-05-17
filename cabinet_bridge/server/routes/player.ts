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
      .cabinet-menu-panel__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
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
        background: rgba(236,72,153,0.34);
        border-color: rgba(236,72,153,0.75);
        outline: none;
      }
      #game canvas {
        transition: filter 0.2s;
      }
      /* Filters — !important overrides EmulatorJS inline canvas styles */
      #game.cabinet-filter-crt canvas {
        filter: contrast(1.15) brightness(0.92) saturate(1.2) !important;
      }
      #game.cabinet-filter-smooth canvas {
        image-rendering: auto !important;
        filter: blur(0.5px) brightness(1.02) !important;
      }
      #game.cabinet-filter-scanlines {
        position: relative !important;
      }
      #game.cabinet-filter-scanlines canvas {
        image-rendering: pixelated !important;
        filter: contrast(1.1) brightness(0.85) !important;
      }
      #game.cabinet-filter-scanlines::after {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 3px);
        pointer-events: none;
        z-index: 999;
      }
      #game.cabinet-filter-lcd canvas {
        image-rendering: pixelated !important;
        filter: contrast(1.3) brightness(1.1) saturate(0.7) !important;
      }
      #game.cabinet-filter-phosphor canvas {
        filter: contrast(1.1) brightness(0.95) saturate(0) sepia(1) hue-rotate(90deg) !important;
      }
      /* Aspect ratio — !important overrides EmulatorJS inline width/height */
      #game.cabinet-aspect-4-3,
      #game.cabinet-aspect-16-9,
      #game.cabinet-aspect-pixel,
      #game.cabinet-aspect-stretch {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden;
      }
      #game.cabinet-aspect-4-3 canvas {
        width: auto !important;
        height: 100% !important;
        aspect-ratio: 4/3 !important;
        max-width: 100% !important;
        image-rendering: auto;
      }
      #game.cabinet-aspect-16-9 canvas {
        width: auto !important;
        height: 100% !important;
        aspect-ratio: 16/9 !important;
        max-width: 100% !important;
        image-rendering: auto;
      }
      #game.cabinet-aspect-pixel canvas {
        width: auto !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 100% !important;
        image-rendering: pixelated !important;
        aspect-ratio: unset !important;
      }
      #game.cabinet-aspect-stretch canvas {
        width: 100% !important;
        height: 100% !important;
        aspect-ratio: unset !important;
      }
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
      .cabinet-toast.show {
        opacity: 1;
      }
      #game {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #game canvas,
      #game iframe,
      #game video {
        max-width: 100vw !important;
      }
      .ejs_virtualGamepad_parent,
      .ejs_virtualGamepad_open,
      .ejs_menu_bar,
      .ejs_context_menu {
        display: none !important;
        pointer-events: none !important;
      }
      .cabinet-launch-overlay {
        position: fixed;
        z-index: 999998;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at 50% 32%, rgba(236, 72, 153, 0.22), transparent 34%),
          linear-gradient(180deg, rgba(5, 5, 7, 0.92), rgba(5, 5, 7, 0.72));
        color: #f8fafc;
        opacity: 1;
        pointer-events: none;
        transition: opacity 240ms ease, visibility 240ms ease;
        visibility: visible;
      }
      .cabinet-launch-overlay.is-hidden {
        opacity: 0;
        visibility: hidden;
      }
      .cabinet-launch-card {
        width: min(88vw, 520px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 22px;
        background: rgba(11, 11, 16, 0.78);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.52);
        padding: 22px;
        text-align: left;
        backdrop-filter: blur(18px);
      }
      .cabinet-launch-title {
        margin: 0 0 8px;
        color: #f8fafc;
        font: 800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .cabinet-launch-status {
        margin: 0 0 16px;
        color: rgba(248, 250, 252, 0.72);
        font: 700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        line-height: 1.6;
      }
      .cabinet-progress-track {
        width: 100%;
        height: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
      }
      .cabinet-progress-bar {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ec4899, #f9a8d4);
        box-shadow: 0 0 22px rgba(236, 72, 153, 0.45);
        transition: width 260ms ease;
      }
      .cabinet-progress-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 10px;
        color: rgba(248, 250, 252, 0.58);
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .loading {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
        background:
          radial-gradient(circle at 50% 30%, rgba(168, 85, 247, 0.24), transparent 45%),
          #050507;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-size: 12px;
        text-align: center;
      }
      .hint {
        max-width: 520px;
        color: rgba(248, 250, 252, 0.7);
        letter-spacing: 0.08em;
        line-height: 1.7;
        text-transform: none;
        font-size: 11px;
      }
      .virtual-pad {
        position: fixed;
        z-index: 999997;
        inset: 76px 0 0;
        pointer-events: none;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .virtual-pad.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .virtual-pad[hidden] {
        display: none;
      }
      .virtual-pad__tray {
        display: none;
      }
      .virtual-pad__hide {
        display: none;
      }
      .virtual-pad button {
        appearance: none;
        min-width: 54px;
        min-height: 54px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 999px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.07)),
          rgba(5, 5, 7, 0.58);
        color: #f8fafc;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.16),
          0 10px 28px rgba(0, 0, 0, 0.38);
        cursor: pointer;
        font: 800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        letter-spacing: 0.08em;
        pointer-events: auto;
        text-transform: uppercase;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .virtual-pad button:focus-visible {
        border-color: rgba(236, 72, 153, 0.9);
        outline: 2px solid rgba(236, 72, 153, 0.42);
        outline-offset: 3px;
      }
      .virtual-pad button.is-pressed,
      .virtual-pad button:active {
        background:
          linear-gradient(180deg, rgba(236, 72, 153, 0.54), rgba(236, 72, 153, 0.26)),
          rgba(5, 5, 7, 0.66);
        border-color: rgba(236, 72, 153, 0.95);
        transform: translateY(2px) scale(0.97);
      }
      .virtual-pad__shoulders {
        position: absolute;
        top: 8px;
        left: max(18px, env(safe-area-inset-left));
        right: max(18px, env(safe-area-inset-right));
        display: flex;
        justify-content: space-between;
      }
      .virtual-pad__shoulders button {
        min-width: min(26vw, 128px);
        border-radius: 18px;
      }
      .virtual-pad__dpad {
        position: absolute;
        left: max(18px, env(safe-area-inset-left));
        bottom: max(24px, env(safe-area-inset-bottom));
        display: grid;
        grid-template-columns: repeat(3, 58px);
        grid-template-rows: repeat(3, 58px);
        gap: 6px;
        pointer-events: none;
      }
      .virtual-pad__dpad .up {
        grid-column: 2;
        grid-row: 1;
      }
      .virtual-pad__dpad .left {
        grid-column: 1;
        grid-row: 2;
      }
      .virtual-pad__dpad .right {
        grid-column: 3;
        grid-row: 2;
      }
      .virtual-pad__dpad .down {
        grid-column: 2;
        grid-row: 3;
      }
      .virtual-pad__dpad-core {
        grid-column: 2;
        grid-row: 2;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.1);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      }
      .virtual-pad__face {
        position: absolute;
        right: max(18px, env(safe-area-inset-right));
        bottom: max(28px, env(safe-area-inset-bottom));
        display: grid;
        grid-template-columns: repeat(3, 58px);
        grid-template-rows: repeat(3, 58px);
        gap: 6px;
        pointer-events: none;
      }
      .virtual-pad__face .y {
        grid-column: 1;
        grid-row: 2;
      }
      .virtual-pad__face .x {
        grid-column: 2;
        grid-row: 1;
      }
      .virtual-pad__face .b {
        grid-column: 2;
        grid-row: 3;
      }
      .virtual-pad__face .a {
        grid-column: 3;
        grid-row: 2;
      }
      .virtual-pad__system {
        position: absolute;
        left: 50%;
        bottom: max(28px, env(safe-area-inset-bottom));
        display: flex;
        gap: 12px;
        transform: translateX(-50%);
      }
      .virtual-pad__system button {
        min-width: 86px;
        min-height: 44px;
        border-radius: 16px;
        font-size: 10px;
      }
      @media (max-width: 720px) {
        body.cabinet-pad-mobile.cabinet-pad-on #game {
          height: var(--cabinet-emu-height, min(54vh, 460px));
          min-height: 240px;
          overflow: hidden;
        }
        body.cabinet-pad-mobile.cabinet-pad-on #game canvas,
        body.cabinet-pad-mobile.cabinet-pad-on #game iframe,
        body.cabinet-pad-mobile.cabinet-pad-on #game video {
          max-height: var(--cabinet-emu-height, min(54vh, 460px)) !important;
        }
        .cabinet-menu-panel {
          left: 12px;
          right: 12px;
          top: max(72px, calc(env(safe-area-inset-top) + 66px));
          width: auto;
        }
        .cabinet-toast {
          top: max(78px, calc(env(safe-area-inset-top) + 70px));
        }
        .cabinet-save-panel {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 34px);
        }
        .cabinet-save-grid {
          grid-template-columns: 1fr;
          gap: 8px;
          max-height: calc(100dvh - 128px);
          padding: 10px 12px 14px;
        }
        .cabinet-save-panel__header {
          padding: 16px 16px 12px;
        }
        .cabinet-save-slot {
          padding: 10px;
          border-radius: 16px;
        }
        .cabinet-save-slot__meta {
          min-height: 18px;
        }
        .cabinet-save-slot__actions {
          margin-top: 8px;
        }
        .cabinet-save-slot button {
          min-height: 34px;
        }
        body.cabinet-pad-mobile .virtual-pad {
          inset: auto 0 0 0;
          height: var(--cabinet-tray-height, max(46vh, 360px));
          pointer-events: none;
        }
        body.cabinet-pad-mobile .virtual-pad__tray {
          position: absolute;
          inset: 0;
          display: block;
          pointer-events: auto;
          background:
            radial-gradient(120% 80% at 50% -10%, rgba(236, 72, 153, 0.12), transparent 60%),
            linear-gradient(180deg, rgba(11, 11, 16, 0.92), rgba(5, 5, 7, 0.98));
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.5);
        }
        body.cabinet-pad-mobile .virtual-pad__hide {
          position: absolute;
          z-index: 2;
          top: 6px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          appearance: none;
          min-width: 96px;
          min-height: 22px;
          padding: 4px 14px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          background: rgba(5, 5, 7, 0.7);
          color: rgba(248, 250, 252, 0.78);
          font: 800 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          cursor: pointer;
          pointer-events: auto;
          touch-action: manipulation;
        }
        body.cabinet-pad-mobile .virtual-pad__hide:hover,
        body.cabinet-pad-mobile .virtual-pad__hide:focus-visible {
          background: rgba(236, 72, 153, 0.34);
          border-color: rgba(236, 72, 153, 0.7);
          color: #f8fafc;
          outline: none;
        }
        .virtual-pad__shoulders {
          position: absolute;
          left: max(14px, env(safe-area-inset-left));
          right: max(14px, env(safe-area-inset-right));
          top: 38px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          pointer-events: none;
        }
        .virtual-pad__shoulders button {
          min-width: min(22vw, 90px);
          min-height: 40px;
          border-radius: 14px;
          font-size: 11px;
          pointer-events: auto;
        }
        .virtual-pad__system {
          position: absolute;
          top: 38px;
          left: 50%;
          bottom: auto;
          transform: translateX(-50%);
          display: flex;
          gap: 10px;
          pointer-events: none;
        }
        .virtual-pad__system button {
          min-width: 78px;
          min-height: 40px;
          border-radius: 14px;
          font-size: 10px;
          pointer-events: auto;
        }
        .virtual-pad__dpad,
        .virtual-pad__face {
          --cabinet-pad-cell: clamp(44px, calc((100vw - 68px) / 6), 60px);
          --cabinet-pad-gap: 6px;
          bottom: max(20px, env(safe-area-inset-bottom));
          grid-template-columns: repeat(3, var(--cabinet-pad-cell));
          grid-template-rows: repeat(3, var(--cabinet-pad-cell));
          gap: var(--cabinet-pad-gap);
          pointer-events: none;
          max-width: calc(50vw - 12px);
        }
        .virtual-pad__dpad {
          left: max(10px, env(safe-area-inset-left));
        }
        .virtual-pad__face {
          right: max(10px, env(safe-area-inset-right));
        }
        .virtual-pad button {
          min-width: 44px;
          min-height: 44px;
        }
        .virtual-pad__dpad button,
        .virtual-pad__face button {
          width: var(--cabinet-pad-cell);
          height: var(--cabinet-pad-cell);
        }
      }
      @media (max-width: 520px) {
        .virtual-pad__shoulders button,
        .virtual-pad__system button {
          min-height: 38px;
        }
        .virtual-pad__system button {
          min-width: 70px;
          font-size: 10px;
        }
      }
      @media (max-width: 360px) {
        .virtual-pad__system button {
          min-width: 62px;
        }
      }
      /* Landscape phone — full-screen game with controls overlaid */
      @media (max-height: 500px) and (orientation: landscape) {
        body.cabinet-pad-mobile.cabinet-pad-on #game {
          height: 100dvh !important;
          width: 100dvw !important;
        }
        body.cabinet-pad-mobile.cabinet-pad-on #game canvas,
        body.cabinet-pad-mobile.cabinet-pad-on #game iframe,
        body.cabinet-pad-mobile.cabinet-pad-on #game video {
          max-height: 100dvh !important;
        }
        body.cabinet-pad-mobile .virtual-pad {
          inset: 0 !important;
          height: 100dvh !important;
        }
        body.cabinet-pad-mobile .virtual-pad__tray {
          background: none !important;
          border-top: none !important;
          box-shadow: none !important;
        }
        .virtual-pad__dpad,
        .virtual-pad__face {
          --cabinet-pad-cell: clamp(34px, 9dvh, 48px);
          bottom: max(6px, env(safe-area-inset-bottom));
        }
        .virtual-pad__shoulders button,
        .virtual-pad__system button {
          min-height: 30px;
          min-width: 58px;
        }
        .virtual-pad__shoulders,
        .virtual-pad__system {
          top: 10px;
        }
      }
      /* Haptic feedback on supported devices — pulse animation on button press */
      @supports (touch-action: manipulation) {
        .virtual-pad button:active {
          transform: scale(0.88);
          opacity: 0.85;
          transition: transform 60ms ease, opacity 60ms ease;
        }
      }
    </style>
  </head>
  <body>
    <button type="button" class="cabinet-menu-button" id="cabinet-menu-toggle" aria-expanded="false" aria-controls="cabinet-menu-panel" data-testid="button-open-player-menu">Menu</button>
    <div class="cabinet-menu-backdrop" id="cabinet-menu-backdrop" aria-hidden="true"></div>
    <nav class="cabinet-menu-panel" id="cabinet-menu-panel" aria-label="Game system menu" aria-hidden="true">
      <div class="cabinet-menu-panel__header">
        <div>
          <p class="cabinet-menu-title">${safeTitle}</p>
          <p class="cabinet-menu-subtitle">Save · Load · Controls · Exit</p>
          ${romHash ? `<p class="cabinet-menu-hash" title="MD5: ${romHash}" id="cabinet-rom-hash" data-hash="${romHash}">MD5 ···${romHash.slice(-8)}</p>` : ""}
        </div>
        <span class="cabinet-user-badge" id="cabinet-user-badge" title="Saves are stored per user" hidden></span>
      </div>
      <div class="cabinet-menu-grid">
        <button type="button" class="primary-action" id="cabinet-resume" data-testid="button-resume-game">Resume Game</button>
        <button type="button" id="cabinet-save" data-testid="button-quick-save">Quick Save</button>
        <button type="button" id="cabinet-load" data-testid="button-quick-load">Quick Load</button>
        <button type="button" id="cabinet-save-manager-open" data-testid="button-open-save-manager">Save Slots</button>
        <button type="button" id="cabinet-pad-toggle" aria-pressed="false" data-testid="button-toggle-gamepad">Show Pad</button>
        <button type="button" id="cabinet-controls" data-testid="button-show-controls">Controls</button>
        <button type="button" id="cabinet-rewind-toggle" aria-pressed="false" data-testid="button-toggle-rewind">Rewind</button>
        <button type="button" id="cabinet-ff-toggle" aria-pressed="false" data-testid="button-toggle-fastforward">Fast-Fwd</button>
        <button type="button" id="cabinet-cheats" data-testid="button-cheats">Cheats</button>
        <button type="button" id="cabinet-screenshot" data-testid="button-screenshot">Screenshot</button>
        <button type="button" id="cabinet-display-open" data-testid="button-display-settings">Display</button>
        <button type="button" id="cabinet-remap-open" data-testid="button-remap-controls">Remap Keys</button>
        <button type="button" id="cabinet-gamepad-test-open" data-testid="button-gamepad-tester">Test Pad</button>
        <button type="button" id="cabinet-warp-open" data-testid="button-warp-handoff">Warp Link</button>
        <button type="button" id="cabinet-netplay-open" data-testid="button-netplay">Netplay</button>
        <button type="button" id="cabinet-sleep-open" data-testid="button-sleep-timer">Sleep Timer</button>
        <button type="button" id="cabinet-crt-toggle" aria-pressed="false" data-testid="button-crt-filter">CRT Filter</button>
        <div class="cabinet-menu-divider" role="separator"></div>
        <button type="button" class="danger" id="cabinet-exit" data-testid="button-exit-player">Exit Game</button>
      </div>
    </nav>
    <section class="cabinet-save-panel" id="cabinet-save-panel" aria-label="Save state manager" aria-hidden="true" data-testid="panel-save-manager">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Save-state Manager</p>
          <p class="cabinet-save-subtitle">Nine browser-local slots for this game · saved as <strong id="cabinet-save-user"></strong></p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-save-manager-close" aria-label="Close save-state manager" data-testid="button-close-save-manager">×</button>
      </div>
      <div class="cabinet-save-grid" id="cabinet-save-grid" data-testid="grid-save-slots"></div>
      <div style="padding:8px 14px 12px;display:flex;justify-content:flex-end;">
        <button type="button" id="cabinet-sync-from-server" style="appearance:none;border:1px solid rgba(99,179,237,0.35);border-radius:10px;background:rgba(99,179,237,0.08);color:#93c5fd;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:7px 12px;text-transform:uppercase;" data-testid="button-sync-from-server" title="Pull any server backup slots that are missing locally">☁ Sync from server</button>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-controls-panel" aria-label="Controls reference" aria-hidden="true" data-testid="panel-controls">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Controls</p>
          <p class="cabinet-save-subtitle" id="cabinet-controls-subtitle">Keyboard &amp; gamepad layout</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-controls-close" aria-label="Close controls" data-testid="button-close-controls">×</button>
      </div>
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:14px;" id="cabinet-controls-body">
        <!-- populated by cabinetRenderControls() -->
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-sleep-panel" aria-label="Sleep timer" aria-hidden="true" data-testid="panel-sleep-timer">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Sleep Timer</p>
          <p class="cabinet-save-subtitle">Auto-saves and exits after the chosen time</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-sleep-close" aria-label="Close sleep timer" data-testid="button-close-sleep-timer">×</button>
      </div>
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:16px;">
        <div id="cabinet-sleep-picker" style="display:flex;flex-direction:column;gap:10px;">
          <div style="color:rgba(248,250,252,0.56);font:800 9px ui-monospace,monospace;letter-spacing:0.18em;text-transform:uppercase;">Duration</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" id="cabinet-sleep-group" role="radiogroup" aria-label="Sleep duration">
            <button type="button" class="cabinet-opt" data-sleep-mins="15" data-testid="button-sleep-15">15 min</button>
            <button type="button" class="cabinet-opt" data-sleep-mins="30" data-testid="button-sleep-30">30 min</button>
            <button type="button" class="cabinet-opt" data-sleep-mins="45" data-testid="button-sleep-45">45 min</button>
            <button type="button" class="cabinet-opt" data-sleep-mins="60" data-testid="button-sleep-60">60 min</button>
          </div>
          <button type="button" id="cabinet-sleep-start" data-testid="button-start-sleep-timer"
            style="margin-top:4px;padding:9px 16px;border-radius:8px;font:700 12px ui-monospace,monospace;letter-spacing:0.08em;background:hsl(322 92% 60%);color:#fff;border:none;cursor:pointer;opacity:0.5;pointer-events:none;"
            disabled>Start Timer</button>
        </div>
        <div id="cabinet-sleep-running" style="display:none;flex-direction:column;align-items:center;gap:12px;text-align:center;">
          <div style="font:700 13px ui-monospace,monospace;color:rgba(248,250,252,0.56);letter-spacing:0.12em;text-transform:uppercase;">Time Remaining</div>
          <div id="cabinet-sleep-countdown" style="font:800 48px ui-monospace,monospace;color:#fff;letter-spacing:-0.02em;">--:--</div>
          <button type="button" id="cabinet-sleep-cancel" data-testid="button-cancel-sleep-timer"
            style="padding:9px 20px;border-radius:8px;font:700 12px ui-monospace,monospace;letter-spacing:0.08em;background:transparent;color:rgba(248,250,252,0.7);border:1px solid rgba(248,250,252,0.2);cursor:pointer;">Cancel Timer</button>
        </div>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-display-panel" aria-label="Display settings" aria-hidden="true" data-testid="panel-display-settings">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Display</p>
          <p class="cabinet-save-subtitle">Aspect ratio and visual filter</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-display-close" aria-label="Close display settings" data-testid="button-close-display">×</button>
      </div>
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:16px;">
        <div>
          <div style="color:rgba(248,250,252,0.56);font:800 9px ui-monospace,monospace;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">Aspect Ratio</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" id="cabinet-aspect-group" role="radiogroup" aria-label="Aspect ratio">
            <button type="button" role="radio" aria-checked="true" data-aspect="4:3" data-testid="button-aspect-4-3" class="cabinet-aspect-btn">4:3</button>
            <button type="button" role="radio" aria-checked="false" data-aspect="16:9" data-testid="button-aspect-16-9" class="cabinet-aspect-btn">16:9</button>
            <button type="button" role="radio" aria-checked="false" data-aspect="pixel" data-testid="button-aspect-pixel" class="cabinet-aspect-btn">Pixel</button>
            <button type="button" role="radio" aria-checked="false" data-aspect="stretch" data-testid="button-aspect-stretch" class="cabinet-aspect-btn">Fill</button>
          </div>
        </div>
        <div>
          <div style="color:rgba(248,250,252,0.56);font:800 9px ui-monospace,monospace;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px;">Visual Filter</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;" id="cabinet-filter-group" role="radiogroup" aria-label="Visual filter">
            <button type="button" role="radio" aria-checked="true" data-filter="none" data-testid="button-filter-none" class="cabinet-aspect-btn">None</button>
            <button type="button" role="radio" aria-checked="false" data-filter="crt" data-testid="button-filter-crt" class="cabinet-aspect-btn">CRT</button>
            <button type="button" role="radio" aria-checked="false" data-filter="smooth" data-testid="button-filter-smooth" class="cabinet-aspect-btn">Smooth</button>
            <button type="button" role="radio" aria-checked="false" data-filter="scanlines" data-testid="button-filter-scanlines" class="cabinet-aspect-btn">Scanlines</button>
            <button type="button" role="radio" aria-checked="false" data-filter="lcd" data-testid="button-filter-lcd" class="cabinet-aspect-btn">LCD</button>
            <button type="button" role="radio" aria-checked="false" data-filter="phosphor" data-testid="button-filter-phosphor" class="cabinet-aspect-btn">Phosphor</button>
          </div>
        </div>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-cheats-panel" aria-label="Cheat codes" aria-hidden="true" data-testid="panel-cheats">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Cheat Codes</p>
          <p class="cabinet-save-subtitle" id="cabinet-cheats-subtitle">Manage cheat codes for this game.</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-cheats-close" aria-label="Close cheat codes" data-testid="button-close-cheats">×</button>
      </div>
      <div style="padding:8px 18px 12px;display:flex;gap:6px;align-items:flex-end;">
        <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
          <label style="color:rgba(248,250,252,0.5);font:700 8px ui-monospace,monospace;letter-spacing:0.15em;text-transform:uppercase;">Description</label>
          <input id="cabinet-cheat-desc" type="text" placeholder="e.g. Infinite lives" autocomplete="off" style="background:#1a1a2e;border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:600 11px ui-monospace,monospace;padding:7px 10px;width:100%;box-sizing:border-box;" />
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
          <label style="color:rgba(248,250,252,0.5);font:700 8px ui-monospace,monospace;letter-spacing:0.15em;text-transform:uppercase;">Code</label>
          <input id="cabinet-cheat-code" type="text" placeholder="e.g. 7E0DBF63" autocomplete="off" style="background:#1a1a2e;border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:600 11px ui-monospace,monospace;padding:7px 10px;width:100%;box-sizing:border-box;font-family:ui-monospace,monospace;" />
        </div>
        <button type="button" id="cabinet-cheat-add" data-testid="button-cheat-add" style="appearance:none;border:1px solid rgba(99,179,100,0.4);border-radius:8px;background:rgba(99,179,100,0.15);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:7px 12px;text-transform:uppercase;white-space:nowrap;">+ Add</button>
      </div>
      <div id="cabinet-cheats-list" style="padding:0 18px 16px;display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;"></div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-remap-panel" aria-label="Key remapping" aria-hidden="true" data-testid="panel-remap">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Remap Keys</p>
          <p class="cabinet-save-subtitle">Click a button, then press a key. Saved locally.</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-remap-close" aria-label="Close key remapping" data-testid="button-close-remap">×</button>
      </div>
      <div style="padding:8px 18px 0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <select id="cabinet-remap-profile-select" style="flex:1;min-width:90px;background:#1a1a2e;border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:600 10px ui-monospace,monospace;padding:6px 8px;cursor:pointer;" aria-label="Select remap profile"></select>
        <button type="button" id="cabinet-remap-profile-load" style="appearance:none;border:1px solid rgba(248,250,252,0.2);border-radius:8px;background:rgba(248,250,252,0.08);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:6px 10px;text-transform:uppercase;">Load</button>
        <button type="button" id="cabinet-remap-profile-save" style="appearance:none;border:1px solid rgba(99,179,100,0.4);border-radius:8px;background:rgba(99,179,100,0.12);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:6px 10px;text-transform:uppercase;">Save As…</button>
        <button type="button" id="cabinet-remap-profile-delete" style="appearance:none;border:1px solid rgba(239,68,68,0.3);border-radius:8px;background:rgba(239,68,68,0.08);color:#f8fafc;cursor:pointer;font:700 9px ui-monospace,monospace;letter-spacing:0.1em;padding:6px 10px;text-transform:uppercase;">Del</button>
      </div>
      <div id="cabinet-remap-grid" style="padding:14px 18px 18px;display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow-y:auto;max-height:calc(min(86vh,720px)-130px);"></div>
      <div style="padding:0 18px 14px;display:flex;gap:8px;">
        <button type="button" id="cabinet-remap-reset" style="appearance:none;border:1px solid rgba(239,68,68,0.5);border-radius:12px;background:rgba(239,68,68,0.12);color:#f8fafc;cursor:pointer;font:800 9px ui-monospace,monospace;letter-spacing:0.12em;padding:10px 16px;text-transform:uppercase;">Reset to Defaults</button>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-gamepad-panel" aria-label="Gamepad tester" aria-hidden="true" data-testid="panel-gamepad-tester">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Gamepad Tester</p>
          <p class="cabinet-save-subtitle">Connect a controller and press any button to detect it.</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-gamepad-panel-close" aria-label="Close gamepad tester" data-testid="button-close-gamepad-tester">×</button>
      </div>
      <div id="cabinet-gamepad-tester-body" style="padding:14px 18px 18px;overflow-y:auto;max-height:calc(min(86vh,720px)-94px);">
        <p id="cabinet-gp-status" style="font:600 11px ui-monospace,monospace;color:rgba(248,250,252,0.5);letter-spacing:0.08em;margin:0 0 12px;">No controller detected yet. Press any button on your gamepad.</p>
        <div id="cabinet-gp-list" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-netplay-panel" aria-label="Netplay" aria-hidden="true" data-testid="panel-netplay">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Netplay</p>
          <p class="cabinet-save-subtitle">Play with a friend over the network</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-netplay-close" aria-label="Close netplay" data-testid="button-close-netplay">×</button>
      </div>
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button type="button" id="cabinet-netplay-host" style="appearance:none;border:1px solid rgba(99,179,237,0.4);border-radius:12px;background:rgba(99,179,237,0.12);color:#f8fafc;cursor:pointer;font:700 10px ui-monospace,monospace;letter-spacing:0.1em;padding:14px 10px;text-transform:uppercase;" data-testid="button-netplay-host">Host Game</button>
          <button type="button" id="cabinet-netplay-join" style="appearance:none;border:1px solid rgba(34,197,94,0.4);border-radius:12px;background:rgba(34,197,94,0.12);color:#f8fafc;cursor:pointer;font:700 10px ui-monospace,monospace;letter-spacing:0.1em;padding:14px 10px;text-transform:uppercase;" data-testid="button-netplay-join">Join Game</button>
        </div>
        <div id="cabinet-netplay-host-section" style="display:none;flex-direction:column;gap:8px;">
          <div style="font:600 10px ui-monospace,monospace;color:rgba(248,250,252,0.5);letter-spacing:0.1em;text-transform:uppercase;">Your Room Code</div>
          <div id="cabinet-netplay-room-code" style="font:800 28px ui-monospace,monospace;color:#f8fafc;letter-spacing:0.3em;text-align:center;padding:14px;background:rgba(248,250,252,0.05);border-radius:10px;border:1px solid rgba(248,250,252,0.1);cursor:pointer;user-select:all;" title="Click to copy" data-testid="text-netplay-room-code">—</div>
          <div style="font:11px ui-monospace,monospace;color:rgba(248,250,252,0.4);text-align:center;">Share this code with your opponent</div>
        </div>
        <div id="cabinet-netplay-join-section" style="display:none;flex-direction:column;gap:8px;">
          <div style="font:600 10px ui-monospace,monospace;color:rgba(248,250,252,0.5);letter-spacing:0.1em;text-transform:uppercase;">Enter Room Code</div>
          <div style="display:flex;gap:8px;">
            <input id="cabinet-netplay-code-input" type="text" maxlength="8" placeholder="XXXXXXXX" style="flex:1;background:rgba(248,250,252,0.06);border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:700 18px ui-monospace,monospace;letter-spacing:0.25em;padding:10px 12px;text-transform:uppercase;outline:none;" data-testid="input-netplay-code" />
            <button type="button" id="cabinet-netplay-connect" style="appearance:none;border:1px solid rgba(34,197,94,0.4);border-radius:8px;background:rgba(34,197,94,0.12);color:#f8fafc;cursor:pointer;font:700 10px ui-monospace,monospace;letter-spacing:0.1em;padding:10px 16px;text-transform:uppercase;" data-testid="button-netplay-connect">Connect</button>
          </div>
        </div>
        <div id="cabinet-netplay-status" style="font:600 11px ui-monospace,monospace;color:rgba(248,250,252,0.4);min-height:16px;" data-testid="text-netplay-status"></div>
      </div>
    </section>
    <section class="cabinet-save-panel" id="cabinet-warp-panel" aria-label="Warp link" aria-hidden="true" data-testid="panel-warp">
      <div class="cabinet-save-panel__header">
        <div>
          <p class="cabinet-save-title">Warp to Mobile</p>
          <p class="cabinet-save-subtitle">Scan to continue playing on your phone</p>
        </div>
        <button type="button" class="cabinet-save-close" id="cabinet-warp-close" aria-label="Close warp" data-testid="button-close-warp">×</button>
      </div>
      <div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;">
        <div id="cabinet-warp-qr" style="padding:16px;background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,0.5);">
          <div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#000;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;">Warping...</div>
        </div>
        <div id="cabinet-warp-manual" style="display:none;flex-direction:column;gap:8px;">
          <div style="font:600 11px ui-monospace,monospace;color:rgba(248,250,252,0.6);letter-spacing:0.05em;">QR generation failed. Manual warp link:</div>
          <input id="cabinet-warp-url" type="text" readonly style="background:#1a1a2e;border:1px solid rgba(248,250,252,0.15);border-radius:8px;color:#f8fafc;font:600 10px ui-monospace,monospace;padding:8px 10px;width:100%;box-sizing:border-box;" />
        </div>
        <div style="max-width:280px;color:rgba(248,250,252,0.6);font:600 11px ui-monospace,monospace;letter-spacing:0.05em;line-height:1.5;">
          Your current game state will be saved and synced automatically to a dedicated handoff slot.
        </div>
      </div>
    </section>
    <div class="cabinet-toast" id="cabinet-toast" role="status" aria-live="polite"></div>
    <div id="game">
      <div class="loading">
        <div>Loading ${safeTitle}</div>
        <div class="hint">If this message stays visible, the preview frame blocked the emulator loader. Use the standalone player button above, or run HomeArcade locally in Home Assistant.</div>
      </div>
    </div>
    <div class="cabinet-launch-overlay" id="cabinet-launch-overlay" role="status" aria-live="polite" data-testid="overlay-launch-progress">
      <div class="cabinet-launch-card">
        <p class="cabinet-launch-title">Loading ${safeTitle}</p>
        <p class="cabinet-launch-status" id="cabinet-launch-status">Preparing the emulator…</p>
        <div class="cabinet-progress-track" aria-hidden="true">
          <div class="cabinet-progress-bar" id="cabinet-progress-bar"></div>
        </div>
        <div class="cabinet-progress-meta">
          <span id="cabinet-progress-stage">Boot sequence</span>
          <span id="cabinet-progress-percent">0%</span>
        </div>
      </div>
    </div>
    <div class="virtual-pad" id="cabinet-gamepad" aria-label="Virtual gamepad overlay" hidden data-testid="overlay-virtual-gamepad">
      <div class="virtual-pad__tray" aria-hidden="true"></div>
      <button type="button" class="virtual-pad__hide" id="cabinet-pad-hide" data-testid="button-gamepad-hide" aria-label="Hide virtual gamepad">Hide Pad</button>
      <div class="virtual-pad__shoulders" aria-label="Shoulder buttons">
        <button type="button" data-vkey="q" data-ejs-input="10" data-testid="button-gamepad-l1" aria-label="L1 shoulder">L1</button>
        <button type="button" data-vkey="w" data-ejs-input="11" data-testid="button-gamepad-r1" aria-label="R1 shoulder">R1</button>
      </div>
      <div class="virtual-pad__system" aria-label="System buttons">
        <button type="button" data-vkey="Shift" data-ejs-input="2" data-testid="button-gamepad-select" aria-label="Select">Select</button>
        <button type="button" data-vkey="Enter" data-ejs-input="3" data-testid="button-gamepad-start" aria-label="Start">Start</button>
      </div>
      <div class="virtual-pad__dpad" aria-label="Directional pad">
        <button type="button" class="up" data-vkey="ArrowUp" data-ejs-input="4" data-testid="button-gamepad-up" aria-label="D-pad up">↑</button>
        <button type="button" class="left" data-vkey="ArrowLeft" data-ejs-input="6" data-testid="button-gamepad-left" aria-label="D-pad left">←</button>
        <span class="virtual-pad__dpad-core" aria-hidden="true"></span>
        <button type="button" class="right" data-vkey="ArrowRight" data-ejs-input="7" data-testid="button-gamepad-right" aria-label="D-pad right">→</button>
        <button type="button" class="down" data-vkey="ArrowDown" data-ejs-input="5" data-testid="button-gamepad-down" aria-label="D-pad down">↓</button>
      </div>
      <div class="virtual-pad__face" aria-label="Face buttons">
        <button type="button" class="x" data-vkey="s" data-ejs-input="9" data-testid="button-gamepad-x" aria-label="X button">X</button>
        <button type="button" class="y" data-vkey="a" data-ejs-input="1" data-testid="button-gamepad-y" aria-label="Y button">Y</button>
        <button type="button" class="b" data-vkey="z" data-ejs-input="0" data-testid="button-gamepad-b" aria-label="B button">B</button>
        <button type="button" class="a" data-vkey="x" data-ejs-input="8" data-testid="button-gamepad-a" aria-label="A button">A</button>
      </div>
    </div>
    <script>
      window.CABINET_RETURN_TO = ${safeReturnTo};
      console.log("[HomeArcade] player HTML inline script ran, loading bootstrap.js");
    </script>
    <script src="./bootstrap.js" onerror="(function(){var p=document.querySelector('#cabinet-progress-percent');var s=document.querySelector('#cabinet-progress-stage');if(p)p.textContent='ERR';if(s)s.textContent='bootstrap.js blocked';console.error('[HomeArcade] bootstrap.js FAILED to load');})()"></script>
  </body>
</html>`;
}

export function renderEmulatorBootstrap({
  core,
  title,
  gameId,
  romId,
  discs,
  romHash,
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
}: {
  core: string;
  title: string;
  gameId: string;
  romId: number;
  discs: Array<{ id: number; label: string }>;
  romHash: string | null;
  raUsername: string;
  raToken: string;
  controlDefaults: Record<string, Record<number, string>>;
  gamepadBindings: Record<number, number>;
  controlDefaultsP2: Record<number, string>;
  gamepadBindingsP2: Record<number, number>;
  gamepadRumble: boolean;
  systemDisplay: Record<string, { aspectRatio?: string; integerScale?: boolean; shader?: string }>;
  globalAspectRatio: string;
  globalShader: string;
  userId: string;
  userName: string;
  profileId: string;
  cheats: Array<{ description: string; code: string }>;
  biosUrl?: string | null;
}) {
  return `"use strict";
// Diagnostic: immediately mark that this script is executing.
// If the launch overlay stays at 0%, this script never ran.
(function () {
  var pct = document.querySelector("#cabinet-progress-percent");
  var stage = document.querySelector("#cabinet-progress-stage");
  var overlay = document.querySelector("#cabinet-launch-overlay");
  if (pct) pct.textContent = "2%";
  if (stage) stage.textContent = "Bootstrap";
  if (overlay) overlay.classList.remove("is-hidden");
  console.log("[HomeArcade] bootstrap.js executing for ROM ${romId} core=${core}");
})();
function cabinetToast(message) {
  var toast = document.querySelector("#cabinet-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(window.__cabinetToastTimer);
  window.__cabinetToastTimer = window.setTimeout(function () {
    toast.classList.remove("show");
  }, 1800);
}
var cabinetLaunchProgress = 0;
var cabinetLaunchTimer = null;
function cabinetSetLaunchProgress(percent, status, stage) {
  cabinetLaunchProgress = Math.max(cabinetLaunchProgress, Math.min(100, percent));
  var overlay = document.querySelector("#cabinet-launch-overlay");
  var bar = document.querySelector("#cabinet-progress-bar");
  var percentText = document.querySelector("#cabinet-progress-percent");
  var statusText = document.querySelector("#cabinet-launch-status");
  var stageText = document.querySelector("#cabinet-progress-stage");
  if (bar) bar.style.width = cabinetLaunchProgress + "%";
  if (percentText) percentText.textContent = Math.round(cabinetLaunchProgress) + "%";
  if (statusText && status) statusText.textContent = status;
  if (stageText && stage) stageText.textContent = stage;
  if (overlay) overlay.classList.remove("is-hidden");
}
function cabinetStartLaunchProgress() {
  cabinetSetLaunchProgress(8, "Loading emulator shell…", "Starting");
  var steps = [
    { at: 20, status: "Fetching ROM data…", stage: "ROM" },
    { at: 38, status: "Loading EmulatorJS core…", stage: "Core" },
    { at: 56, status: "Preparing controls and save state…", stage: "Controls" },
    { at: 72, status: "Decompressing game core…", stage: "Decompress" },
    { at: 88, status: "Starting game…", stage: "Launching" },
    { at: 94, status: "Almost ready…", stage: "Finalizing" }
  ];
  var index = 0;
  window.clearInterval(cabinetLaunchTimer);
  cabinetLaunchTimer = window.setInterval(function () {
    if (index < steps.length) {
      var step = steps[index++];
      cabinetSetLaunchProgress(step.at, step.status, step.stage);
      return;
    }
    if (cabinetLaunchProgress < 96) {
      cabinetSetLaunchProgress(cabinetLaunchProgress + 1, "Almost ready…", "Finalizing");
    }
  }, 700);
}
function cabinetFinishLaunchProgress(status) {
  cabinetSetLaunchProgress(100, status || "Game ready", "Ready");
  window.clearInterval(cabinetLaunchTimer);
  window.setTimeout(function () {
    var overlay = document.querySelector("#cabinet-launch-overlay");
    if (overlay) overlay.classList.add("is-hidden");
  }, 450);
}
function cabinetFailLaunchProgress(message) {
  window.clearInterval(cabinetLaunchTimer);
  cabinetSetLaunchProgress(Math.max(cabinetLaunchProgress, 96), message, "Needs attention");
}
cabinetStartLaunchProgress();
var cabinetPressedKeyCounts = {};
var cabinetPressedInputCounts = {};
function cabinetKeyCode(key) {
  var codes = {
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Enter: "Enter",
    Shift: "ShiftLeft",
    z: "KeyZ",
    x: "KeyX",
    a: "KeyA",
    s: "KeyS",
    q: "KeyQ",
    w: "KeyW",
    "1": "Digit1",
    "2": "Digit2",
    "3": "Digit3"
  };
  return codes[key] || key;
}
function cabinetKeyEvent(type, key) {
  return new KeyboardEvent(type, {
    key: key,
    code: cabinetKeyCode(key),
    bubbles: true,
    cancelable: true
  });
}
function cabinetDispatchKey(type, key) {
  var target = document.querySelector("canvas") || document.body;
  target.focus && target.focus();
  var event = cabinetKeyEvent(type, key);
  target.dispatchEvent(event);
  document.dispatchEvent(cabinetKeyEvent(type, key));
  window.dispatchEvent(cabinetKeyEvent(type, key));
}
function cabinetKeyDown(key) {
  cabinetPressedKeyCounts[key] = (cabinetPressedKeyCounts[key] || 0) + 1;
  if (cabinetPressedKeyCounts[key] === 1) {
    cabinetDispatchKey("keydown", key);
  }
}
function cabinetKeyUp(key) {
  if (!cabinetPressedKeyCounts[key]) return;
  cabinetPressedKeyCounts[key] -= 1;
  if (cabinetPressedKeyCounts[key] <= 0) {
    delete cabinetPressedKeyCounts[key];
    cabinetDispatchKey("keyup", key);
  }
}
function cabinetSimulateInput(inputValue, pressed) {
  var emulator = window.EJS_emulator;
  var value = pressed ? 1 : 0;
  if (emulator && emulator.gameManager && typeof emulator.gameManager.simulateInput === "function") {
    emulator.gameManager.simulateInput(0, inputValue, value);
    return true;
  }
  return false;
}
function cabinetInputDown(inputValue) {
  if (inputValue === null || Number.isNaN(inputValue)) return false;
  cabinetPressedInputCounts[inputValue] = (cabinetPressedInputCounts[inputValue] || 0) + 1;
  if (cabinetPressedInputCounts[inputValue] === 1) {
    return cabinetSimulateInput(inputValue, true);
  }
  return true;
}
function cabinetInputUp(inputValue) {
  if (inputValue === null || Number.isNaN(inputValue) || !cabinetPressedInputCounts[inputValue]) return false;
  cabinetPressedInputCounts[inputValue] -= 1;
  if (cabinetPressedInputCounts[inputValue] <= 0) {
    delete cabinetPressedInputCounts[inputValue];
    return cabinetSimulateInput(inputValue, false);
  }
  return true;
}
function cabinetPressControl(control, pressed) {
  var inputAttr = control.getAttribute("data-ejs-input");
  var inputValue = inputAttr === null ? null : Number(inputAttr);
  var usedNativeInput = pressed ? cabinetInputDown(inputValue) : cabinetInputUp(inputValue);
  var key = control.getAttribute("data-vkey");
  if (!usedNativeInput && key) {
    if (pressed) {
      cabinetKeyDown(key);
    } else {
      cabinetKeyUp(key);
    }
  }
}
function cabinetSendKey(key) {
  cabinetKeyDown(key);
  window.setTimeout(function () {
    cabinetKeyUp(key);
  }, 80);
}
function cabinetSendInput(inputValue, fallbackKey) {
  var usedNativeInput = cabinetInputDown(inputValue);
  if (!usedNativeInput && fallbackKey) {
    cabinetSendKey(fallbackKey);
    return;
  }
  window.setTimeout(function () {
    cabinetInputUp(inputValue);
  }, 80);
}
var cabinetRomId = ${JSON.stringify(romId)};
var cabinetRomHash = ${JSON.stringify(romHash || "")};
var cabinetSaveSlots = [];
var cabinetCurrentSaveSlot = 1;
function cabinetSaveStateEndpoint(slot) {
  return "./save-states" + (slot ? "/" + slot : "");
}
function cabinetRelativeTime(timestamp) {
  if (!timestamp) return "Empty slot";
  var diff = Date.now() - timestamp;
  var minute = 60 * 1000;
  var hour = 60 * minute;
  var day = 24 * hour;
  if (diff < minute) return "Saved just now";
  if (diff < hour) return "Saved " + Math.max(1, Math.round(diff / minute)) + "m ago";
  if (diff < day) return "Saved " + Math.max(1, Math.round(diff / hour)) + "h ago";
  return "Saved " + new Date(timestamp).toLocaleDateString();
}
function cabinetGetSaveSlot(slot) {
  return cabinetSaveSlots.find(function (item) {
    return item.slot === slot;
  }) || null;
}
function cabinetSetEmulatorSaveSlot(slot) {
  cabinetCurrentSaveSlot = slot;
  var emulator = window.EJS_emulator;
  if (emulator) {
    if (!emulator.settings) emulator.settings = {};
    emulator.settings["save-state-slot"] = String(slot);
    emulator.settings["save-state-location"] = "browser";
    if (typeof emulator.changeSettingOption === "function") {
      try {
        emulator.changeSettingOption("save-state-location", "browser");
        emulator.changeSettingOption("save-state-slot", String(slot));
      } catch (_error) {}
    }
  }
}
async function cabinetFetchSaveSlots() {
  try {
    var response = await fetch(cabinetSaveStateEndpoint());
    if (!response.ok) throw new Error("Save-state metadata failed");
    cabinetSaveSlots = await response.json();
  } catch (_error) {
    cabinetSaveSlots = [];
  }
  cabinetRenderSaveSlots();
}
async function cabinetCaptureThumb(slot) {
  try {
    var dataUrl = null;
    var emulator = window.EJS_emulator;
    if (emulator && typeof emulator.screenshot === "function") {
      try { dataUrl = emulator.screenshot(); } catch (_e) {}
    }
    if (!dataUrl || dataUrl === "data:,") {
      var canvas = document.querySelector("#game canvas");
      if (!canvas) return;
      var thumb = document.createElement("canvas");
      var scale = Math.min(1, 160 / canvas.width);
      thumb.width = Math.round(canvas.width * scale) || 160;
      thumb.height = Math.round(canvas.height * scale) || 120;
      var ctx = thumb.getContext("2d");
      if (!ctx) return;
      try {
        ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
        dataUrl = thumb.toDataURL("image/jpeg", 0.72);
      } catch (_e) { return; }
    }
    if (dataUrl && dataUrl.startsWith("data:image")) {
      var img = new Image();
      await new Promise(function(resolve) {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = dataUrl;
      });
      if (img.naturalWidth > 0) {
        var thumb2 = document.createElement("canvas");
        var scale2 = Math.min(1, 160 / img.naturalWidth);
        thumb2.width = Math.round(img.naturalWidth * scale2) || 160;
        thumb2.height = Math.round(img.naturalHeight * scale2) || 120;
        var ctx2 = thumb2.getContext("2d");
        if (ctx2) {
          ctx2.drawImage(img, 0, 0, thumb2.width, thumb2.height);
          dataUrl = thumb2.toDataURL("image/jpeg", 0.72);
        }
      }
    }
    if (!dataUrl || !dataUrl.startsWith("data:image")) return;
    var key = "cabinet_thumb_" + (window.EJS_gameID || "game") + "_" + slot;
    try { localStorage.setItem(key, dataUrl); } catch (_e) {}
    await fetch("./save-thumb/" + slot, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: dataUrl })
    }).catch(function() {});
  } catch (_e) {}
}
function cabinetGetThumb(slot) {
  var key = "cabinet_thumb_" + (window.EJS_gameID || "game") + "_" + slot;
  try { return localStorage.getItem(key) || null; } catch (_e) { return null; }
}
function cabinetDeleteThumb(slot) {
  var key = "cabinet_thumb_" + (window.EJS_gameID || "game") + "_" + slot;
  try { localStorage.removeItem(key); } catch (_e) {}
}
function cabinetGetThumbUrl(slot) {
  var local = cabinetGetThumb(slot);
  if (local) return local;
  return "./save-thumb/" + slot + "?t=" + Date.now();
}
function cabinetRenderSaveSlots() {
  var grid = document.querySelector("#cabinet-save-grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (var slot = 1; slot <= 9; slot += 1) {
    var state = cabinetGetSaveSlot(slot);
    var hasBackup = cabinetServerBackups.indexOf(slot) !== -1;
    var card = document.createElement("article");
    card.className = "cabinet-save-slot";
    card.setAttribute("data-filled", state ? "true" : "false");
    card.setAttribute("data-testid", "card-save-slot-" + slot);
    var thumbUrl = (state || hasBackup) ? cabinetGetThumbUrl(slot) : null;
    var thumbHtml = thumbUrl
      ? '<div class="cabinet-save-slot__thumb"><img src="' + thumbUrl + '" alt="Save slot ' + slot + ' preview" loading="lazy"></div>'
      : '<div class="cabinet-save-slot__thumb cabinet-save-slot__thumb--empty"></div>';
    var cloudBadge = hasBackup ? ' <span title="Server backup exists" style="font-size:10px;">&#9729;</span>' : "";
    card.innerHTML =
      thumbHtml +
      '<div class="cabinet-save-slot__eyebrow">Slot ' + slot + cloudBadge + '</div>' +
      '<div class="cabinet-save-slot__label">' + (state ? cabinetEscapeText(state.label || ("Slot " + slot)) : "Empty") + '</div>' +
      '<div class="cabinet-save-slot__meta">' + (state ? cabinetRelativeTime(state.updatedAt) : (hasBackup ? "No local save \u2014 server backup available" : "No save data yet")) + '</div>' +
      '<div class="cabinet-save-slot__actions">' +
      '<button type="button" data-save-action="save" data-slot="' + slot + '" data-testid="button-save-slot-' + slot + '">Save</button>' +
      '<button type="button" data-save-action="load" data-slot="' + slot + '" data-testid="button-load-slot-' + slot + '"' + (state ? "" : " disabled") + ">Load</button>" +
      '<button type="button" data-save-action="backup" data-slot="' + slot + '" data-testid="button-backup-slot-' + slot + '"' + (state ? "" : " disabled") + ' title="Back up to server" style="background:rgba(59,130,246,0.18);border-color:rgba(59,130,246,0.4);">&#9729; Backup</button>' +
      '<button type="button" data-save-action="restore" data-slot="' + slot + '" data-testid="button-restore-slot-' + slot + '"' + (hasBackup ? "" : " disabled") + ' title="Restore from server" style="background:rgba(34,197,94,0.18);border-color:rgba(34,197,94,0.4);">&#8635; Restore</button>' +
      '<button type="button" class="danger" data-save-action="delete" data-slot="' + slot + '" data-testid="button-delete-slot-' + slot + '"' + (state ? "" : " disabled") + ">Delete</button>" +
      "</div>";
    grid.appendChild(card);
  }
}
function cabinetEscapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function cabinetSetPanelOpen(panelId, open) {
  var panel = document.querySelector("#" + panelId);
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) { cabinetSetMenuOpen(false); }
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
}
var cabinetSleepSelectedMins = 0;
var cabinetSleepTimerId = null;
var cabinetSleepEndTime = 0;
var cabinetSleepTickId = null;
function cabinetSelectSleepDuration(mins) {
  cabinetSleepSelectedMins = mins;
  var btns = document.querySelectorAll("[data-sleep-mins]");
  btns.forEach(function(b) {
    var active = Number(b.getAttribute("data-sleep-mins")) === mins;
    b.style.background = active ? "hsl(322 92% 60%)" : "rgba(255,255,255,0.07)";
    b.style.color = active ? "#fff" : "rgba(248,250,252,0.8)";
    b.style.border = active ? "none" : "1px solid rgba(255,255,255,0.12)";
  });
  var startBtn = document.querySelector("#cabinet-sleep-start");
  if (startBtn) {
    startBtn.removeAttribute("disabled");
    startBtn.style.opacity = "1";
    startBtn.style.pointerEvents = "auto";
  }
}
function cabinetUpdateSleepCountdown() {
  var remaining = Math.max(0, cabinetSleepEndTime - Date.now());
  var totalSecs = Math.ceil(remaining / 1000);
  var mins = Math.floor(totalSecs / 60);
  var secs = totalSecs % 60;
  var el = document.querySelector("#cabinet-sleep-countdown");
  if (el) {
    el.textContent = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }
  if (remaining <= 0) {
    clearInterval(cabinetSleepTickId);
    cabinetSleepTickId = null;
    cabinetSleepFire();
  }
}
function cabinetSleepFire() {
  cabinetToast("Sleep timer: auto-saving and exiting…");
  var returnTo = window.CABINET_RETURN_TO || "";
  var duration = cabinetSessionStart ? Math.round((Date.now() - cabinetSessionStart) / 1000) : 0;
  var doExit = function() {
    fetch("./play-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "ended", durationSeconds: duration }),
    }).catch(function(){}).finally(function() {
      if (returnTo) { window.location.href = returnTo; return; }
      if (window.opener) { window.close(); return; }
      window.location.href = "/";
    });
  };
  if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
    try { window.EJS_emulator.saveState(0); } catch(e) {}
    setTimeout(doExit, 800);
  } else {
    doExit();
  }
}
function cabinetStartSleepTimer() {
  if (!cabinetSleepSelectedMins) return;
  cabinetSleepEndTime = Date.now() + cabinetSleepSelectedMins * 60 * 1000;
  var picker = document.querySelector("#cabinet-sleep-picker");
  var running = document.querySelector("#cabinet-sleep-running");
  if (picker) picker.style.display = "none";
  if (running) { running.style.display = "flex"; }
  cabinetUpdateSleepCountdown();
  cabinetSleepTickId = setInterval(cabinetUpdateSleepCountdown, 1000);
  cabinetSetPanelOpen("cabinet-sleep-panel", false);
  cabinetToast("Sleep timer set for " + cabinetSleepSelectedMins + " min");
}
function cabinetCancelSleepTimer() {
  if (cabinetSleepTickId) { clearInterval(cabinetSleepTickId); cabinetSleepTickId = null; }
  cabinetSleepEndTime = 0;
  var picker = document.querySelector("#cabinet-sleep-picker");
  var running = document.querySelector("#cabinet-sleep-running");
  if (picker) picker.style.display = "flex";
  if (running) running.style.display = "none";
  cabinetSetPanelOpen("cabinet-sleep-panel", false);
  cabinetToast("Sleep timer cancelled");
}
function cabinetSetSaveManagerOpen(open) {
  var panel = document.querySelector("#cabinet-save-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) {
    cabinetSetMenuOpen(false);
  }
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (open) {
    cabinetFetchServerBackups().then(function() { cabinetFetchSaveSlots(); });
    var closeButton = document.querySelector("#cabinet-save-manager-close");
    if (closeButton && closeButton.focus) {
      window.setTimeout(function () {
        closeButton.focus();
      }, 30);
    }
  }
}
async function cabinetRecordSaveSlot(slot) {
  var response = await fetch(cabinetSaveStateEndpoint(slot), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "Slot " + slot })
  });
  if (!response.ok) throw new Error("Could not save slot metadata");
  var saved = await response.json();
  cabinetSaveSlots = cabinetSaveSlots.filter(function (item) {
    return item.slot !== slot;
  }).concat(saved).sort(function (a, b) {
    return a.slot - b.slot;
  });
  cabinetRenderSaveSlots();
}
async function cabinetDeleteSaveSlotMetadata(slot) {
  await fetch(cabinetSaveStateEndpoint(slot), { method: "DELETE" });
  cabinetSaveSlots = cabinetSaveSlots.filter(function (item) {
    return item.slot !== slot;
  });
  cabinetRenderSaveSlots();
}
function cabinetQuickSaveSlot(slot) {
  cabinetSetEmulatorSaveSlot(slot);
  var emulator = window.EJS_emulator;
  var saved = false;
  if (emulator && emulator.gameManager && typeof emulator.gameManager.quickSave === "function") {
    try {
      saved = !!emulator.gameManager.quickSave(String(slot));
    } catch (_error) {
      saved = false;
    }
  }
  if (!saved) {
    cabinetSendInput(24, "1");
    saved = true;
  }
  setTimeout(function() {
    cabinetCaptureThumb(slot).then(function() {
      return cabinetBackupSlot(slot);
    }).catch(function() {});
  }, 800);
  cabinetRecordSaveSlot(slot)
    .then(function () {
      cabinetToast("Saved state to slot " + slot + " \u2601");
    })
    .catch(function () {
      cabinetToast("Saved locally, but metadata could not update");
    });
}
function cabinetQuickLoadSlot(slot) {
  cabinetSetEmulatorSaveSlot(slot);
  var emulator = window.EJS_emulator;
  var loaded = false;
  if (emulator && emulator.gameManager && typeof emulator.gameManager.quickLoad === "function") {
    try {
      emulator.gameManager.quickLoad(String(slot));
      loaded = true;
    } catch (_error) {
      loaded = false;
    }
  }
  if (!loaded) {
    cabinetSendInput(25, "2");
  }
  if (loaded) {
    cabinetToast("Loaded slot " + slot);
  } else {
    cabinetToast("Loading slot " + slot + "\u2026");
  }
}
function cabinetDeleteLocalSaveSlot(slot) {
  var emulator = window.EJS_emulator;
  if (emulator && emulator.gameManager && emulator.gameManager.FS) {
    var FS = emulator.gameManager.FS;
    var gameId = window.EJS_gameID || "";
    var pathsToTry = [
      "/" + gameId + "-" + slot + ".state",
      "/" + gameId + "-" + slot + ".state.png",
      "/" + slot + "-quick.state",
      slot + "-quick.state",
    ];
    for (var i = 0; i < pathsToTry.length; i++) {
      try { FS.unlink(pathsToTry[i]); } catch (_error) {}
    }
  }
  cabinetDeleteThumb(slot);
  cabinetDeleteSaveSlotMetadata(slot).then(function () {
    cabinetToast("Deleted slot " + slot);
  });
}
function cabinetSetupVirtualPad() {
  var pad = document.querySelector("#cabinet-gamepad");
  var toggle = document.querySelector("#cabinet-pad-toggle");
  var hideButton = document.querySelector("#cabinet-pad-hide");
  if (!pad || !toggle) return;
  var activePointers = {};
  var touchCapable =
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0;
  var visible = !!touchCapable;
  var mobileQuery = window.matchMedia ? window.matchMedia("(max-width: 720px)") : null;
  function syncMobileFlag() {
    if (mobileQuery && mobileQuery.matches) {
      document.body.classList.add("cabinet-pad-mobile");
    } else {
      document.body.classList.remove("cabinet-pad-mobile");
    }
  }
  syncMobileFlag();
  if (mobileQuery) {
    var mqHandler = function () { syncMobileFlag(); };
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener("change", mqHandler);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(mqHandler);
    }
  }
  function setPadVisible(nextVisible, announce) {
    visible = !!nextVisible;
    pad.hidden = !visible;
    pad.classList.toggle("is-visible", visible);
    document.body.classList.toggle("cabinet-pad-on", visible);
    toggle.setAttribute("aria-pressed", visible ? "true" : "false");
    toggle.textContent = visible ? "Hide Pad" : "Show Pad";
    if (announce) {
      cabinetToast(visible ? "Virtual gamepad shown" : "Virtual gamepad hidden");
    }
  }
  function releasePointer(pointerId) {
    var entry = activePointers[pointerId];
    if (!entry) return;
    delete activePointers[pointerId];
    entry.button.classList.remove("is-pressed");
    cabinetPressControl(entry.button, false);
  }
  toggle.addEventListener("click", function () {
    setPadVisible(!visible, true);
  });
  if (hideButton) {
    hideButton.addEventListener("click", function (event) {
      event.preventDefault();
      setPadVisible(false, true);
    });
  }
  pad.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
  pad.querySelectorAll("[data-ejs-input]").forEach(function (button) {
    button.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      if (activePointers[event.pointerId]) {
        releasePointer(event.pointerId);
      }
      activePointers[event.pointerId] = { button: button };
      button.classList.add("is-pressed");
      if (button.setPointerCapture) {
        try {
          button.setPointerCapture(event.pointerId);
        } catch (_error) {}
      }
      cabinetPressControl(button, true);
    });
    button.addEventListener("pointerup", function (event) {
      event.preventDefault();
      releasePointer(event.pointerId);
    });
    button.addEventListener("pointercancel", function (event) {
      releasePointer(event.pointerId);
    });
    button.addEventListener("lostpointercapture", function (event) {
      releasePointer(event.pointerId);
    });
  });
  window.addEventListener("blur", function () {
    Object.keys(activePointers).forEach(function (pointerId) {
      releasePointer(pointerId);
    });
    Object.keys(cabinetPressedKeyCounts).forEach(function (key) {
      cabinetPressedKeyCounts[key] = 1;
      cabinetKeyUp(key);
    });
    Object.keys(cabinetPressedInputCounts).forEach(function (inputValue) {
      cabinetPressedInputCounts[inputValue] = 1;
      cabinetInputUp(Number(inputValue));
    });
  });
  window.addEventListener("gamepadconnected", function (e) {
    cabinetToast("Controller connected: " + (e.gamepad.id || "gamepad").slice(0, 40));
    setPadVisible(false, false);
  });
  window.addEventListener("gamepaddisconnected", function () {
    var pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (pads.length === 0 && touchCapable) {
      setPadVisible(true, false);
    }
    cabinetToast("Controller disconnected");
  });
  setPadVisible(visible, false);
}
function cabinetSetMenuOpen(open) {
  var button = document.querySelector("#cabinet-menu-toggle");
  var panel = document.querySelector("#cabinet-menu-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!button || !panel || !backdrop) return;
  button.setAttribute("aria-expanded", open ? "true" : "false");
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (open) {
    var resume = document.querySelector("#cabinet-resume");
    if (resume && resume.focus) {
      window.setTimeout(function () {
        resume.focus();
      }, 30);
    }
  }
}
function cabinetSetupSystemMenu() {
  var button = document.querySelector("#cabinet-menu-toggle");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!button || !backdrop) return;
  button.addEventListener("click", function () {
    var isOpen = button.getAttribute("aria-expanded") === "true";
    cabinetSetMenuOpen(!isOpen);
  });
  backdrop.addEventListener("click", function () {
    cabinetSetMenuOpen(false);
    cabinetSetSaveManagerOpen(false);
    cabinetSetControlsPanel(false);
    cabinetSetPanelOpen("cabinet-warp-panel", false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      cabinetSetMenuOpen(false);
      cabinetSetSaveManagerOpen(false);
      cabinetSetControlsPanel(false);
      cabinetSetPanelOpen("cabinet-warp-panel", false);
    }
  });
}
function cabinetSetupWarp() {
  var openBtn = document.querySelector("#cabinet-warp-open");
  var closeBtn = document.querySelector("#cabinet-warp-close");
  var panel = document.querySelector("#cabinet-warp-panel");
  var qrContainer = document.querySelector("#cabinet-warp-qr");
  var manualSection = document.querySelector("#cabinet-warp-manual");
  var urlInput = document.querySelector("#cabinet-warp-url");
  
  if (!openBtn || !panel) return;

  openBtn.addEventListener("click", async function () {
    cabinetSetMenuOpen(false);
    cabinetSetPanelOpen("cabinet-warp-panel", true);
    
    if (manualSection) manualSection.style.display = "none";
    if (qrContainer) {
      qrContainer.style.display = "flex";
      qrContainer.innerHTML = '<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#000;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:20px;">Synchronizing Warp Point...</div>';
    }

    try {
      // 1. Trigger quick save to slot 0 (Universally supported Auto-save slot)
      var slot = 0;
      cabinetSetEmulatorSaveSlot(slot);
      var emulator = window.EJS_emulator;
      var saved = false;
      if (emulator && emulator.gameManager && typeof emulator.gameManager.saveState === "function") {
        try { emulator.gameManager.saveState(slot); saved = true; } catch (_error) { saved = false; }
      }
      if (!saved) { cabinetSendInput(24, "1"); }

      // 2. Wait for VFS to flush and upload (Retrying up to 3 times)
      var attempt = 0;
      var maxAttempts = 3;
      var checkAndSync = async function() {
        try {
          attempt++;
          // Ensure VFS is synced if the core supports it
          if (emulator && emulator.gameManager && emulator.gameManager.FS && typeof emulator.gameManager.FS.syncfs === "function") {
            await new Promise(function(resolve) { emulator.gameManager.FS.syncfs(false, resolve); });
          }

          await cabinetCaptureThumb(slot);
          await cabinetBackupSlot(slot);
          await cabinetRecordSaveSlot(slot);

          // Success -> Generate Warp URL
          var currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("loadSlot", String(slot));
          currentUrl.searchParams.set("warp", "true");
          currentUrl.searchParams.set("t", String(Date.now())); // Cache buster
          var warpUrl = currentUrl.toString();

          // 3. Show QR Code
          if (qrContainer) {
            var qrSize = 200;
            var qrApi = "https://api.qrserver.com/v1/create-qr-code/?size=" + qrSize + "x" + qrSize + "&data=" + encodeURIComponent(warpUrl);
            var img = new Image();
            img.width = qrSize; img.height = qrSize;
            img.style.display = "block"; img.style.borderRadius = "4px";
            img.alt = "Warp QR Code";
            img.onload = function() { qrContainer.innerHTML = ""; qrContainer.appendChild(img); cabinetToast("Warp Point Ready \\u2728"); };
            img.onerror = function() {
              qrContainer.style.display = "none";
              if (manualSection && urlInput) {
                manualSection.style.display = "flex";
                urlInput.value = warpUrl;
                cabinetToast("QR Blocked (CSP), showing manual link");
              }
            };
            img.src = qrApi;
          }
        } catch (e) {
          if (attempt < maxAttempts) {
            console.log("[Warp] Sync attempt " + attempt + " failed, retrying...");
            setTimeout(checkAndSync, 1000);
          } else {
            console.error("[Warp] Save/Upload failed after " + maxAttempts + " attempts:", e);
            cabinetToast("Warp failed: could not sync save");
            if (qrContainer) qrContainer.innerHTML = '<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#ef4444;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:20px;">Warp Failed<br><br>Check BIOS or Core compatibility</div>';
          }
        }
      };

      setTimeout(checkAndSync, 1500); // Initial delay
    } catch (e) {
      console.error("[Warp] Fatal Error:", e);
      cabinetToast("Warp failed");
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", function() { cabinetSetPanelOpen("cabinet-warp-panel", false); });
}
document.addEventListener("click", function (event) {
  var target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id === "cabinet-resume") {
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-exit") {
    var returnTo = window.CABINET_RETURN_TO || "";
    var duration = cabinetSessionStart ? Math.round((Date.now() - cabinetSessionStart) / 1000) : 0;
    var doExit = function () {
      if (returnTo) { window.location.href = returnTo; return; }
      if (window.opener) { window.close(); return; }
      window.location.href = "/";
    };
    var doPostAndExit = function () {
      fetch("./play-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "ended", durationSeconds: duration }),
      }).catch(function () {}).finally(doExit);
    };
    if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      cabinetToast("Auto-saving…");
      try {
        window.EJS_emulator.saveState(0);
        setTimeout(doPostAndExit, 800);
      } catch (e) {
        doPostAndExit();
      }
    } else {
      doPostAndExit();
    }
  }
  if (target.id === "cabinet-save") {
    cabinetQuickSaveSlot(cabinetCurrentSaveSlot);
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-load") {
    cabinetQuickLoadSlot(cabinetCurrentSaveSlot);
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-save-manager-open") {
    cabinetSetSaveManagerOpen(true);
  }
  if (target.id === "cabinet-save-manager-close") {
    cabinetSetSaveManagerOpen(false);
  }
  if (target.id === "cabinet-sync-from-server") {
    cabinetAutoSyncFromServer();
  }
  if (target.id === "cabinet-sleep-open") {
    cabinetSetMenuOpen(false);
    cabinetSetPanelOpen("cabinet-sleep-panel", true);
  }
  if (target.id === "cabinet-sleep-close") {
    cabinetSetPanelOpen("cabinet-sleep-panel", false);
  }
  if (target.id === "cabinet-sleep-cancel") {
    cabinetCancelSleepTimer();
  }
  if (target.id === "cabinet-sleep-start") {
    cabinetStartSleepTimer();
  }
  var sleepMins = target.getAttribute("data-sleep-mins");
  if (sleepMins) {
    cabinetSelectSleepDuration(Number(sleepMins));
  }
  var saveAction = target.getAttribute("data-save-action");
  if (saveAction) {
    var slot = Number(target.getAttribute("data-slot"));
    if (!Number.isNaN(slot)) {
      if (saveAction === "save") { cabinetQuickSaveSlot(slot); }
      if (saveAction === "load") { cabinetQuickLoadSlot(slot); cabinetSetSaveManagerOpen(false); }
      if (saveAction === "delete") { cabinetDeleteLocalSaveSlot(slot); }
      if (saveAction === "backup") { cabinetBackupSlot(slot); }
      if (saveAction === "restore") { cabinetRestoreSlot(slot); }
    }
  }
  if (target.id === "cabinet-pad-toggle") { cabinetSetMenuOpen(false); }
  if (target.id === "cabinet-controls") { cabinetSetMenuOpen(false); cabinetSetControlsPanel(true); }
  if (target.id === "cabinet-controls-close") { cabinetSetControlsPanel(false); }
  if (target.id === "cabinet-ff-toggle") {
    var ffOn = target.getAttribute("aria-pressed") === "true";
    cabinetSetMenuOpen(false);
    cabinetSetFastForward(!ffOn);
  }
  if (target.id === "cabinet-cheats") { cabinetOpenCheats(); }
  if (target.id === "cabinet-screenshot") { cabinetTakeScreenshot(); }
  if (target.id === "cabinet-crt-toggle") {
    var _game = document.querySelector("#game");
    var _crtOn = _game && _game.classList.contains("cabinet-filter-crt");
    cabinetApplyFilter(_crtOn ? "none" : "crt");
    var _crtBtn = document.querySelector("#cabinet-crt-toggle");
    if (_crtBtn) { _crtBtn.setAttribute("aria-pressed", _on ? "false" : "true"); _crtBtn.textContent = _on ? "CRT Filter" : "CRT On"; }
  }
  if (target.id === "cabinet-display-open") { cabinetSetDisplayPanel(true); }
  if (target.id === "cabinet-display-close") { cabinetSetDisplayPanel(false); }
  if (target.id === "cabinet-remap-open") { cabinetSetRemapPanel(true); }
  if (target.id === "cabinet-remap-close") { cabinetSetRemapPanel(false); }
  if (target.id === "cabinet-remap-reset") {
    try { localStorage.removeItem(cabinetRemapStorageKey()); } catch (_e) {}
    cabinetRemapTarget = null;
    cabinetRenderRemapGrid();
    cabinetToast("Controls reset to defaults");
  }
  if (target.hasAttribute && target.hasAttribute("data-remap-index")) {
    var remapIndex = parseInt(target.getAttribute("data-remap-index"), 10);
    cabinetRemapTarget = { index: remapIndex };
    cabinetRenderRemapGrid();
  }
  if (target.dataset && target.dataset.aspect) { cabinetApplyAspect(target.dataset.aspect); }
  if (target.dataset && target.dataset.filter) { cabinetApplyFilter(target.dataset.filter); }
});
function cabinetSetControlsPanel(open) {
  var panel = document.querySelector("#cabinet-controls-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
  if (open) cabinetRenderControls();
}
function cabinetRenderControls() {
  var body = document.querySelector("#cabinet-controls-body");
  var subtitle = document.querySelector("#cabinet-controls-subtitle");
  if (!body) return;
  var isPsx = window.CABINET_CORE === "psx" || window.CABINET_CORE === "pcsx2";
  var isGba = window.CABINET_CORE === "gba";
  var isGb  = window.CABINET_CORE === "gb" || window.CABINET_CORE === "gbc";
  var isN64 = window.CABINET_CORE === "n64";
  var isNds = window.CABINET_CORE === "nds";
  var isPsp = window.CABINET_CORE === "psp";
  if (subtitle) {
    var coreLabel = isPsx ? "PlayStation" : isGba ? "Game Boy Advance" : isGb ? "Game Boy / GBC" : isN64 ? "Nintendo 64" : isNds ? "Nintendo DS" : isPsp ? "PSP" : "SNES / NES / Genesis";
    subtitle.textContent = coreLabel + " · keyboard & gamepad";
  }
  var ROW_STYLE = 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(248,250,252,0.06);';
  var LABEL_STYLE = 'color:rgba(248,250,252,0.5);font:700 9px ui-monospace,monospace;letter-spacing:0.14em;text-transform:uppercase;';
  var KEY_STYLE = 'color:#f8fafc;font:700 11px ui-monospace,monospace;background:rgba(248,250,252,0.08);border:1px solid rgba(248,250,252,0.18);border-radius:6px;padding:3px 8px;';
  function row(label, key) {
    return '<div style="' + ROW_STYLE + '"><span style="' + LABEL_STYLE + '">' + label + '</span><span style="' + KEY_STYLE + '">' + key + '</span></div>';
  }
  var rows = [];
  var SECTION_STYLE = 'color:rgba(248,250,252,0.35);font:800 8px ui-monospace,monospace;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;';
  function section(label) {
    return '<div style="' + SECTION_STYLE + '">' + label + '</div>';
  }
  if (isPsx) {
    rows.push(section("Face Buttons")); rows.push(row("Cross", "Z")); rows.push(row("Circle", "X")); rows.push(row("Square", "A")); rows.push(row("Triangle", "S"));
    rows.push(section("Shoulders")); rows.push(row("L1 / R1", "Q / W")); rows.push(row("L2 / R2", "E / R")); rows.push(row("L3 / R3", "Tab / C"));
    rows.push(section("System")); rows.push(row("Start / Select", "Enter / Shift")); rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isGba) {
    rows.push(section("Buttons")); rows.push(row("A / B", "Z / X")); rows.push(row("L / R", "Q / W"));
    rows.push(section("System")); rows.push(row("Start / Select", "Enter / Shift")); rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isGb) {
    rows.push(section("Buttons")); rows.push(row("A / B", "Z / X"));
    rows.push(section("System")); rows.push(row("Start / Select", "Enter / Shift")); rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isN64) {
    rows.push(section("Buttons")); rows.push(row("A / B", "Z / X")); rows.push(row("C-Up/Down/Left/Right", "I / K / J / L")); rows.push(row("L / R / Z", "Q / W / E"));
    rows.push(section("System")); rows.push(row("Start", "Enter")); rows.push(row("Analog Stick", "Arrow Keys"));
  } else if (isNds) {
    rows.push(section("Buttons")); rows.push(row("A / B / X / Y", "Z / X / A / S")); rows.push(row("L / R", "Q / W"));
    rows.push(section("System")); rows.push(row("Start / Select", "Enter / Shift")); rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isPsp) {
    rows.push(section("Buttons")); rows.push(row("Cross / Circle", "Z / X")); rows.push(row("Square / Triangle", "A / S")); rows.push(row("L / R", "Q / W"));
    rows.push(section("System")); rows.push(row("Start / Select", "Enter / Shift")); rows.push(row("Analog / D-Pad", "Arrow Keys"));
  } else {
    rows.push(section("Buttons")); rows.push(row("A / B", "Z / X")); rows.push(row("X / Y", "A / S")); rows.push(row("L / R", "Q / W"));
    rows.push(section("System")); rows.push(row("Start / Select", "Enter / Shift")); rows.push(row("D-Pad", "Arrow Keys"));
  }
  rows.push(section("Emulator"));
  rows.push(row("Quick Save / Load", "1 / 2"));
  rows.push(row("Rewind", "Backspace"));
  body.innerHTML = rows.join("");
}
function cabinetStartRewind() {
  var btn = document.querySelector("#cabinet-rewind-toggle");
  if (btn) btn.setAttribute("aria-pressed", "true");
  var emulator = window.EJS_emulator;
  var gm = emulator && emulator.gameManager;
  var M = gm && gm.Module;
  if (M) {
    if (typeof M.setRewind === "function") { try { M.setRewind(1); } catch (_e) {} }
    else if (typeof M._RA_cmd_rewind_flush === "function") { try { M._RA_cmd_rewind_flush(); } catch (_e) {} }
  }
}
function cabinetStopRewind() {
  var btn = document.querySelector("#cabinet-rewind-toggle");
  if (btn) btn.setAttribute("aria-pressed", "false");
  var emulator = window.EJS_emulator;
  var gm = emulator && emulator.gameManager;
  var M = gm && gm.Module;
  if (M && typeof M.setRewind === "function") { try { M.setRewind(0); } catch (_e) {} }
}
function cabinetSetFastForward(enabled) {
  var btn = document.querySelector("#cabinet-ff-toggle");
  if (btn) btn.setAttribute("aria-pressed", String(enabled));
  var emulator = window.EJS_emulator;
  var gm = emulator && emulator.gameManager;
  var M = gm && gm.Module;
  var ok = false;
  if (M) {
    if (typeof M.setFastForward === "function") { try { M.setFastForward(enabled ? 1 : 0); ok = true; } catch (_e) {} }
    if (!ok && typeof M._RA_cmd_toggle_fastforward === "function") { try { M._RA_cmd_toggle_fastforward(); ok = true; } catch (_e) {} }
  }
  if (!ok && emulator && typeof emulator.setFastForward === "function") { try { emulator.setFastForward(enabled); ok = true; } catch (_e) {} }
  cabinetToast(enabled ? "Fast-forward ON (3×)" : "Fast-forward OFF");
}
function cabinetOpenCheats() { cabinetSetPanelOpen("cabinet-cheats-panel", true); cabinetLoadCheats(); }
function cabinetLoadCheats() {
  var list = document.querySelector("#cabinet-cheats-list");
  var subtitle = document.querySelector("#cabinet-cheats-subtitle");
  if (!list) return;
  list.innerHTML = '<div style="color:rgba(248,250,252,0.4);font:600 10px ui-monospace,monospace;text-align:center;padding:16px 0;">Loading…</div>';
  fetch("../../roms/" + cabinetRomId + "/cheats?profileId=" + encodeURIComponent(window.CABINET_PROFILE_ID || "1"))
    .then(function(r) { return r.json(); })
    .then(function(cheats) {
      cabinetRenderCheats(cheats);
      if (subtitle) subtitle.textContent = cheats.length + " cheat" + (cheats.length !== 1 ? "s" : "") + " saved for this game.";
    })
    .catch(function() {
      list.innerHTML = '<div style="color:rgba(239,68,68,0.8);font:600 10px ui-monospace,monospace;text-align:center;padding:16px 0;">Failed to load cheats.</div>';
    });
}
function cabinetRenderCheats(cheats) {
  var list = document.querySelector("#cabinet-cheats-list");
  if (!list) return;
  if (!cheats || cheats.length === 0) { list.innerHTML = '<div style="color:rgba(248,250,252,0.35);font:600 10px ui-monospace,monospace;text-align:center;padding:24px 0;">No cheats yet. Add one above.</div>'; return; }
  list.innerHTML = "";
  cheats.forEach(function(cheat) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;background:rgba(248,250,252,0.05);border:1px solid rgba(248,250,252,0.1);border-radius:8px;padding:8px 10px;";
    var toggle = document.createElement("button");
    toggle.type = "button"; toggle.setAttribute("aria-pressed", cheat.enabled ? "true" : "false");
    toggle.style.cssText = "flex-shrink:0;width:28px;height:16px;border-radius:8px;border:none;cursor:pointer;transition:background 0.2s;background:" + (cheat.enabled ? "hsl(322 92% 60%)" : "rgba(255,255,255,0.15)") + ";position:relative;";
    var dot = document.createElement("span");
    dot.style.cssText = "position:absolute;top:2px;width:12px;height:12px;background:#fff;border-radius:50%;transition:left 0.2s;left:" + (cheat.enabled ? "14px" : "2px") + ";";
    toggle.appendChild(dot);
    toggle.addEventListener("click", function() {
      var wasEnabled = toggle.getAttribute("aria-pressed") === "true";
      fetch("../../cheats/" + cheat.id, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ enabled: !wasEnabled }) })
        .then(function() { cabinetLoadCheats(); })
        .catch(function() { cabinetToast("Failed to update cheat"); });
    });
    var info = document.createElement("div"); info.style.cssText = "flex:1;min-width:0;";
    var desc = document.createElement("div"); desc.style.cssText = "color:#f8fafc;font:600 11px ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"; desc.textContent = cheat.description;
    var code = document.createElement("div"); code.style.cssText = "color:rgba(248,250,252,0.45);font:500 9px ui-monospace,monospace;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"; code.textContent = cheat.code;
    info.appendChild(desc); info.appendChild(code);
    var del = document.createElement("button"); del.type = "button"; del.style.cssText = "flex-shrink:0;appearance:none;border:1px solid rgba(239,68,68,0.3);border-radius:6px;background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.8);cursor:pointer;font:700 10px ui-monospace,monospace;padding:3px 7px;"; del.textContent = "Del";
    del.addEventListener("click", function() {
      fetch("../../cheats/" + cheat.id, { method: "DELETE" }).then(function() { cabinetLoadCheats(); cabinetToast("Cheat deleted"); }).catch(function() { cabinetToast("Failed to delete cheat"); });
    });
    row.appendChild(toggle); row.appendChild(info); row.appendChild(del); list.appendChild(row);
  });
}
(function cabinetInitCheatsPanel() {
  document.addEventListener("DOMContentLoaded", function() {
    var closeBtn = document.querySelector("#cabinet-cheats-close");
    if (closeBtn) closeBtn.addEventListener("click", function() { cabinetSetPanelOpen("cabinet-cheats-panel", false); });
    var addBtn = document.querySelector("#cabinet-cheat-add");
    if (addBtn) addBtn.addEventListener("click", function() {
      var descInput = document.querySelector("#cabinet-cheat-desc");
      var codeInput = document.querySelector("#cabinet-cheat-code");
      var desc = (descInput || {}).value || "";
      var code = (codeInput || {}).value || "";
      if (!desc.trim() || !code.trim()) { cabinetToast("Enter a description and code"); return; }
      addBtn.disabled = true; addBtn.textContent = "Adding…";
      fetch("../../roms/" + cabinetRomId + "/cheats", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ description: desc.trim(), code: code.trim(), profileId: Number(window.CABINET_PROFILE_ID || 1) })
      }).then(function(r) {
        if (r.status === 409) { cabinetToast("Cheat already exists"); return; }
        if (descInput) descInput.value = ""; if (codeInput) codeInput.value = "";
        cabinetLoadCheats(); cabinetToast("Cheat added");
      }).catch(function() { cabinetToast("Failed to add cheat"); }).finally(function() { addBtn.disabled = false; addBtn.textContent = "+ Add"; });
    });
  });
})();
function cabinetTakeScreenshot() {
  cabinetSetMenuOpen(false);
  var canvas = document.querySelector("#game canvas");
  if (!canvas) { cabinetToast("No game canvas found"); return; }
  try {
    var dataUrl = canvas.toDataURL("image/png");
    var a = document.createElement("a"); a.href = dataUrl;
    a.download = (window.EJS_gameName || "screenshot") + "-" + Date.now() + ".png";
    a.click(); cabinetToast("Screenshot saved!");
  } catch (_e) { cabinetToast("Screenshot failed (cross-origin canvas)"); }
}
function cabinetSetDisplayPanel(open) {
  var panel = document.querySelector("#cabinet-display-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) cabinetSetMenuOpen(false);
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open); backdrop.classList.toggle("is-open", open);
}
function cabinetApplyAspect(aspect) {
  var game = document.querySelector("#game");
  if (!game) return;
  game.classList.remove("cabinet-aspect-4-3", "cabinet-aspect-16-9", "cabinet-aspect-pixel", "cabinet-aspect-stretch");
  var cls = { "4:3": "cabinet-aspect-4-3", "16:9": "cabinet-aspect-16-9", "pixel": "cabinet-aspect-pixel", "stretch": "cabinet-aspect-stretch" }[aspect];
  if (cls) game.classList.add(cls);
  document.querySelectorAll("[data-aspect]").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-aspect") === aspect ? "true" : "false"); });
  try { localStorage.setItem("cabinet_aspect", aspect); } catch (_e) {}
}
function cabinetApplyFilter(filter) {
  var game = document.querySelector("#game");
  if (!game) return;
  game.classList.remove("cabinet-filter-crt", "cabinet-filter-smooth", "cabinet-filter-scanlines", "cabinet-filter-lcd", "cabinet-filter-phosphor");
  if (filter !== "none") game.classList.add("cabinet-filter-" + filter);
  document.querySelectorAll("[data-filter]").forEach(function (b) { b.setAttribute("aria-checked", b.getAttribute("data-filter") === filter ? "true" : "false"); });
  try { localStorage.setItem("cabinet_filter", filter); } catch (_e) {}
}
function cabinetInitDisplay() {
  try {
    var aspect = localStorage.getItem("cabinet_aspect") || "4:3";
    var filter = localStorage.getItem("cabinet_filter") || "none";
    window.setTimeout(function () {
      cabinetApplyAspect(aspect); cabinetApplyFilter(filter);
      var _crtBtn = document.querySelector("#cabinet-crt-toggle");
      if (_crtBtn) { var _on = filter === "crt"; _crtBtn.setAttribute("aria-pressed", _on ? "true" : "false"); _crtBtn.textContent = _on ? "CRT On" : "CRT Filter"; }
    }, 500);
  } catch (_e) {}
}
var cabinetRemapTarget = null;
var CABINET_BUTTON_LABELS = [
  "Cross / A", "Square / B", "Select", "Start", "D-Pad Up", "D-Pad Down", "D-Pad Left", "D-Pad Right",
  "Circle / A2", "Triangle / B2", "L1", "R1", "L2", "R2", "L3", "R3",
];
function cabinetRemapStorageKey() { return "cabinet_remap_" + (window.EJS_gameID || "game"); }
function cabinetLoadRemap() { try { var raw = localStorage.getItem(cabinetRemapStorageKey()); return raw ? JSON.parse(raw) : null; } catch (_e) { return null; } }
function cabinetSaveRemap(mapping) { try { localStorage.setItem(cabinetRemapStorageKey(), JSON.stringify(mapping)); } catch (_e) {} }
function cabinetProfilesKey() { return "cabinet_remap_profiles_" + (window.EJS_gameID || "game"); }
function cabinetLoadProfiles() { try { var raw = localStorage.getItem(cabinetProfilesKey()); return raw ? JSON.parse(raw) : {}; } catch (_e) { return {}; } }
function cabinetSaveProfiles(profiles) { try { localStorage.setItem(cabinetProfilesKey(), JSON.stringify(profiles)); } catch (_e) {} }
function cabinetRefreshProfileSelect() {
  var sel = document.querySelector("#cabinet-remap-profile-select");
  if (!sel) return;
  var profiles = cabinetLoadProfiles();
  var names = Object.keys(profiles);
  sel.innerHTML = names.length === 0 ? '<option value="">— no saved profiles —</option>' : names.map(function (n) { return '<option value="' + cabinetEscapeText(n) + '">' + cabinetEscapeText(n) + '</option>'; }).join("");
}
function cabinetSetupRemapProfiles() {
  var loadBtn = document.querySelector("#cabinet-remap-profile-load");
  var saveBtn = document.querySelector("#cabinet-remap-profile-save");
  var delBtn = document.querySelector("#cabinet-remap-profile-delete");
  var sel = document.querySelector("#cabinet-remap-profile-select");
  if (!loadBtn || !saveBtn || !delBtn || !sel) return;
  cabinetRefreshProfileSelect();
  loadBtn.addEventListener("click", function () {
    var name = sel.value; if (!name) return;
    var profiles = cabinetLoadProfiles(); if (!profiles[name]) return;
    cabinetSaveRemap(profiles[name]); cabinetApplyRemap(profiles[name]);
    cabinetRenderRemapGrid(); cabinetToast("Loaded profile: " + name);
  });
  saveBtn.addEventListener("click", function () {
    var name = window.prompt("Profile name:", "");
    if (!name || !name.trim()) return; name = name.trim().slice(0, 32);
    var profiles = cabinetLoadProfiles(); profiles[name] = cabinetLoadRemap() || {};
    cabinetSaveProfiles(profiles); cabinetRefreshProfileSelect(); sel.value = name;
    cabinetToast("Saved profile: " + name);
  });
  delBtn.addEventListener("click", function () {
    var name = sel.value; if (!name) return;
    var profiles = cabinetLoadProfiles(); delete profiles[name];
    cabinetSaveProfiles(profiles); cabinetRefreshProfileSelect();
    cabinetToast("Deleted profile: " + name);
  });
}
function cabinetApplyRemap(mapping) {
  if (!mapping) return;
  var emulator = window.EJS_emulator; if (!emulator) return;
  Object.keys(mapping).forEach(function (indexStr) {
    var index = parseInt(indexStr, 10); var key = mapping[indexStr];
    if (emulator.settings) emulator.settings["p1_" + index] = key;
    if (typeof emulator.changeSettingOption === "function") { try { emulator.changeSettingOption("p1_" + index, key); } catch (_e) {} }
    if (window.EJS_defaultControls && window.EJS_defaultControls[0]) {
      if (!window.EJS_defaultControls[0][index]) window.EJS_defaultControls[0][index] = {};
      window.EJS_defaultControls[0][index].value = key;
    }
  });
}
function cabinetSetRemapPanel(open) {
  var panel = document.querySelector("#cabinet-remap-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) { cabinetSetMenuOpen(false); cabinetRenderRemapGrid(); cabinetRefreshProfileSelect(); }
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open); backdrop.classList.toggle("is-open", open);
  if (!open) cabinetRemapTarget = null;
}
function cabinetRenderRemapGrid() {
  var grid = document.querySelector("#cabinet-remap-grid");
  if (!grid) return;
  var mapping = cabinetLoadRemap() || {};
  var defaultControls = (window.EJS_defaultControls && window.EJS_defaultControls[0]) || {};
  var labels = window.CABINET_CORE === "psx" || window.CABINET_CORE === "pcsx2"
    ? ["Cross", "Square", "Select", "Start", "Up", "Down", "Left", "Right", "Circle", "Triangle", "L1", "R1", "L2", "R2", "L3", "R3"]
    : CABINET_BUTTON_LABELS;
  grid.innerHTML = "";
  labels.forEach(function (label, index) {
    var currentKey = mapping[index] || (defaultControls[index] && defaultControls[index].value) || "—";
    var row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;";
    var nameEl = document.createElement("span"); nameEl.style.cssText = "color:rgba(248,250,252,0.7);font:700 9px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;"; nameEl.textContent = label;
    var keyBtn = document.createElement("button"); keyBtn.type = "button"; keyBtn.setAttribute("data-remap-index", String(index));
    keyBtn.style.cssText = "appearance:none;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.08);color:#f8fafc;cursor:pointer;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;min-width:72px;padding:8px 10px;text-transform:uppercase;";
    keyBtn.textContent = currentKey;
    if (cabinetRemapTarget && cabinetRemapTarget.index === index) {
      keyBtn.style.borderColor = "rgba(236,72,153,0.9)"; keyBtn.style.background = "rgba(236,72,153,0.25)"; keyBtn.textContent = "Press key…";
    }
    row.appendChild(nameEl); row.appendChild(keyBtn); grid.appendChild(row);
  });
}
document.addEventListener("keydown", function (e) {
  if (!cabinetRemapTarget) return;
  e.preventDefault(); e.stopPropagation();
  var key = e.key.toLowerCase();
  if (key === "escape") { cabinetRemapTarget = null; cabinetRenderRemapGrid(); return; }
  var mapping = cabinetLoadRemap() || {}; mapping[cabinetRemapTarget.index] = key;
  cabinetSaveRemap(mapping); cabinetApplyRemap(mapping); cabinetRemapTarget = null; cabinetRenderRemapGrid();
  cabinetToast("Mapped to " + key);
}, true);
window.addEventListener("EJS_emulator_ready", function () {
  cabinetApplyRemap(cabinetLoadRemap());
  (function () {
    var opts = window.CABINET_DISPLAY_OPTS || {}; var canvas = document.querySelector("#game canvas");
    if (!canvas) return; if (opts.integerScale) canvas.style.imageRendering = "pixelated";
    if (opts.aspectRatio) { canvas.style.aspectRatio = opts.aspectRatio; canvas.style.width = "auto"; canvas.style.height = "100%"; }
  })();
  if (window.CABINET_RUMBLE === false) {
    var _origGetGamepads = navigator.getGamepads.bind(navigator);
    navigator.getGamepads = function () {
      var pads = _origGetGamepads();
      return Array.from(pads).map(function (p) { if (!p) return p; Object.defineProperty(p, "vibrationActuator", { get: function () { return null; } }); return p; });
    };
  }
  setTimeout(cabinetAutoSyncFromServer, 1500);
  var rewindBtn = document.querySelector("#cabinet-rewind-toggle");
  if (rewindBtn) {
    rewindBtn.addEventListener("mousedown", function (e) { e.preventDefault(); cabinetStartRewind(); });
    rewindBtn.addEventListener("touchstart", function (e) { e.preventDefault(); cabinetStartRewind(); }, { passive: false });
    rewindBtn.addEventListener("mouseup", cabinetStopRewind); rewindBtn.addEventListener("mouseleave", cabinetStopRewind);
    rewindBtn.addEventListener("touchend", cabinetStopRewind); rewindBtn.addEventListener("touchcancel", cabinetStopRewind);
  }
});
var cabinetServerBackups = [];
async function cabinetFetchServerBackups() {
  try { var r = await fetch("./save-backups"); if (!r.ok) return; var d = await r.json(); cabinetServerBackups = d.slots || []; } catch (_e) { cabinetServerBackups = []; }
}
async function cabinetBackupSlot(slot) {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) { cabinetToast("Game must be running to back up a save"); return; }
  var FS = emulator.gameManager.FS; var gameId = window.EJS_gameID || "";
  var candidates = ["/" + gameId + "-" + slot + ".state", "/" + gameId + "-" + slot + "-quick.state", "/" + slot + ".state", slot + "-quick.state"];
  try {
    var rootFiles = FS.readdir("/");
    for (var i = 0; i < rootFiles.length; i++) {
      var f = rootFiles[i];
      if ((f.endsWith("-" + slot + ".state") || f.endsWith("-" + slot + "-quick.state")) && candidates.indexOf("/" + f) === -1) candidates.push("/" + f);
    }
  } catch (_scanErr) {}
  var data;
  for (var ci = 0; ci < candidates.length; ci++) { try { data = FS.readFile(candidates[ci], { encoding: "binary" }); if (data && data.length > 0) break; } catch (_e) {} }
  if (!data || data.length === 0) { cabinetToast("No save data in slot " + slot + " to back up"); return; }
  try {
    var r = await fetch("./save-backup/" + slot, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: data instanceof Uint8Array ? data : new Uint8Array(data), });
    if (!r.ok) throw new Error((await r.json()).message || "Failed");
    if (!cabinetServerBackups.includes(slot)) cabinetServerBackups.push(slot);
    cabinetServerBackups.sort(function (a, b) { return a - b; });
    cabinetToast("Slot " + slot + " backed up to server \u2601"); cabinetRenderSaveSlots();
  } catch (err) { cabinetToast("Backup failed: " + err.message); }
}
async function cabinetRestoreSlot(slot) {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) { cabinetToast("Game must be running to restore a save"); return; }
  try {
    var r = await fetch("./save-backup/" + slot); if (!r.ok) throw new Error("No backup for slot " + slot);
    var buf = await r.arrayBuffer(); var FS = emulator.gameManager.FS; var gameId = window.EJS_gameID || "";
    var statePath = "/" + gameId + "-" + slot + ".state"; FS.writeFile(statePath, new Uint8Array(buf));
    if (FS.syncfs) FS.syncfs(false, function () {});
    await cabinetRecordSaveSlot(slot); cabinetToast("Slot " + slot + " restored from server \u2601");
  } catch (err) { cabinetToast("Restore failed: " + err.message); }
}
async function cabinetAutoSyncFromServer() {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) return;
  var FS = emulator.gameManager.FS; var gameId = window.EJS_gameID || "";
  await cabinetFetchServerBackups(); if (!cabinetServerBackups || cabinetServerBackups.length === 0) return;
  var localSlots = new Set();
  try {
    var rootFiles = FS.readdir("/");
    for (var i = 0; i < rootFiles.length; i++) {
      var f = rootFiles[i]; var m = f.match(/[-]?(\d+)(?:-quick)?\.state$/); if (m) localSlots.add(Number(m[1]));
    }
  } catch (_e) {}
  var restored = 0;
  for (var si = 0; si < cabinetServerBackups.length; si++) {
    var slot = cabinetServerBackups[si]; if (localSlots.has(slot)) continue;
    try {
      var r = await fetch("./save-backup/" + slot); if (!r.ok) continue;
      var buf = await r.arrayBuffer(); if (!buf || buf.byteLength === 0) continue;
      var statePath = "/" + gameId + "-" + slot + ".state"; FS.writeFile(statePath, new Uint8Array(buf)); restored++;
    } catch (_e) {}
  }
  if (restored > 0) {
    if (FS.syncfs) FS.syncfs(false, function () {});
    await cabinetFetchSaveSlots(); cabinetRenderSaveSlots();
    cabinetToast("\u2601 Synced " + restored + " save state" + (restored > 1 ? "s" : "") + " from server");
  }
}
function cabinetSetupGamepadPanel() {
  var openBtn = document.querySelector("#cabinet-gamepad-test-open");
  var closeBtn = document.querySelector("#cabinet-gamepad-panel-close");
  var panel = document.querySelector("#cabinet-gamepad-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!openBtn || !panel || !backdrop) return;
  var gpRaf = null;
  function renderGamepads() {
    var statusEl = document.querySelector("#cabinet-gp-status");
    var listEl = document.querySelector("#cabinet-gp-list");
    if (!statusEl || !listEl) return;
    var gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    if (gamepads.length === 0) { statusEl.textContent = "No controller detected. Press any button on your gamepad."; listEl.innerHTML = ""; }
    else {
      statusEl.textContent = gamepads.length + " controller" + (gamepads.length > 1 ? "s" : "") + " connected.";
      listEl.innerHTML = gamepads.map(function (gp) {
        var btnHtml = (gp.buttons || []).map(function (btn, i) {
          var pressed = btn.pressed || btn.value > 0.1;
          return '<span style="display:inline-block;min-width:28px;padding:3px 5px;margin:2px;border-radius:6px;font:700 9px ui-monospace,monospace;text-align:center;background:' + (pressed ? "#22c55e" : "rgba(248,250,252,0.08)") + ';color:' + (pressed ? "#fff" : "rgba(248,250,252,0.4)") + ';" title="Button ' + i + '">' + i + '</span>';
        }).join("");
        var axisHtml = (gp.axes || []).map(function (v, i) { return '<span style="display:inline-block;margin:2px 4px;font:600 9px ui-monospace,monospace;color:rgba(248,250,252,0.6);">A' + i + ':<b style="color:#f8fafc;">' + v.toFixed(2) + '</b></span>'; }).join("");
        return '<div style="background:rgba(248,250,252,0.04);border:1px solid rgba(248,250,252,0.1);border-radius:12px;padding:10px 14px;margin-bottom:6px;">' + '<div style="font:700 11px ui-monospace,monospace;color:#f8fafc;margin-bottom:6px;">' + (gp.id || "Unknown Controller") + '</div>' + '<div style="margin-bottom:4px;">' + (btnHtml || "<em style='font-style:italic;color:rgba(248,250,252,0.3);font-size:10px;'>No buttons</em>") + '</div>' + '<div style="max-width:280px;color:rgba(248,250,252,0.6);font:600 11px ui-monospace,monospace;letter-spacing:0.05em;line-height:1.5;">' + 'Your current game state will be saved and synced automatically to a dedicated handoff slot.' + '</div>' + '</div>';
      }).join("");
    }
    if (panel.getAttribute("aria-hidden") !== "true") gpRaf = requestAnimationFrame(renderGamepads);
  }
  openBtn.addEventListener("click", function () { cabinetSetMenuOpen(false); panel.setAttribute("aria-hidden", "false"); panel.classList.add("is-open"); backdrop.classList.add("is-open"); renderGamepads(); });
  function closePanel() { panel.setAttribute("aria-hidden", "true"); panel.classList.remove("is-open"); backdrop.classList.remove("is-open"); if (gpRaf) { cancelAnimationFrame(gpRaf); gpRaf = null; } }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  backdrop.addEventListener("click", function () { if (panel.classList.contains("is-open")) closePanel(); });
  window.addEventListener("gamepadconnected", function (e) { cabinetToast("Gamepad connected: " + e.gamepad.id.slice(0, 40)); if (panel.classList.contains("is-open")) renderGamepads(); });
  window.addEventListener("gamepaddisconnected", function () { cabinetToast("Gamepad disconnected"); if (panel.classList.contains("is-open")) renderGamepads(); });
}
function cabinetNetplayConnect(onOpen) {
  if (cabinetNetplayWs && cabinetNetplayWs.readyState === WebSocket.OPEN) { onOpen(cabinetNetplayWs); return; }
  var proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  var _np = window.location.pathname; var _ni = _np.indexOf("/api/roms/"); var base = _ni >= 0 ? _np.slice(0, _ni) : "";
  var url = proto + "//" + window.location.host + base + "/api/netplay";
  var ws = new WebSocket(url);
  ws.addEventListener("open", function () { cabinetNetplayWs = ws; onOpen(ws); });
  ws.addEventListener("error", function () { cabinetToast("Netplay: connection failed"); });
  ws.addEventListener("close", function () { cabinetNetplayWs = null; cabinetNetplayRole = null; });
  return ws;
}
function cabinetSetupNetplay() {
  var openBtn = document.querySelector("#cabinet-netplay-open");
  var closeBtn = document.querySelector("#cabinet-netplay-close");
  var panel = document.querySelector("#cabinet-netplay-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  var hostBtn = document.querySelector("#cabinet-netplay-host");
  var joinBtn = document.querySelector("#cabinet-netplay-join");
  var hostSection = document.querySelector("#cabinet-netplay-host-section");
  var joinSection = document.querySelector("#cabinet-netplay-join-section");
  var roomCodeEl = document.querySelector("#cabinet-netplay-room-code");
  var codeInput = document.querySelector("#cabinet-netplay-code-input");
  var connectBtn = document.querySelector("#cabinet-netplay-connect");
  var statusEl = document.querySelector("#cabinet-netplay-status");
  if (!openBtn || !panel) return;
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function showSection(which) { if (hostSection) hostSection.style.display = which === "host" ? "flex" : "none"; if (joinSection) joinSection.style.display = which === "join" ? "flex" : "none"; }
  openBtn.addEventListener("click", function () { cabinetSetMenuOpen(false); panel.setAttribute("aria-hidden", "false"); panel.classList.add("is-open"); backdrop.classList.add("is-open"); showSection(null); setStatus(""); });
  function closePanel() { panel.setAttribute("aria-hidden", "true"); panel.classList.remove("is-open"); backdrop.classList.remove("is-open"); }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  if (hostBtn) hostBtn.addEventListener("click", function () {
    setStatus("Connecting to netplay server…"); showSection("host"); if (roomCodeEl) roomCodeEl.textContent = "…";
    cabinetNetplayRole = "host";
    cabinetNetplayConnect(function (ws) {
      ws.send(JSON.stringify({ type: "create-room" }));
      ws.addEventListener("message", function onMsg(e) {
        var msg; try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === "room-created") {
          var code = msg.room; if (roomCodeEl) roomCodeEl.textContent = code; setStatus("Share this code with your opponent.");
          try {
            var emu = window.EJS_emulator;
            if (emu && emu.netplay && typeof emu.netplay.host === "function") emu.netplay.host(code);
            else if (emu && typeof emu.enableNetplay === "function") emu.enableNetplay(true, code, true);
          } catch (_e) {}
        } else if (msg.type === "peer-joined") { setStatus("Opponent connected! Game syncing…"); cabinetToast("Netplay: opponent joined!"); }
        else if (msg.type === "peer-disconnected") { setStatus("Opponent disconnected."); cabinetToast("Netplay: opponent left"); }
        else if (msg.type === "error") setStatus("Error: " + msg.message);
      });
    });
  });
  if (roomCodeEl) roomCodeEl.addEventListener("click", function () {
    var code = roomCodeEl.textContent || ""; if (code && code !== "\u2014" && code !== "\u2026") navigator.clipboard.writeText(code).then(function () { cabinetToast("Room code copied!"); }).catch(function () {});
  });
  if (joinBtn) joinBtn.addEventListener("click", function () { showSection("join"); setStatus("Enter the host's room code and press Connect."); if (codeInput) codeInput.focus(); });
  if (connectBtn) connectBtn.addEventListener("click", function () {
    var code = (codeInput ? codeInput.value : "").trim().toUpperCase(); if (!code || code.length < 4) { setStatus("Please enter a valid room code."); return; }
    setStatus("Connecting to room " + code + "\u2026"); cabinetNetplayRole = "client";
    cabinetNetplayConnect(function (ws) {
      ws.send(JSON.stringify({ type: "join-room", room: code }));
      ws.addEventListener("message", function onMsg(e) {
        var msg; try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === "room-joined") {
          setStatus("Connected! Waiting for game sync\u2026"); cabinetToast("Netplay: joined room " + code);
          try {
            var emu = window.EJS_emulator;
            if (emu && emu.netplay && typeof emu.netplay.join === "function") emu.netplay.join(code);
            else if (emu && typeof emu.enableNetplay === "function") emu.enableNetplay(true, code, false);
          } catch (_e) {}
        } else if (msg.type === "peer-disconnected") { setStatus("Host disconnected."); cabinetToast("Netplay: host left"); }
        else if (msg.type === "error") { setStatus("Error: " + msg.message); cabinetToast("Netplay: " + msg.message); }
      });
    });
  });
}
function cabinetSetupWarp() {
  var openBtn = document.querySelector("#cabinet-warp-open");
  var closeBtn = document.querySelector("#cabinet-warp-close");
  var panel = document.querySelector("#cabinet-warp-panel");
  var qrContainer = document.querySelector("#cabinet-warp-qr");
  var manualSection = document.querySelector("#cabinet-warp-manual");
  var urlInput = document.querySelector("#cabinet-warp-url");
  
  if (!openBtn || !panel) return;

  openBtn.addEventListener("click", async function () {
    cabinetSetMenuOpen(false);
    cabinetSetPanelOpen("cabinet-warp-panel", true);
    
    if (manualSection) manualSection.style.display = "none";
    if (qrContainer) {
      qrContainer.style.display = "flex";
      qrContainer.innerHTML = '<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#000;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:20px;">Synchronizing Warp Point...</div>';
    }

    try {
      // 1. Trigger quick save to slot 0 (Universally supported Auto-save slot)
      var slot = 0;
      cabinetSetEmulatorSaveSlot(slot);
      var emulator = window.EJS_emulator;
      var saved = false;
      if (emulator && emulator.gameManager && typeof emulator.gameManager.saveState === "function") {
        try { emulator.gameManager.saveState(slot); saved = true; } catch (_error) { saved = false; }
      }
      if (!saved) { cabinetSendInput(24, "1"); }

      // 2. Wait for VFS to flush and upload (Retrying up to 3 times)
      var attempt = 0;
      var maxAttempts = 3;
      var checkAndSync = async function() {
        try {
          attempt++;
          // Ensure VFS is synced if the core supports it
          if (emulator && emulator.gameManager && emulator.gameManager.FS && typeof emulator.gameManager.FS.syncfs === "function") {
            await new Promise(function(resolve) { emulator.gameManager.FS.syncfs(false, resolve); });
          }

          await cabinetCaptureThumb(slot);
          await cabinetBackupSlot(slot);
          await cabinetRecordSaveSlot(slot);

          // Success -> Generate Warp URL
          var currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("loadSlot", String(slot));
          currentUrl.searchParams.set("warp", "true");
          currentUrl.searchParams.set("t", String(Date.now())); // Cache buster
          var warpUrl = currentUrl.toString();

          // 3. Show QR Code
          if (qrContainer) {
            var qrSize = 200;
            var qrApi = "https://api.qrserver.com/v1/create-qr-code/?size=" + qrSize + "x" + qrSize + "&data=" + encodeURIComponent(warpUrl);
            var img = new Image();
            img.width = qrSize; img.height = qrSize;
            img.style.display = "block"; img.style.borderRadius = "4px";
            img.alt = "Warp QR Code";
            img.onload = function() { qrContainer.innerHTML = ""; qrContainer.appendChild(img); cabinetToast("Warp Point Ready \\u2728"); };
            img.onerror = function() {
              qrContainer.style.display = "none";
              if (manualSection && urlInput) {
                manualSection.style.display = "flex";
                urlInput.value = warpUrl;
                cabinetToast("QR Blocked (CSP), showing manual link");
              }
            };
            img.src = qrApi;
          }
        } catch (e) {
          if (attempt < maxAttempts) {
            console.log("[Warp] Sync attempt " + attempt + " failed, retrying...");
            setTimeout(checkAndSync, 1000);
          } else {
            console.error("[Warp] Save/Upload failed after " + maxAttempts + " attempts:", e);
            cabinetToast("Warp failed: could not sync save");
            if (qrContainer) qrContainer.innerHTML = '<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#ef4444;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:20px;">Warp Failed<br><br>Check BIOS or Core compatibility</div>';
          }
        }
      };

      setTimeout(checkAndSync, 1500); // Initial delay
    } catch (e) {
      console.error("[Warp] Fatal Error:", e);
      cabinetToast("Warp failed");
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", function() { cabinetSetPanelOpen("cabinet-warp-panel", false); });
}
cabinetSetupSystemMenu(); cabinetSetupVirtualPad(); cabinetSetupGamepadPanel(); cabinetSetupRemapProfiles(); cabinetSetupNetplay(); cabinetSetupWarp(); cabinetFetchSaveSlots(); cabinetFetchServerBackups();
(function () {
  var RETROPAD_TO_PHYSICAL = ${JSON.stringify(gamepadBindings)};
  var DEFAULT_MAP = { 0: 0, 1: 2, 2: 8, 3: 9, 4: 12, 5: 13, 6: 14, 7: 15, 8: 1, 9: 3, 10: 4, 11: 5, 12: 6, 13: 7, 14: 10, 15: 11, };
  var retroToPhys = Object.keys(RETROPAD_TO_PHYSICAL).length > 0 ? RETROPAD_TO_PHYSICAL : DEFAULT_MAP;
  var physToRetro = {}; Object.keys(retroToPhys).forEach(function (r) { physToRetro[Number(retroToPhys[r])] = Number(r); });
  var btnState = {}; var axisState = {};
  function pressRetro(retro, on) { cabinetSimulateInput(retro, on); }
  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : []; var pad = null;
    for (var i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { pad = pads[i]; break; } }
    if (pad && window.EJS_emulator) {
      for (var p = 0; p < pad.buttons.length; p++) {
        var on = pad.buttons[p].pressed || pad.buttons[p].value > 0.5; var retro = physToRetro[p]; if (retro === undefined) continue;
        if (on && !btnState[p]) { btnState[p] = true; pressRetro(retro, true); }
        if (!on && btnState[p]) { btnState[p] = false; pressRetro(retro, false); }
      }
      var axes = pad.axes || [];
      if (axes.length >= 2) {
        var T = 0.5; var axChecks = [[200, axes[0] < -T, 6], [201, axes[0] > T, 7], [202, axes[1] < -T, 4], [203, axes[1] > T, 5]];
        axChecks.forEach(function (e) { var key = e[0], active = !!e[1], r = e[2]; if (active && !axisState[key]) { axisState[key] = true; pressRetro(r, true); } if (!active && axisState[key]) { axisState[key] = false; pressRetro(r, false); } });
      }
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
})();
window.EJS_ready = function () { cabinetSetLaunchProgress(62, "Emulator ready. Loading game\u2026", "Core ready"); };
var cabinetSessionStart = 0;
window.EJS_onGameStart = function () {
  cabinetFinishLaunchProgress("Game ready"); cabinetInitDisplay(); cabinetSessionStart = Date.now();
  fetch("./play-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "started" }), }).catch(function () {});
  window.addEventListener("beforeunload", function () { if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") try { window.EJS_emulator.saveState(0); } catch (e) {} });
  document.addEventListener("visibilitychange", function () { if (document.hidden && window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") try { window.EJS_emulator.saveState(0); cabinetCaptureThumb("auto"); localStorage.setItem("cabinet_autosave_" + (window.EJS_gameID || ""), String(Date.now())); } catch (_e) {} });
  window.addEventListener("pagehide", function () { if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") try { window.EJS_emulator.saveState(0); } catch (_e) {} });
  var _autoKey = "cabinet_autosave_" + (window.EJS_gameID || ""); var _autoTs = null;
  var _urlParams = new URLSearchParams(window.location.search);
  var _loadSlot = _urlParams.get("loadSlot");

  try { _autoTs = localStorage.getItem(_autoKey); } catch (_e) {}
  
  if (_loadSlot) {
    var slotNum = _loadSlot === "latest" ? 1 : Number(_loadSlot); // 'latest' logic can be improved but 1 is safe default
    setTimeout(function () { 
      cabinetToast("Resuming from slot " + slotNum + "\u2026");
      if (window.EJS_emulator && typeof window.EJS_emulator.loadState === "function") try { window.EJS_emulator.loadState(slotNum); } catch (_e) {} 
    }, 2500);
  } else if (_autoTs) {
    try { localStorage.removeItem(_autoKey); } catch (_e) {}
    var _autoMins = Math.round((Date.now() - Number(_autoTs)) / 60000); var _autoLabel = _autoMins < 1 ? "just now" : _autoMins + " min ago";
    setTimeout(function () { cabinetToast("Resuming auto-save from " + _autoLabel + "\u2026"); if (window.EJS_emulator && typeof window.EJS_emulator.loadState === "function") try { window.EJS_emulator.loadState(0); } catch (_e) {} }, 2500);
  }
};
window.EJS_player = "#game"; window.EJS_core = ${JSON.stringify(core)}; window.CABINET_CORE = ${JSON.stringify(core)}; window.EJS_gameName = ${JSON.stringify(title)}; window.EJS_gameID = ${JSON.stringify(userId + "_" + gameId)}; window.CABINET_USER_ID = ${JSON.stringify(userId)}; window.CABINET_USER_NAME = ${JSON.stringify(userName)}; window.CABINET_PROFILE_ID = ${JSON.stringify(profileId)};
(function () { var name = window.CABINET_USER_NAME || ""; var el = document.getElementById("cabinet-save-user"); if (el) el.textContent = name || "you"; var badge = document.getElementById("cabinet-user-badge"); if (badge && name && name !== "default") { badge.textContent = name; badge.removeAttribute("hidden"); } })();
${discs.length > 1 ? `window.EJS_discs = ${JSON.stringify(discs.map((d) => ({ fileName: `../\${d.id}/file`, label: d.label })))};` : `window.EJS_gameUrl = "./file";`}
${biosUrl ? `window.EJS_biosUrl = ${JSON.stringify(biosUrl)};` : ""}
window.EJS_pathtodata = "../../emulatorjs/"; window.EJS_startOnLoaded = true; window.EJS_AdUrl = "";
(function () { var proto = window.location.protocol === "https:" ? "wss:" : "ws:"; var _p = window.location.pathname; var _i = _p.indexOf("/api/roms/"); var base = _i >= 0 ? _p.slice(0, _i) : ""; window.EJS_netplayUrl = proto + "//" + window.location.host + base + "/api/netplay"; })();
${raUsername && raToken ? `window.EJS_retroachievements = { username: ${JSON.stringify(raUsername)}, apiKey: ${JSON.stringify(raToken)}, hardcore: false };` : "// RetroAchievements not configured"}
window.EJS_rewindEnabled = true; window.EJS_rewindGranularity = 2; window.EJS_fastForwardSpeed = 3; window.EJS_controlScheme = ${JSON.stringify(core)};
${cheats.length > 0 ? `window.EJS_cheats = ${JSON.stringify(cheats.map(c => [c.description, c.code]))};` : "// No cheats saved for this game"}
window.EJS_defaultControls = ${JSON.stringify(buildEjsControls(core, controlDefaults, gamepadBindings, controlDefaultsP2, gamepadBindingsP2))};
window.CABINET_RUMBLE = ${JSON.stringify(gamepadRumble)};
window.EJS_defaultOptions = { "save-state-location": "browser", "save-state-slot": 1 };
(function () {
  var sysId = ${JSON.stringify(core)};
  var opts = ${JSON.stringify(systemDisplay)};
  var sysOpts = opts[sysId] || {};
  
  // Use per-system shader or fallback to global shader
  var shader = sysOpts.shader || ${JSON.stringify(globalShader || "none")};
  if (shader && shader !== "none") {
    window.EJS_defaultOptions["shader"] = shader;
  }
  
  // Ensure aspect ratio fallbacks to global
  if (!sysOpts.aspectRatio && ${JSON.stringify(globalAspectRatio)} !== "auto") {
    sysOpts.aspectRatio = ${JSON.stringify(globalAspectRatio)};
  }
  
  window.CABINET_DISPLAY_OPTS = sysOpts;
})();
window.EJS_Buttons = { playPause: true, restart: true, mute: true, settings: true, fullscreen: true, saveState: true, loadState: true, screenRecord: false, gamepad: true, cheat: true, volume: true, saveSavFiles: true, loadSavFiles: true, quickSave: true, quickLoad: true, screenshot: true, cacheManager: true, exitEmulation: true };
var loader = document.createElement("script"); loader.src = "../../emulatorjs/loader.js";
loader.onload = function () { cabinetSetLaunchProgress(42, "Emulator loader downloaded\u2026", "Loader"); };
loader.onerror = function () { cabinetFailLaunchProgress("Emulator loader blocked. Try the standalone player or local Home Assistant add-on."); var game = document.querySelector("#game"); if (game) game.innerHTML = '<div class="loading"><div>Emulator loader blocked</div><div class="hint">The preview frame could not load EmulatorJS from the CDN. The Home Assistant local add-on will avoid this by serving the emulator locally.</div></div>'; };
document.body.appendChild(loader);
`;
}
