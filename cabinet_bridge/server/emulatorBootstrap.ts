const EJS_DEFAULT_KEYS: Record<number, string> = {
  0: "z", 1: "a", 2: "shift", 3: "enter",
  4: "up arrow", 5: "down arrow", 6: "left arrow", 7: "right arrow",
  8: "x", 9: "s", 10: "q", 11: "w",
  12: "e", 13: "r", 14: "tab", 15: "c",
  24: "1", 25: "2", 26: "3",
};
const EJS_VALUE2: Record<number, string> = {
  // Standard W3C Gamepad API button indices — matches DEFAULT_GAMEPAD_MAP in Settings.tsx.
  // EmulatorJS expects numeric-string indices here, not named constants.
  0: "0",   // Retropad B   → A / Cross      (button 0)
  1: "2",   // Retropad Y   → X / Square     (button 2)
  2: "8",   // Retropad Sel → Select / Share (button 8)
  3: "9",   // Retropad Sta → Start / Menu   (button 9)
  4: "12",  // Retropad D↑  → D-pad Up       (button 12)
  5: "13",  // Retropad D↓  → D-pad Down     (button 13)
  6: "14",  // Retropad D←  → D-pad Left     (button 14)
  7: "15",  // Retropad D→  → D-pad Right    (button 15)
  8: "1",   // Retropad A   → B / Circle     (button 1)
  9: "3",   // Retropad X   → Y / Triangle   (button 3)
  10: "4",  // Retropad L   → LB / L1        (button 4)
  11: "5",  // Retropad R   → RB / R1        (button 5)
  12: "6",  // Retropad L2  → LT / L2        (button 6)
  13: "7",  // Retropad R2  → RT / R2        (button 7)
  14: "10", // Retropad L3  → Left stick     (button 10)
  15: "11", // Retropad R3  → Right stick    (button 11)
};

export function buildPlayerControls(
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
  // Hotkeys (shared, still respect custom overrides)
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
  // Merge numeric keys from saved config (keys may be strings after JSON round-trip)
  const custom: Record<number, string> = {};
  for (const [k, v] of Object.entries(controlDefaults[core] ?? {})) {
    custom[Number(k)] = v;
  }
  const p1 = buildPlayerControls(core, custom, gamepadBindings);
  // Only populate P2 if bindings have been saved for it
  const hasP2 = Object.keys(controlDefaultsP2).length > 0 || Object.keys(gamepadBindingsP2).length > 0;
  const p2 = hasP2 ? buildPlayerControls(core, controlDefaultsP2, gamepadBindingsP2) : {};
  return { 0: p1, 1: p2, 2: {}, 3: {} };
}

export function renderEmulatorBootstrap({ core, title, gameId, romId, discs, romHash, raUsername, raToken, controlDefaults, gamepadBindings, controlDefaultsP2, gamepadBindingsP2, gamepadRumble, systemDisplay, userId, userName, profileId, cheats }: { core: string; title: string; gameId: string; romId: number; discs: Array<{ id: number; label: string }>; romHash: string | null; raUsername: string; raToken: string; controlDefaults: Record<string, Record<number, string>>; gamepadBindings: Record<number, number>; controlDefaultsP2: Record<number, string>; gamepadBindingsP2: Record<number, number>; gamepadRumble: boolean; systemDisplay: Record<string, { aspectRatio?: string; integerScale?: boolean; shader?: string }>; userId: string; userName: string; profileId: string; cheats: Array<{ description: string; code: string }>; }) {
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

    // Prefer EmulatorJS built-in screenshot — avoids WebGL preserveDrawingBuffer=false
    // which causes drawImage() on the canvas to return a black frame.
    var emulator = window.EJS_emulator;
    if (emulator && typeof emulator.screenshot === "function") {
      try { dataUrl = emulator.screenshot(); } catch (_e) {}
    }

    // Fallback: read directly from the canvas (works for 2D-rendered cores)
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

    // Resize the screenshot down to thumbnail size if it came from emulator.screenshot()
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

    // Upload to server
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
      '<div class="cabinet-save-slot__meta">' + (state ? cabinetRelativeTime(state.updatedAt) : (hasBackup ? "No local save — server backup available" : "No save data yet")) + '</div>' +
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
  // Switch UI to running state
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
  // Reset picker UI
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
  // Automatic sync: capture thumb and backup to server
  // Small delay so EmulatorJS has time to flush the state to IDBFS
  setTimeout(function() {
    cabinetCaptureThumb(slot).then(function() {
      return cabinetBackupSlot(slot);
    }).catch(function() {});
  }, 800);

  cabinetRecordSaveSlot(slot)
    .then(function () {
      cabinetToast("Saved state to slot " + slot + " ☁");
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
  // Only confirm success if the API call didn't throw; key-input fallback is fire-and-forget
  if (loaded) {
    cabinetToast("Loaded slot " + slot);
  } else {
    cabinetToast("Loading slot " + slot + "…");
  }
}
function cabinetDeleteLocalSaveSlot(slot) {
  var emulator = window.EJS_emulator;
  if (emulator && emulator.gameManager && emulator.gameManager.FS) {
    var FS = emulator.gameManager.FS;
    var gameId = window.EJS_gameID || "";
    // EmulatorJS saves states as /{gameId}-{slot}.state in IDBFS
    var pathsToTry = [
      "/" + gameId + "-" + slot + ".state",
      "/" + gameId + "-" + slot + ".state.png",
      // Legacy / fallback paths
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
  // Auto-hide the virtual pad when a physical controller connects so it doesn't
  // overlap the game. Restore on mobile if the last controller disconnects.
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
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      cabinetSetMenuOpen(false);
      cabinetSetSaveManagerOpen(false);
      cabinetSetControlsPanel(false);
    }
  });
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
    // Auto-save to slot 0 before exiting so progress is never lost
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
        // Give the emulator a moment to write the state, then exit
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
      if (saveAction === "save") {
        cabinetQuickSaveSlot(slot);
      }
      if (saveAction === "load") {
        cabinetQuickLoadSlot(slot);
        cabinetSetSaveManagerOpen(false);
      }
      if (saveAction === "delete") {
        cabinetDeleteLocalSaveSlot(slot);
      }
      if (saveAction === "backup") {
        cabinetBackupSlot(slot);
      }
      if (saveAction === "restore") {
        cabinetRestoreSlot(slot);
      }
    }
  }
  if (target.id === "cabinet-pad-toggle") {
    cabinetSetMenuOpen(false);
  }
  if (target.id === "cabinet-controls") {
    cabinetSetMenuOpen(false);
    cabinetSetControlsPanel(true);
  }
  if (target.id === "cabinet-controls-close") {
    cabinetSetControlsPanel(false);
  }
  // rewind is hold-to-rewind — handled via mousedown/up events, not click
  if (target.id === "cabinet-ff-toggle") {
    var ffOn = target.getAttribute("aria-pressed") === "true";
    cabinetSetMenuOpen(false);
    cabinetSetFastForward(!ffOn);
  }
  if (target.id === "cabinet-cheats") {
    cabinetOpenCheats();
  }
  if (target.id === "cabinet-screenshot") {
    cabinetTakeScreenshot();
  }
  if (target.id === "cabinet-crt-toggle") {
    var _game = document.querySelector("#game");
    var _crtOn = _game && _game.classList.contains("cabinet-filter-crt");
    cabinetApplyFilter(_crtOn ? "none" : "crt");
    var _crtBtn = document.querySelector("#cabinet-crt-toggle");
    if (_crtBtn) { _crtBtn.setAttribute("aria-pressed", _crtOn ? "false" : "true"); _crtBtn.textContent = _crtOn ? "CRT Filter" : "CRT On"; }
  }
  if (target.id === "cabinet-display-open") {
    cabinetSetDisplayPanel(true);
  }
  if (target.id === "cabinet-display-close") {
    cabinetSetDisplayPanel(false);
  }
  if (target.id === "cabinet-remap-open") {
    cabinetSetRemapPanel(true);
  }
  if (target.id === "cabinet-remap-close") {
    cabinetSetRemapPanel(false);
  }
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
  if (target.dataset && target.dataset.aspect) {
    cabinetApplyAspect(target.dataset.aspect);
  }
  if (target.dataset && target.dataset.filter) {
    cabinetApplyFilter(target.dataset.filter);
  }
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
  // Subtitle
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
    rows.push(section("Face Buttons"));
    rows.push(row("Cross", "Z"));
    rows.push(row("Circle", "X"));
    rows.push(row("Square", "A"));
    rows.push(row("Triangle", "S"));
    rows.push(section("Shoulders"));
    rows.push(row("L1 / R1", "Q / W"));
    rows.push(row("L2 / R2", "E / R"));
    rows.push(row("L3 / R3", "Tab / C"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isGba) {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isGb) {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isN64) {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(row("C-Up/Down/Left/Right", "I / K / J / L"));
    rows.push(row("L / R / Z", "Q / W / E"));
    rows.push(section("System"));
    rows.push(row("Start", "Enter"));
    rows.push(row("Analog Stick", "Arrow Keys"));
  } else if (isNds) {
    rows.push(section("Buttons"));
    rows.push(row("A / B / X / Y", "Z / X / A / S"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
  } else if (isPsp) {
    rows.push(section("Buttons"));
    rows.push(row("Cross / Circle", "Z / X"));
    rows.push(row("Square / Triangle", "A / S"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("Analog / D-Pad", "Arrow Keys"));
  } else {
    rows.push(section("Buttons"));
    rows.push(row("A / B", "Z / X"));
    rows.push(row("X / Y", "A / S"));
    rows.push(row("L / R", "Q / W"));
    rows.push(section("System"));
    rows.push(row("Start / Select", "Enter / Shift"));
    rows.push(row("D-Pad", "Arrow Keys"));
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
    if (typeof M.setFastForward === "function") {
      try { M.setFastForward(enabled ? 1 : 0); ok = true; } catch (_e) {}
    }
    if (!ok && typeof M._RA_cmd_toggle_fastforward === "function") {
      try { M._RA_cmd_toggle_fastforward(); ok = true; } catch (_e) {}
    }
  }
  if (!ok && emulator && typeof emulator.setFastForward === "function") {
    try { emulator.setFastForward(enabled); ok = true; } catch (_e) {}
  }
  cabinetToast(enabled ? "Fast-forward ON (3×)" : "Fast-forward OFF");
}
function cabinetOpenCheats() {
  cabinetSetPanelOpen("cabinet-cheats-panel", true);
  cabinetLoadCheats();
}
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
  if (!cheats || cheats.length === 0) {
    list.innerHTML = '<div style="color:rgba(248,250,252,0.35);font:600 10px ui-monospace,monospace;text-align:center;padding:24px 0;">No cheats yet. Add one above.</div>';
    return;
  }
  list.innerHTML = "";
  cheats.forEach(function(cheat) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;background:rgba(248,250,252,0.05);border:1px solid rgba(248,250,252,0.1);border-radius:8px;padding:8px 10px;";
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", cheat.enabled ? "true" : "false");
    toggle.title = cheat.enabled ? "Disable" : "Enable";
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
    var info = document.createElement("div");
    info.style.cssText = "flex:1;min-width:0;";
    var desc = document.createElement("div");
    desc.style.cssText = "color:#f8fafc;font:600 11px ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    desc.textContent = cheat.description;
    var code = document.createElement("div");
    code.style.cssText = "color:rgba(248,250,252,0.45);font:500 9px ui-monospace,monospace;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    code.textContent = cheat.code;
    info.appendChild(desc);
    info.appendChild(code);
    var del = document.createElement("button");
    del.type = "button";
    del.title = "Delete";
    del.style.cssText = "flex-shrink:0;appearance:none;border:1px solid rgba(239,68,68,0.3);border-radius:6px;background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.8);cursor:pointer;font:700 10px ui-monospace,monospace;padding:3px 7px;";
    del.textContent = "Del";
    del.addEventListener("click", function() {
      fetch("../../cheats/" + cheat.id, { method: "DELETE" })
        .then(function() { cabinetLoadCheats(); cabinetToast("Cheat deleted"); })
        .catch(function() { cabinetToast("Failed to delete cheat"); });
    });
    row.appendChild(toggle);
    row.appendChild(info);
    row.appendChild(del);
    list.appendChild(row);
  });
}
(function cabinetInitCheatsPanel() {
  document.addEventListener("DOMContentLoaded", function() {
    var closeBtn = document.querySelector("#cabinet-cheats-close");
    if (closeBtn) closeBtn.addEventListener("click", function() { cabinetSetPanelOpen("cabinet-cheats-panel", false); });
    var addBtn = document.querySelector("#cabinet-cheat-add");
    if (addBtn) addBtn.addEventListener("click", function() {
      var desc = (document.querySelector("#cabinet-cheat-desc") || {}).value || "";
      var code = (document.querySelector("#cabinet-cheat-code") || {}).value || "";
      if (!desc.trim() || !code.trim()) { cabinetToast("Enter a description and code"); return; }
      addBtn.disabled = true;
      addBtn.textContent = "Adding…";
      fetch("../../roms/" + cabinetRomId + "/cheats", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ description: desc.trim(), code: code.trim(), profileId: Number(window.CABINET_PROFILE_ID || 1) })
      }).then(function(r) {
        if (r.status === 409) { cabinetToast("Cheat already exists"); return; }
        var d = document.querySelector("#cabinet-cheat-desc");
        var c = document.querySelector("#cabinet-cheat-code");
        if (d) d.value = "";
        if (c) c.value = "";
        cabinetLoadCheats();
        cabinetToast("Cheat added");
      }).catch(function() { cabinetToast("Failed to add cheat"); })
      .finally(function() { addBtn.disabled = false; addBtn.textContent = "+ Add"; });
    });
  });
})();
function cabinetTakeScreenshot() {
  cabinetSetMenuOpen(false);
  var emulator = window.EJS_emulator;
  var canvas = document.querySelector("#game canvas");
  if (!canvas) {
    cabinetToast("No game canvas found");
    return;
  }
  try {
    var dataUrl = canvas.toDataURL("image/png");
    var a = document.createElement("a");
    a.href = dataUrl;
    a.download = (window.EJS_gameName || "screenshot") + "-" + Date.now() + ".png";
    a.click();
    cabinetToast("Screenshot saved!");
  } catch (_e) {
    cabinetToast("Screenshot failed (cross-origin canvas)");
  }
}
function cabinetSetDisplayPanel(open) {
  var panel = document.querySelector("#cabinet-display-panel");
  var backdrop = document.querySelector("#cabinet-menu-backdrop");
  if (!panel || !backdrop) return;
  if (open) cabinetSetMenuOpen(false);
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
}
function cabinetApplyAspect(aspect) {
  var game = document.querySelector("#game");
  if (!game) return;
  // Remove all aspect classes then add the chosen one.
  // CSS uses !important so it wins over EmulatorJS inline canvas styles.
  game.classList.remove("cabinet-aspect-4-3", "cabinet-aspect-16-9", "cabinet-aspect-pixel", "cabinet-aspect-stretch");
  var cls = { "4:3": "cabinet-aspect-4-3", "16:9": "cabinet-aspect-16-9", "pixel": "cabinet-aspect-pixel", "stretch": "cabinet-aspect-stretch" }[aspect];
  if (cls) game.classList.add(cls);
  var btns = document.querySelectorAll("[data-aspect]");
  btns.forEach(function (b) {
    b.setAttribute("aria-checked", b.getAttribute("data-aspect") === aspect ? "true" : "false");
  });
  try { localStorage.setItem("cabinet_aspect", aspect); } catch (_e) {}
}
function cabinetApplyFilter(filter) {
  var game = document.querySelector("#game");
  if (!game) return;
  game.classList.remove("cabinet-filter-crt", "cabinet-filter-smooth", "cabinet-filter-scanlines", "cabinet-filter-lcd", "cabinet-filter-phosphor");
  if (filter !== "none") game.classList.add("cabinet-filter-" + filter);
  var btns = document.querySelectorAll("[data-filter]");
  btns.forEach(function (b) {
    b.setAttribute("aria-checked", b.getAttribute("data-filter") === filter ? "true" : "false");
  });
  try { localStorage.setItem("cabinet_filter", filter); } catch (_e) {}
}
function cabinetInitDisplay() {
  try {
    var aspect = localStorage.getItem("cabinet_aspect") || "4:3";
    var filter = localStorage.getItem("cabinet_filter") || "none";
    window.setTimeout(function () {
      cabinetApplyAspect(aspect);
      cabinetApplyFilter(filter);
      // Sync the CRT quick-toggle button label
      var _crtBtn = document.querySelector("#cabinet-crt-toggle");
      if (_crtBtn) {
        var _on = filter === "crt";
        _crtBtn.setAttribute("aria-pressed", _on ? "true" : "false");
        _crtBtn.textContent = _on ? "CRT On" : "CRT Filter";
      }
    }, 500);
  } catch (_e) {}
}
// ── Per-game key remapping ─────────────────────────────────────────────────
var cabinetRemapTarget = null; // { player, index, label }
var CABINET_BUTTON_LABELS = [
  "Cross / A", "Square / B", "Select", "Start",
  "D-Pad Up", "D-Pad Down", "D-Pad Left", "D-Pad Right",
  "Circle / A2", "Triangle / B2", "L1", "R1", "L2", "R2", "L3", "R3",
];
function cabinetRemapStorageKey() {
  return "cabinet_remap_" + (window.EJS_gameID || "game");
}
function cabinetLoadRemap() {
  try {
    var raw = localStorage.getItem(cabinetRemapStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (_e) { return null; }
}
function cabinetSaveRemap(mapping) {
  try { localStorage.setItem(cabinetRemapStorageKey(), JSON.stringify(mapping)); } catch (_e) {}
}
// ── Remap profiles ─────────────────────────────────────────────────────────
function cabinetProfilesKey() {
  return "cabinet_remap_profiles_" + (window.EJS_gameID || "game");
}
function cabinetLoadProfiles() {
  try {
    var raw = localStorage.getItem(cabinetProfilesKey());
    return raw ? JSON.parse(raw) : {};
  } catch (_e) { return {}; }
}
function cabinetSaveProfiles(profiles) {
  try { localStorage.setItem(cabinetProfilesKey(), JSON.stringify(profiles)); } catch (_e) {}
}
function cabinetRefreshProfileSelect() {
  var sel = document.querySelector("#cabinet-remap-profile-select");
  if (!sel) return;
  var profiles = cabinetLoadProfiles();
  var names = Object.keys(profiles);
  sel.innerHTML = names.length === 0
    ? '<option value="">— no saved profiles —</option>'
    : names.map(function (n) { return '<option value="' + cabinetEscapeText(n) + '">' + cabinetEscapeText(n) + '</option>'; }).join("");
}
function cabinetSetupRemapProfiles() {
  var loadBtn = document.querySelector("#cabinet-remap-profile-load");
  var saveBtn = document.querySelector("#cabinet-remap-profile-save");
  var delBtn = document.querySelector("#cabinet-remap-profile-delete");
  var sel = document.querySelector("#cabinet-remap-profile-select");
  if (!loadBtn || !saveBtn || !delBtn || !sel) return;
  cabinetRefreshProfileSelect();
  loadBtn.addEventListener("click", function () {
    var name = sel.value;
    if (!name) return;
    var profiles = cabinetLoadProfiles();
    if (!profiles[name]) return;
    cabinetSaveRemap(profiles[name]);
    cabinetApplyRemap(profiles[name]);
    cabinetRenderRemapGrid();
    cabinetToast("Loaded profile: " + name);
  });
  saveBtn.addEventListener("click", function () {
    var name = window.prompt("Profile name:", "");
    if (!name || !name.trim()) return;
    name = name.trim().slice(0, 32);
    var profiles = cabinetLoadProfiles();
    profiles[name] = cabinetLoadRemap() || {};
    cabinetSaveProfiles(profiles);
    cabinetRefreshProfileSelect();
    sel.value = name;
    cabinetToast("Saved profile: " + name);
  });
  delBtn.addEventListener("click", function () {
    var name = sel.value;
    if (!name) return;
    var profiles = cabinetLoadProfiles();
    delete profiles[name];
    cabinetSaveProfiles(profiles);
    cabinetRefreshProfileSelect();
    cabinetToast("Deleted profile: " + name);
  });
}

function cabinetApplyRemap(mapping) {
  if (!mapping) return;
  var emulator = window.EJS_emulator;
  if (!emulator) return;
  Object.keys(mapping).forEach(function (indexStr) {
    var index = parseInt(indexStr, 10);
    var key = mapping[indexStr];
    if (emulator.settings) {
      emulator.settings["p1_" + index] = key;
    }
    if (typeof emulator.changeSettingOption === "function") {
      try { emulator.changeSettingOption("p1_" + index, key); } catch (_e) {}
    }
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
  panel.classList.toggle("is-open", open);
  backdrop.classList.toggle("is-open", open);
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
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;";
    var nameEl = document.createElement("span");
    nameEl.style.cssText = "color:rgba(248,250,252,0.7);font:700 9px ui-monospace,monospace;letter-spacing:0.1em;text-transform:uppercase;";
    nameEl.textContent = label;
    var keyBtn = document.createElement("button");
    keyBtn.type = "button";
    keyBtn.setAttribute("data-remap-index", String(index));
    keyBtn.style.cssText = "appearance:none;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.08);color:#f8fafc;cursor:pointer;font:800 10px ui-monospace,monospace;letter-spacing:0.1em;min-width:72px;padding:8px 10px;text-transform:uppercase;";
    keyBtn.textContent = currentKey;
    if (cabinetRemapTarget && cabinetRemapTarget.index === index) {
      keyBtn.style.borderColor = "rgba(236,72,153,0.9)";
      keyBtn.style.background = "rgba(236,72,153,0.25)";
      keyBtn.textContent = "Press key…";
    }
    row.appendChild(nameEl);
    row.appendChild(keyBtn);
    grid.appendChild(row);
  });
}
document.addEventListener("keydown", function (e) {
  if (!cabinetRemapTarget) return;
  e.preventDefault();
  e.stopPropagation();
  var key = e.key.toLowerCase();
  if (key === "escape") { cabinetRemapTarget = null; cabinetRenderRemapGrid(); return; }
  var mapping = cabinetLoadRemap() || {};
  mapping[cabinetRemapTarget.index] = key;
  cabinetSaveRemap(mapping);
  cabinetApplyRemap(mapping);
  cabinetRemapTarget = null;
  cabinetRenderRemapGrid();
  cabinetToast("Mapped to " + key);
}, true);
// Apply saved remap when game starts
window.addEventListener("EJS_emulator_ready", function () {
  cabinetApplyRemap(cabinetLoadRemap());

  // ── Per-system display options ─────────────────────────────────────────
  (function () {
    var opts = window.CABINET_DISPLAY_OPTS || {};
    var canvas = document.querySelector("#game canvas");
    if (!canvas) return;
    // Integer scale: pixelated rendering
    if (opts.integerScale) {
      canvas.style.imageRendering = "pixelated";
    }
    // Custom aspect ratio (e.g. "4/3", "3/2")
    if (opts.aspectRatio) {
      canvas.style.aspectRatio = opts.aspectRatio;
      canvas.style.width = "auto";
      canvas.style.height = "100%";
    }
  })();

  // ── Gamepad rumble ─────────────────────────────────────────────────────
  if (window.CABINET_RUMBLE === false) {
    // Disable vibration by overriding Gamepad vibrationActuator
    var _origGetGamepads = navigator.getGamepads.bind(navigator);
    navigator.getGamepads = function () {
      var pads = _origGetGamepads();
      return Array.from(pads).map(function (p) {
        if (!p) return p;
        Object.defineProperty(p, "vibrationActuator", { get: function () { return null; } });
        return p;
      });
    };
  }

  // Auto-sync server saves to local IDBFS (restores missing slots silently)
  setTimeout(cabinetAutoSyncFromServer, 1500);

  // Wire up hold-to-rewind on the rewind button
  var rewindBtn = document.querySelector("#cabinet-rewind-toggle");
  if (rewindBtn) {
    rewindBtn.addEventListener("mousedown", function (e) { e.preventDefault(); cabinetStartRewind(); });
    rewindBtn.addEventListener("touchstart", function (e) { e.preventDefault(); cabinetStartRewind(); }, { passive: false });
    rewindBtn.addEventListener("mouseup", cabinetStopRewind);
    rewindBtn.addEventListener("mouseleave", cabinetStopRewind);
    rewindBtn.addEventListener("touchend", cabinetStopRewind);
    rewindBtn.addEventListener("touchcancel", cabinetStopRewind);
  }
});
// ── Server-side save backup/restore ────────────────────────────────────────
var cabinetServerBackups = [];
async function cabinetFetchServerBackups() {
  try {
    var r = await fetch("./save-backups");
    if (!r.ok) return;
    var d = await r.json();
    cabinetServerBackups = d.slots || [];
  } catch (_e) {
    cabinetServerBackups = [];
  }
}
async function cabinetBackupSlot(slot) {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) {
    cabinetToast("Game must be running to back up a save");
    return;
  }
  var FS = emulator.gameManager.FS;
  var gameId = window.EJS_gameID || "";
  // Try multiple candidate paths — EmulatorJS path format varies by core/version
  var candidates = [
    "/" + gameId + "-" + slot + ".state",
    "/" + gameId + "-" + slot + "-quick.state",
    "/" + slot + ".state",
    slot + "-quick.state",
  ];
  // Also scan IDBFS root for any file ending in the slot pattern
  try {
    var rootFiles = FS.readdir("/");
    for (var i = 0; i < rootFiles.length; i++) {
      var f = rootFiles[i];
      if ((f.endsWith("-" + slot + ".state") || f.endsWith("-" + slot + "-quick.state")) && candidates.indexOf("/" + f) === -1) {
        candidates.push("/" + f);
      }
    }
  } catch (_scanErr) {}
  var data;
  for (var ci = 0; ci < candidates.length; ci++) {
    try {
      data = FS.readFile(candidates[ci], { encoding: "binary" });
      if (data && data.length > 0) break;
    } catch (_e) {}
  }
  if (!data || data.length === 0) {
    cabinetToast("No save data in slot " + slot + " to back up");
    return;
  }
  try {
    var r = await fetch("./save-backup/" + slot, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: data instanceof Uint8Array ? data : new Uint8Array(data),
    });
    if (!r.ok) throw new Error((await r.json()).message || "Failed");
    if (!cabinetServerBackups.includes(slot)) cabinetServerBackups.push(slot);
    cabinetServerBackups.sort(function (a, b) { return a - b; });
    cabinetToast("Slot " + slot + " backed up to server ☁");
    cabinetRenderSaveSlots();
  } catch (err) {
    cabinetToast("Backup failed: " + err.message);
  }
}
async function cabinetRestoreSlot(slot) {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) {
    cabinetToast("Game must be running to restore a save");
    return;
  }
  try {
    var r = await fetch("./save-backup/" + slot);
    if (!r.ok) throw new Error("No backup for slot " + slot);
    var buf = await r.arrayBuffer();
    var FS = emulator.gameManager.FS;
    var gameId = window.EJS_gameID || "";
    var statePath = "/" + gameId + "-" + slot + ".state";
    FS.writeFile(statePath, new Uint8Array(buf));
    if (FS.syncfs) FS.syncfs(false, function () {});
    await cabinetRecordSaveSlot(slot);
    cabinetToast("Slot " + slot + " restored from server ☁");
  } catch (err) {
    cabinetToast("Restore failed: " + err.message);
  }
}

// ── Auto-sync from server on game load ─────────────────────────────────────
// Called after EJS_emulator_ready: for each server backup slot that has no
// local IDBFS state file, silently restore it. Covers fresh browsers and
// cleared IndexedDB without overwriting intentional local-only saves.
async function cabinetAutoSyncFromServer() {
  var emulator = window.EJS_emulator;
  if (!emulator || !emulator.gameManager || !emulator.gameManager.FS) return;
  var FS = emulator.gameManager.FS;
  var gameId = window.EJS_gameID || "";

  // Which slots have server backups?
  await cabinetFetchServerBackups();
  if (!cabinetServerBackups || cabinetServerBackups.length === 0) return;

  // Which slots already exist locally in IDBFS?
  var localSlots = new Set();
  try {
    var rootFiles = FS.readdir("/");
    for (var i = 0; i < rootFiles.length; i++) {
      var f = rootFiles[i];
      // Match patterns like /{gameId}-{slot}.state or /{slot}.state
      var m = f.match(/[-]?(\d+)(?:-quick)?\.state$/);
      if (m) localSlots.add(Number(m[1]));
    }
  } catch (_e) {}

  var restored = 0;
  for (var si = 0; si < cabinetServerBackups.length; si++) {
    var slot = cabinetServerBackups[si];
    if (localSlots.has(slot)) continue; // already have it locally
    try {
      var r = await fetch("./save-backup/" + slot);
      if (!r.ok) continue;
      var buf = await r.arrayBuffer();
      if (!buf || buf.byteLength === 0) continue;
      var statePath = "/" + gameId + "-" + slot + ".state";
      FS.writeFile(statePath, new Uint8Array(buf));
      restored++;
    } catch (_e) {}
  }

  if (restored > 0) {
    if (FS.syncfs) FS.syncfs(false, function () {});
    await cabinetFetchSaveSlots();
    cabinetRenderSaveSlots();
    cabinetToast("☁ Synced " + restored + " save state" + (restored > 1 ? "s" : "") + " from server");
  }
}

// ── Gamepad tester ──────────────────────────────────────────────────────────
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
    if (gamepads.length === 0) {
      statusEl.textContent = "No controller detected. Press any button on your gamepad.";
      listEl.innerHTML = "";
    } else {
      statusEl.textContent = gamepads.length + " controller" + (gamepads.length > 1 ? "s" : "") + " connected.";
      listEl.innerHTML = gamepads.map(function (gp) {
        var btnHtml = (gp.buttons || []).map(function (btn, i) {
          var pressed = btn.pressed || btn.value > 0.1;
          return '<span style="display:inline-block;min-width:28px;padding:3px 5px;margin:2px;border-radius:6px;font:700 9px ui-monospace,monospace;text-align:center;background:' + (pressed ? "#22c55e" : "rgba(248,250,252,0.08)") + ';color:' + (pressed ? "#fff" : "rgba(248,250,252,0.4)") + ';" title="Button ' + i + '">' + i + '</span>';
        }).join("");
        var axisHtml = (gp.axes || []).map(function (v, i) {
          var pct = Math.round((v + 1) * 50);
          return '<span style="display:inline-block;margin:2px 4px;font:600 9px ui-monospace,monospace;color:rgba(248,250,252,0.6);">A' + i + ':<b style="color:#f8fafc;">' + v.toFixed(2) + '</b></span>';
        }).join("");
        return '<div style="background:rgba(248,250,252,0.04);border:1px solid rgba(248,250,252,0.1);border-radius:12px;padding:10px 14px;margin-bottom:6px;">'
          + '<div style="font:700 11px ui-monospace,monospace;color:#f8fafc;margin-bottom:6px;">' + (gp.id || "Unknown Controller") + '</div>'
          + '<div style="margin-bottom:4px;">' + (btnHtml || "<em style='font-style:italic;color:rgba(248,250,252,0.3);font-size:10px;'>No buttons</em>") + '</div>'
          + '<div>' + (axisHtml || "") + '</div>'
          + '</div>';
      }).join("");
    }
    if (panel.getAttribute("aria-hidden") !== "true") {
      gpRaf = requestAnimationFrame(renderGamepads);
    }
  }
  openBtn.addEventListener("click", function () {
    cabinetSetMenuOpen(false);
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    renderGamepads();
  });
  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    if (gpRaf) { cancelAnimationFrame(gpRaf); gpRaf = null; }
  }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  backdrop.addEventListener("click", function () {
    if (panel.classList.contains("is-open")) closePanel();
  });
  window.addEventListener("gamepadconnected", function (e) {
    cabinetToast("Gamepad connected: " + e.gamepad.id.slice(0, 40));
    if (panel.classList.contains("is-open")) renderGamepads();
  });
  window.addEventListener("gamepaddisconnected", function (e) {
    cabinetToast("Gamepad disconnected");
    if (panel.classList.contains("is-open")) renderGamepads();
  });
}

// ── Netplay ─────────────────────────────────────────────────────────────────
function cabinetGenerateRoomCode() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "";
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
var cabinetNetplayWs = null;
var cabinetNetplayRole = null;

function cabinetNetplayConnect(onOpen) {
  if (cabinetNetplayWs && cabinetNetplayWs.readyState === WebSocket.OPEN) {
    onOpen(cabinetNetplayWs);
    return;
  }
  var proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  var _np = window.location.pathname; var _ni = _np.indexOf("/api/roms/"); var base = _ni >= 0 ? _np.slice(0, _ni) : "";
  var url = proto + "//" + window.location.host + base + "/api/netplay";
  var ws = new WebSocket(url);
  ws.addEventListener("open", function () {
    cabinetNetplayWs = ws;
    onOpen(ws);
  });
  ws.addEventListener("error", function () {
    cabinetToast("Netplay: connection failed");
  });
  ws.addEventListener("close", function () {
    cabinetNetplayWs = null;
    cabinetNetplayRole = null;
  });
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
  function showSection(which) {
    if (hostSection) hostSection.style.display = which === "host" ? "flex" : "none";
    if (joinSection) joinSection.style.display = which === "join" ? "flex" : "none";
  }

  openBtn.addEventListener("click", function () {
    cabinetSetMenuOpen(false);
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    backdrop.classList.add("is-open");
    showSection(null);
    setStatus("");
  });

  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    panel.classList.remove("is-open");
    backdrop.classList.remove("is-open");
  }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  if (hostBtn) hostBtn.addEventListener("click", function () {
    setStatus("Connecting to netplay server…");
    showSection("host");
    if (roomCodeEl) roomCodeEl.textContent = "…";
    cabinetNetplayRole = "host";
    cabinetNetplayConnect(function (ws) {
      ws.send(JSON.stringify({ type: "create-room" }));
      ws.addEventListener("message", function onMsg(e) {
        var msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === "room-created") {
          var code = msg.room;
          if (roomCodeEl) roomCodeEl.textContent = code;
          setStatus("Share this code with your opponent.");
          // Tell EmulatorJS netplay which server to use (already set via EJS_netplayUrl)
          // and start hosting — try the built-in API if available
          try {
            var emu = window.EJS_emulator;
            if (emu && emu.netplay && typeof emu.netplay.host === "function") {
              emu.netplay.host(code);
            } else if (emu && typeof emu.enableNetplay === "function") {
              emu.enableNetplay(true, code, true);
            }
          } catch (_e) {}
        } else if (msg.type === "peer-joined") {
          setStatus("Opponent connected! Game syncing…");
          cabinetToast("Netplay: opponent joined!");
        } else if (msg.type === "peer-disconnected") {
          setStatus("Opponent disconnected.");
          cabinetToast("Netplay: opponent left");
        } else if (msg.type === "error") {
          setStatus("Error: " + msg.message);
        }
      });
    });
  });

  if (roomCodeEl) roomCodeEl.addEventListener("click", function () {
    var code = roomCodeEl.textContent || "";
    if (code && code !== "—" && code !== "…") {
      navigator.clipboard.writeText(code).then(function () { cabinetToast("Room code copied!"); }).catch(function () {});
    }
  });

  if (joinBtn) joinBtn.addEventListener("click", function () {
    showSection("join");
    setStatus("Enter the host's room code and press Connect.");
    if (codeInput) codeInput.focus();
  });

  if (connectBtn) connectBtn.addEventListener("click", function () {
    var code = (codeInput ? codeInput.value : "").trim().toUpperCase();
    if (!code || code.length < 4) { setStatus("Please enter a valid room code."); return; }
    setStatus("Connecting to room " + code + "…");
    cabinetNetplayRole = "client";
    cabinetNetplayConnect(function (ws) {
      ws.send(JSON.stringify({ type: "join-room", room: code }));
      ws.addEventListener("message", function onMsg(e) {
        var msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === "room-joined") {
          setStatus("Connected! Waiting for game sync…");
          cabinetToast("Netplay: joined room " + code);
          try {
            var emu = window.EJS_emulator;
            if (emu && emu.netplay && typeof emu.netplay.join === "function") {
              emu.netplay.join(code);
            } else if (emu && typeof emu.enableNetplay === "function") {
              emu.enableNetplay(true, code, false);
            }
          } catch (_e) {}
        } else if (msg.type === "peer-disconnected") {
          setStatus("Host disconnected.");
          cabinetToast("Netplay: host left");
        } else if (msg.type === "error") {
          setStatus("Error: " + msg.message);
          cabinetToast("Netplay: " + msg.message);
        }
      });
    });
  });
}

cabinetSetupSystemMenu();
cabinetSetupVirtualPad();
cabinetSetupGamepadPanel();
cabinetSetupRemapProfiles();
cabinetSetupNetplay();
cabinetFetchSaveSlots();
cabinetFetchServerBackups();

// ── Hardware gamepad polling ─────────────────────────────────────────────────
// EmulatorJS's built-in Gamepad API polling is unreliable (especially under
// HA Ingress). We poll navigator.getGamepads() every frame ourselves and
// call cabinetSimulateInput directly — the same path the virtual pad uses.
(function () {
  // Server-injected binding: retropad-button → physical-button-index.
  // Falls back to the standard Xbox / PS layout when nothing is saved.
  var RETROPAD_TO_PHYSICAL = ${JSON.stringify(gamepadBindings)};
  var DEFAULT_MAP = {
    0: 0, 1: 2, 2: 8,  3: 9,
    4: 12, 5: 13, 6: 14, 7: 15,
    8: 1,  9: 3, 10: 4, 11: 5,
    12: 6, 13: 7, 14: 10, 15: 11,
  };
  var retroToPhys = Object.keys(RETROPAD_TO_PHYSICAL).length > 0
    ? RETROPAD_TO_PHYSICAL : DEFAULT_MAP;

  // Invert to physical-button → retropad-button for fast lookup
  var physToRetro = {};
  Object.keys(retroToPhys).forEach(function (r) {
    physToRetro[Number(retroToPhys[r])] = Number(r);
  });

  var btnState  = {};   // physical button index → boolean
  var axisState = {};   // virtual axis key     → boolean

  function pressRetro(retro, on) { cabinetSimulateInput(retro, on); }

  function releaseAll() {
    var axRetroMap = { 200: 6, 201: 7, 202: 4, 203: 5 };
    Object.keys(btnState).forEach(function (p) {
      if (btnState[p]) { var r = physToRetro[Number(p)]; if (r !== undefined) pressRetro(r, false); }
    });
    Object.keys(axisState).forEach(function (k) {
      if (axisState[k] && axRetroMap[k] !== undefined) pressRetro(axRetroMap[k], false);
    });
    btnState  = {};
    axisState = {};
  }

  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var pad  = null;
    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
    }

    if (pad && window.EJS_emulator) {
      // ── Digital buttons ──────────────────────────────────────────────────
      for (var p = 0; p < pad.buttons.length; p++) {
        var on    = pad.buttons[p].pressed || pad.buttons[p].value > 0.5;
        var retro = physToRetro[p];
        if (retro === undefined) continue;
        if (on  && !btnState[p]) { btnState[p] = true;  pressRetro(retro, true);  }
        if (!on &&  btnState[p]) { btnState[p] = false; pressRetro(retro, false); }
      }

      // ── Left analog stick → D-pad ────────────────────────────────────────
      var axes = pad.axes || [];
      if (axes.length >= 2) {
        var T = 0.5;
        var axChecks = [
          [200, axes[0] < -T, 6],  // stick left  → D-left
          [201, axes[0] >  T, 7],  // stick right → D-right
          [202, axes[1] < -T, 4],  // stick up    → D-up
          [203, axes[1] >  T, 5],  // stick down  → D-down
        ];
        axChecks.forEach(function (e) {
          var key = e[0], active = !!e[1], r = e[2];
          if (active  && !axisState[key]) { axisState[key] = true;  pressRetro(r, true);  }
          if (!active &&  axisState[key]) { axisState[key] = false; pressRetro(r, false); }
        });
      }
    } else if (!pad) {
      releaseAll();
    }

    requestAnimationFrame(poll);
  }

  requestAnimationFrame(poll);
})();

window.EJS_ready = function () {
  cabinetSetLaunchProgress(62, "Emulator ready. Loading game…", "Core ready");
};
var cabinetSessionStart = 0;
window.EJS_onGameStart = function () {
  cabinetFinishLaunchProgress("Game ready");
  cabinetInitDisplay();
  cabinetSessionStart = Date.now();
  fetch("./play-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "started" }),
  }).catch(function () {});
  // Auto-save on unexpected navigation / tab close
  window.addEventListener("beforeunload", function () {
    if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      try { window.EJS_emulator.saveState(0); } catch (e) { /* ignore */ }
    }
  });
  // Auto-save when tab is hidden (mobile app-switch, screen lock, background)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      try {
        window.EJS_emulator.saveState(0);
        cabinetCaptureThumb("auto");
        localStorage.setItem("cabinet_autosave_" + (window.EJS_gameID || ""), String(Date.now()));
      } catch (_e) {}
    }
  });
  // iOS Safari fires pagehide instead of beforeunload when navigating away
  window.addEventListener("pagehide", function () {
    if (window.EJS_emulator && typeof window.EJS_emulator.saveState === "function") {
      try { window.EJS_emulator.saveState(0); } catch (_e) {}
    }
  });
  // Restore auto-save from previous session (if tab was hidden mid-game)
  var _autoKey = "cabinet_autosave_" + (window.EJS_gameID || "");
  var _autoTs = null;
  try { _autoTs = localStorage.getItem(_autoKey); } catch (_e) {}
  if (_autoTs) {
    try { localStorage.removeItem(_autoKey); } catch (_e) {}
    var _autoMins = Math.round((Date.now() - Number(_autoTs)) / 60000);
    var _autoLabel = _autoMins < 1 ? "just now" : _autoMins + " min ago";
    setTimeout(function () {
      cabinetToast("Resuming auto-save from " + _autoLabel + "…");
      if (window.EJS_emulator && typeof window.EJS_emulator.loadState === "function") {
        try { window.EJS_emulator.loadState(0); } catch (_e) {}
      }
    }, 2500);
  }
};
window.EJS_player = "#game";
window.EJS_core = ${JSON.stringify(core)};
window.CABINET_CORE = ${JSON.stringify(core)};
window.EJS_gameName = ${JSON.stringify(title)};
window.EJS_gameID = ${JSON.stringify(userId + "_" + gameId)};
window.CABINET_USER_ID = ${JSON.stringify(userId)};
window.CABINET_USER_NAME = ${JSON.stringify(userName)};
window.CABINET_PROFILE_ID = ${JSON.stringify(profileId)};
(function () {
  var name = window.CABINET_USER_NAME || "";
  var el = document.getElementById("cabinet-save-user");
  if (el) el.textContent = name || "you";
  var badge = document.getElementById("cabinet-user-badge");
  if (badge && name && name !== "default") { badge.textContent = name; badge.removeAttribute("hidden"); }
})();
${discs.length > 1
  ? `window.EJS_discs = ${JSON.stringify(discs.map((d) => ({ fileName: `../\${d.id}/file`, label: d.label })))};`
  : `window.EJS_gameUrl = "./file";`}
window.EJS_pathtodata = "../../emulatorjs/";
window.EJS_startOnLoaded = true;
window.EJS_AdUrl = "";
// Derive netplay WebSocket URL from current page location (works under HA Ingress too)
(function () {
  var proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  var _p = window.location.pathname;
  var _i = _p.indexOf("/api/roms/");
  var base = _i >= 0 ? _p.slice(0, _i) : "";
  window.EJS_netplayUrl = proto + "//" + window.location.host + base + "/api/netplay";
})();
${raUsername && raToken ? `window.EJS_retroachievements = { username: ${JSON.stringify(raUsername)}, apiKey: ${JSON.stringify(raToken)}, hardcore: false };` : "// RetroAchievements not configured"}
window.EJS_rewindEnabled = true;
window.EJS_rewindGranularity = 2;
window.EJS_fastForwardSpeed = 3;
window.EJS_controlScheme = ${JSON.stringify(core)};
${cheats.length > 0 ? `window.EJS_cheats = ${JSON.stringify(cheats.map(c => [c.description, c.code]))};` : "// No cheats saved for this game"}
window.EJS_defaultControls = ${JSON.stringify(buildEjsControls(core, controlDefaults, gamepadBindings, controlDefaultsP2, gamepadBindingsP2))};
// ── Display options (per-system) ────────────────────────────────────────────
window.CABINET_RUMBLE = ${JSON.stringify(gamepadRumble)};
window.EJS_defaultOptions = {
  "save-state-location": "browser",
  "save-state-slot": 1
};
(function () {
  var sysId = ${JSON.stringify(core)};
  var opts = ${JSON.stringify(systemDisplay)};
  var sysOpts = opts[sysId] || {};
  
  // Use per-system shader or fallback to global shader
  var shader = sysOpts.shader || ${JSON.stringify(bootstrapSettings.globalShader || "none")};
  if (shader && shader !== "none") {
    window.EJS_defaultOptions["shader"] = shader;
  }
  
  // Ensure aspect ratio fallbacks to global
  if (!sysOpts.aspectRatio && ${JSON.stringify(bootstrapSettings.globalAspectRatio)} !== "auto") {
    sysOpts.aspectRatio = ${JSON.stringify(bootstrapSettings.globalAspectRatio)};
  }
  
  window.CABINET_DISPLAY_OPTS = sysOpts;
})();
window.EJS_Buttons = {
  playPause: true,
  restart: true,
  mute: true,
  settings: true,
  fullscreen: true,
  saveState: true,
  loadState: true,
  screenRecord: false,
  gamepad: true,
  cheat: true,
  volume: true,
  saveSavFiles: true,
  loadSavFiles: true,
  quickSave: true,
  quickLoad: true,
  screenshot: true,
  cacheManager: true,
  exitEmulation: true
};
var loader = document.createElement("script");
loader.src = "../../emulatorjs/loader.js";
loader.onload = function () {
  cabinetSetLaunchProgress(42, "Emulator loader downloaded…", "Loader");
};
loader.onerror = function () {
  cabinetFailLaunchProgress("Emulator loader blocked. Try the standalone player or local Home Assistant add-on.");
  var game = document.querySelector("#game");
  if (game) game.innerHTML = '<div class="loading"><div>Emulator loader blocked</div><div class="hint">The preview frame could not load EmulatorJS from the CDN. The Home Assistant local add-on will avoid this by serving the emulator locally.</div></div>';
};
document.body.appendChild(loader);
`;
}
