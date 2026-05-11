#!/usr/bin/env node
/**
 * One-shot patch: adds the live play timer and sync timestamp to routes.ts.
 * Run from the cabinet_bridge directory:
 *   node server/apply-overlay-patches.mjs
 * Then delete this file — the changes are permanent in routes.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesPath = path.join(__dirname, "routes.ts");
let src = readFileSync(routesPath, "utf8");

const original = src;
let patched = 0;

function patch(oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error(`SKIP  ${label} — anchor not found (already applied?).`);
    return;
  }
  src = src.replace(oldStr, newStr);
  console.log(`OK    ${label}`);
  patched++;
}

// ── 1. Play-timer CSS ─────────────────────────────────────────────────────────
patch(
  `    </style>`,
  `      /* ── Live play timer ──────────────────────────────────────────── */
      #cabinet-playtimer {
        position: fixed;
        z-index: 999999;
        top: max(12px, env(safe-area-inset-top));
        right: max(12px, env(safe-area-inset-right));
        appearance: none;
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 999px;
        background: rgba(5,5,7,0.58);
        color: #94a3b8;
        font: 700 10px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
        letter-spacing: 0.12em;
        height: 46px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        pointer-events: none;
        user-select: none;
      }
    </style>`,
  "CSS: #cabinet-playtimer"
);

// ── 2. Timer element in body ──────────────────────────────────────────────────
patch(
  `    <button type="button" class="cabinet-menu-button" id="cabinet-menu-toggle" aria-expanded="false" aria-controls="cabinet-menu-panel" data-testid="button-open-player-menu">Menu</button>`,
  `    <button type="button" class="cabinet-menu-button" id="cabinet-menu-toggle" aria-expanded="false" aria-controls="cabinet-menu-panel" data-testid="button-open-player-menu">Menu</button>\n    <div id="cabinet-playtimer" role="timer" aria-label="Play time" aria-live="off">0:00</div>`,
  "HTML: #cabinet-playtimer div"
);

// ── 3. Sync timestamp span ────────────────────────────────────────────────────
patch(
  `      <div style="padding:8px 14px 12px;display:flex;justify-content:flex-end;">\n        <button type="button" id="cabinet-sync-from-server"`,
  `      <div style="padding:8px 14px 12px;display:flex;align-items:center;justify-content:flex-end;gap:10px;">\n        <span id="cabinet-sync-ts" style="font:400 9px ui-monospace,monospace;color:#475569;"></span>\n        <button type="button" id="cabinet-sync-from-server"`,
  "HTML: #cabinet-sync-ts span"
);

// ── 4. Timer start interval in EJS_emulator_ready ────────────────────────────
patch(
  `  cabinetApplyRemap(cabinetLoadRemap());\n`,
  `  cabinetApplyRemap(cabinetLoadRemap());\n\n  // ── Live play timer ─────────────────────────────────────────────────────\n  (function () {\n    var _timerStart = Date.now();\n    var _timerEl = document.getElementById("cabinet-playtimer");\n    if (!_timerEl) return;\n    setInterval(function () {\n      var elapsed = Math.floor((Date.now() - _timerStart) / 1000);\n      var h = Math.floor(elapsed / 3600);\n      var m = Math.floor((elapsed % 3600) / 60);\n      var s = elapsed % 60;\n      _timerEl.textContent = h > 0\n        ? h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")\n        : m + ":" + String(s).padStart(2, "0");\n    }, 1000);\n  })();\n\n`,
  "JS: timer setInterval in EJS_emulator_ready"
);

// ── 5. Save sync timestamp in cabinetAutoSyncFromServer ──────────────────────
patch(
  `    cabinetToast("\\u2601 Synced " + restored + " save state" + (restored > 1 ? "s" : "") + " from server");\n  }\n}`,
  `    cabinetToast("\\u2601 Synced " + restored + " save state" + (restored > 1 ? "s" : "") + " from server");\n  }\n  // Record last-sync time and update the label\n  var _nowTs = Date.now();\n  try { localStorage.setItem("cabinet-last-sync", String(_nowTs)); } catch(_e) {}\n  (function() {\n    var el = document.getElementById("cabinet-sync-ts");\n    if (el) el.textContent = "Last synced: just now";\n  })();\n}`,
  "JS: persist sync timestamp after cabinetAutoSyncFromServer"
);

// ── 6. Init sync label from localStorage ─────────────────────────────────────
patch(
  `// ── Gamepad tester ──────────────────────────────────────────────────────────\nfunction cabinetSetupGamepadPanel() {`,
  `// ── Sync timestamp init ──────────────────────────────────────────────────────\n(function() {\n  function _cabinetFmtSyncAgo(ts) {\n    var secs = Math.floor((Date.now() - ts) / 1000);\n    if (secs < 60) return "just now";\n    if (secs < 3600) return Math.floor(secs / 60) + "m ago";\n    return Math.floor(secs / 3600) + "h ago";\n  }\n  var _storedTs = parseInt(localStorage.getItem("cabinet-last-sync") || "0", 10);\n  if (_storedTs > 0) {\n    var el = document.getElementById("cabinet-sync-ts");\n    if (el) el.textContent = "Last synced: " + _cabinetFmtSyncAgo(_storedTs);\n    setInterval(function() {\n      var el2 = document.getElementById("cabinet-sync-ts");\n      if (el2) el2.textContent = "Last synced: " + _cabinetFmtSyncAgo(_storedTs);\n    }, 30000);\n  }\n})();\n\n// ── Gamepad tester ──────────────────────────────────────────────────────────\nfunction cabinetSetupGamepadPanel() {`,
  "JS: init sync timestamp label from localStorage"
);

if (src === original) {
  console.log("\nNo changes made — all patches were already applied or anchors not found.");
  process.exit(0);
}

writeFileSync(routesPath, src, "utf8");
console.log(`\n✓ Applied ${patched}/6 patches to routes.ts`);
console.log("You can now delete this file: server/apply-overlay-patches.mjs");
