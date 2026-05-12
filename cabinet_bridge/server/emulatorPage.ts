export function renderEmulatorPage({ title, returnTo, romHash }: { title: string; returnTo: string; romHash: string | null }) {
  const safeTitle = escapeHtml(title);
  const safeReturnTo = JSON.stringify(returnTo);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} · Cabinet Bridge</title>
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
    <div class="cabinet-toast" id="cabinet-toast" role="status" aria-live="polite"></div>
    <div id="game">
      <div class="loading">
        <div>Loading ${safeTitle}</div>
        <div class="hint">If this message stays visible, the preview frame blocked the emulator loader. Use the standalone player button above, or run Cabinet Bridge locally in Home Assistant.</div>
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


// ── EJS default controls builder ──────────────────────────────────────────────────────────────

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

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
