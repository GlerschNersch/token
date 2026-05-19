import React, { useState, useEffect } from "react";
import type { ButtonState } from "./GamepadRemap";
import { detectControllerType, getButtonLayout } from "./GamepadRemap";

interface MappingEntry {
  kind: "button" | "axis";
  buttonIndex?: number;
  axisIndex?: number;
  direction?: -1 | 1;
}

interface Props {
  activeButtons: ButtonState[];
  mapping: Record<string, MappingEntry | undefined>;
  listeningAction: string | null;
  listenedBtn: number | null;
  lastPressedLabel: string;
  onRemapAction: (actionId: string) => void;
  onDone: () => void;
  actions: { id: string; label: string; isAxis?: boolean }[];
  gamepadId?: string;
}

export function ControllerRemapDialog({
  activeButtons,
  mapping,
  listeningAction,
  listenedBtn,
  lastPressedLabel,
  onRemapAction,
  onDone,
  actions,
  gamepadId = "",
}: Props) {
  const [axes, setAxes] = useState<Record<number, number>>({});
  const controllerType = detectControllerType(gamepadId);
  const buttons = getButtonLayout(controllerType);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const gps = navigator.getGamepads?.();
      const vals: Record<number, number> = {};
      for (const gp of gps ?? []) {
        if (!gp) continue;
        for (let i = 0; i < gp.axes.length; i++) vals[i] = gp.axes[i];
        break;
      }
      setAxes(vals);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  function getBtnState(idx: number): "active" | "mapped" | "listening" | "idle" {
    if (activeButtons.some(b => b.index === idx)) return "active";
    if (listeningAction !== null && listenedBtn === idx) return "listening";
    if (Object.values(mapping).some(m => m?.kind === "button" && m.buttonIndex === idx)) return "mapped";
    return "idle";
  }

  function getAxisState(axisIdx: number, dir: -1 | 1): "active" | "mapped" | "listening" | "idle" {
    const encoded = axisIdx * 2 + (dir > 0 ? 1 : 0);
    if (listeningAction !== null && listenedBtn === encoded) return "listening";
    if (Object.values(mapping).some(m => m?.kind === "axis" && m.axisIndex === axisIdx && m.direction === dir)) return "mapped";
    return "idle";
  }

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  function entryLabel(entry: MappingEntry | undefined): string {
    if (!entry) return "Not set";
    if (entry.kind === "button") {
      const btn = buttons.find(b => b.index === entry.buttonIndex);
      return btn ? btn.displayName : `BTN ${entry.buttonIndex}`;
    }
    if (entry.kind === "axis") {
      const AXIS_NAMES: Record<number, string> = {
        0: "L Stick ←→", 1: "L Stick ↑↓",
        2: "R Stick ←→", 3: "R Stick ↑↓",
      };
      return `${AXIS_NAMES[entry.axisIndex ?? 0] ?? `A${entry.axisIndex}`}${entry.direction === -1 ? "-" : "+"}`;
    }
    return "Unknown";
  }

  function renderFaceButton(btn: typeof buttons[0], label: string) {
    const state = getBtnState(btn.index);
    const isActive = state === "active";
    const isListening = state === "listening";
    const isMapped = state === "mapped";
    return (
      <g key={btn.index}>
        <circle
          cx={btn.svgX} cy={btn.svgY} r={isListening ? 26 : 22}
          fill={isActive ? "#b05dfc" : isListening ? "#7c3aed" : isMapped ? "#2a2a2a" : "#1e1e1e"}
          stroke={isListening ? "#b05dfc" : isMapped ? "#444" : "#333"}
          strokeWidth={isListening ? 3 : 2}
          filter={isActive || isListening ? "url(#glow)" : undefined}
          className="transition-all duration-150"
        />
        <text
          x={btn.svgX} y={btn.svgY + 5}
          textAnchor="middle"
          fill={isActive || isListening ? "#fff" : "#888"}
          fontSize={isListening ? "15" : "13"}
          fontFamily="sans-serif"
          fontWeight="bold"
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status bar */}
      {listeningAction ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/10">
          <div className="size-3 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium">
            Press any button on your controller to assign it to{" "}
            <strong className="text-primary">{actions.find(a => a.id === listeningAction)?.label}</strong>
          </span>
          {lastPressedLabel && (
            <span className="ml-auto font-display text-xl font-black text-primary">{lastPressedLabel}</span>
          )}
          <button onClick={onDone} className="ml-4 px-3 py-1 rounded-lg border border-white/20 text-xs font-medium hover:bg-white/10 transition-colors">
            Cancel
          </button>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {mappedCount}/{actions.length} mapped — click an action to rebind. Controller type: <span className="font-semibold capitalize">{controllerType}</span>
        </div>
      )}

      {/* SVG Controller Diagram */}
      <div className="relative mx-auto" style={{ width: 520, height: 420 }}>
        <svg viewBox="0 0 520 420" className="w-full h-full drop-shadow-2xl" aria-label="Gamepad diagram">
          <defs>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2a2a" /><stop offset="50%" stopColor="#1a1a1a" /><stop offset="100%" stopColor="#141414" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="5" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Body */}
          <rect x="20" y="30" width="480" height="320" rx="80" ry="80" fill="#1a1a1a" stroke="#2e2e2e" strokeWidth="3" />
          <rect x="20" y="30" width="480" height="320" rx="80" ry="80" fill="url(#bodyGrad)" />

          {/* Grips */}
          <ellipse cx="100" cy="310" rx="50" ry="65" fill="#141414" />
          <ellipse cx="100" cy="310" rx="40" ry="55" fill="#1e1e1e" stroke="#252525" strokeWidth="2" />
          <ellipse cx="420" cy="310" rx="50" ry="65" fill="#141414" />
          <ellipse cx="420" cy="310" rx="40" ry="55" fill="#1e1e1e" stroke="#252525" strokeWidth="2" />

          {/* Left stick */}
          <circle cx="155" cy="190" r="42" fill="#111" stroke="#2a2a2a" strokeWidth="2" />
          <circle
            cx="155" cy="190" r="28"
            fill={getBtnState(8) === "active" || getBtnState(8) === "listening" ? "#b05dfc" : "#1e1e1e"}
            stroke={getBtnState(8) === "listening" ? "#b05dfc" : "#333"}
            strokeWidth={getBtnState(8) === "listening" ? 3 : 2}
            filter={getBtnState(8) === "active" || getBtnState(8) === "listening" ? "url(#glow)" : undefined}
          />
          <text x="155" y="194" textAnchor="middle" fill="#555" fontSize="11" fontFamily="sans-serif">L3</text>

          {/* Right stick */}
          <circle cx="365" cy="190" r="42" fill="#111" stroke="#2a2a2a" strokeWidth="2" />
          <circle
            cx="365" cy="190" r="28"
            fill={getBtnState(9) === "active" || getBtnState(9) === "listening" ? "#b05dfc" : "#1e1e1e"}
            stroke={getBtnState(9) === "listening" ? "#b05dfc" : "#333"}
            strokeWidth={getBtnState(9) === "listening" ? 3 : 2}
            filter={getBtnState(9) === "active" || getBtnState(9) === "listening" ? "url(#glow)" : undefined}
          />
          <text x="365" y="194" textAnchor="middle" fill="#555" fontSize="11" fontFamily="sans-serif">R3</text>

          {/* D-pad */}
          {[
            { idx: 10, dx: 65, dy: 170, arrow: "↑" },
            { idx: 11, dx: 65, dy: 230, arrow: "↓" },
            { idx: 12, dx: 35, dy: 200, arrow: "←" },
            { idx: 13, dx: 95, dy: 200, arrow: "→" },
          ].map(({ idx, dx, dy, arrow }) => {
            const state = getBtnState(idx);
            const isActive = state === "active";
            const isListening = state === "listening";
            return (
              <g key={idx}>
                <rect x={dx} y={dy} width="30" height="30" rx="4"
                  fill={isActive || isListening ? "#b05dfc" : "#1c1c1c"}
                  stroke={isListening ? "#b05dfc" : "#2e2e2e"}
                  strokeWidth={isListening ? 2 : 1}
                  filter={isActive || isListening ? "url(#glow)" : undefined}
                />
                <text x={dx + 15} y={dy + 20} textAnchor="middle" fill="#555" fontSize="14" fontFamily="sans-serif">{arrow}</text>
              </g>
            );
          })}

          {/* Center buttons */}
          {[
            { idx: 7, cx: 220, cy: 220, label: "≡" },
            { idx: 6, cx: 300, cy: 220, label: "☰" },
          ].map(({ idx, cx, cy, label }) => {
            const state = getBtnState(idx);
            const isActive = state === "active";
            const isListening = state === "listening";
            return (
              <g key={idx}>
                <circle cx={cx} cy={cy} r="14"
                  fill={isActive || isListening ? "#b05dfc" : "#1c1c1c"}
                  stroke={isListening ? "#b05dfc" : "#2e2e2e"}
                  strokeWidth={isListening ? 2 : 1}
                  filter={isActive || isListening ? "url(#glow)" : undefined}
                />
                <text x={cx} y={cy + 4} textAnchor="middle" fill="#555" fontSize="8" fontFamily="sans-serif">{label}</text>
              </g>
            );
          })}

          {/* Face buttons — uses controller-type-aware labels */}
          {buttons.slice(0, 4).map(btn => renderFaceButton(btn, btn.displayName))}

          {/* Shoulder buttons */}
          {[
            { idx: 4, x: 30, y: 60, w: 90, label: controllerType === "playstation" ? "L1" : "LB" },
            { idx: 5, x: 400, y: 60, w: 90, label: controllerType === "playstation" ? "R1" : "RB" },
          ].map(({ idx, x, y, w, label }) => {
            const state = getBtnState(idx);
            const isActive = state === "active";
            const isListening = state === "listening";
            return (
              <g key={idx}>
                <rect x={x} y={y} width={w} height="30" rx="10"
                  fill={isActive || isListening ? "#b05dfc" : "#1c1c1c"}
                  stroke={isListening ? "#b05dfc" : "#2e2e2e"}
                  strokeWidth={isListening ? 2 : 1}
                  filter={isActive || isListening ? "url(#glow)" : undefined}
                />
                <text x={x + w / 2} y={y + 20} textAnchor="middle"
                  fill={isActive || isListening ? "#fff" : "#555"} fontSize="11" fontFamily="sans-serif">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Live axis indicators */}
          {axes[0] !== undefined && (
            <text x="155" y="380" textAnchor="middle" fill="#444" fontSize="10" fontFamily="monospace">
              {axes[0] > 0.5 ? "→" : axes[0] < -0.5 ? "←" : "·"}
            </text>
          )}
          {axes[1] !== undefined && (
            <text x="180" y="365" textAnchor="middle" fill="#444" fontSize="10" fontFamily="monospace">
              {axes[1] > 0.5 ? "↓" : axes[1] < -0.5 ? "↑" : "·"}
            </text>
          )}
          {axes[2] !== undefined && (
            <text x="365" y="380" textAnchor="middle" fill="#444" fontSize="10" fontFamily="monospace">
              {axes[2] > 0.5 ? "→" : axes[2] < -0.5 ? "←" : "·"}
            </text>
          )}
          {axes[3] !== undefined && (
            <text x="390" y="365" textAnchor="middle" fill="#444" fontSize="10" fontFamily="monospace">
              {axes[3] > 0.5 ? "↓" : axes[3] < -0.5 ? "↑" : "·"}
            </text>
          )}

          {/* Axis binding hotspots */}
          {listeningAction && (() => {
            const HOTSPOTS = [
              { axisIdx: 0, dir: -1 as -1, label: "L←", x: 20, y: 150, w: 50, h: 36 },
              { axisIdx: 0, dir:  1 as -1, label: "L→", x: 70, y: 150, w: 50, h: 36 },
              { axisIdx: 1, dir: -1 as -1, label: "L↑", x: 20, y: 110, w: 50, h: 36 },
              { axisIdx: 1, dir:  1 as -1, label: "L↓", x: 20, y: 186, w: 50, h: 36 },
              { axisIdx: 2, dir: -1 as -1, label: "R←", x: 360, y: 150, w: 50, h: 36 },
              { axisIdx: 2, dir:  1 as -1, label: "R→", x: 410, y: 150, w: 50, h: 36 },
              { axisIdx: 3, dir: -1 as -1, label: "R↑", x: 360, y: 110, w: 50, h: 36 },
              { axisIdx: 3, dir:  1 as -1, label: "R↓", x: 360, y: 186, w: 50, h: 36 },
            ];
            return HOTSPOTS.map(h => {
              const state = getAxisState(h.axisIdx, h.dir);
              const isActive = state === "active";
              const isListening = state === "listening";
              const isMapped = state === "mapped";
              return (
                <g key={`ax-${h.axisIdx}-${h.dir}`}>
                  <rect x={h.x} y={h.y} width={h.w} height={h.h} rx="6"
                    fill={isActive ? "#b05dfc" : isListening ? "#7c3aed" : isMapped ? "#2a2a2a" : "#111"}
                    stroke={isListening ? "#b05dfc" : isMapped ? "#444" : "#2a2a2a"}
                    strokeWidth={isListening ? 2 : 1}
                    filter={isActive || isListening ? "url(#glow)" : undefined}
                    className="cursor-pointer"
                    onClick={() => {
                      // Commit this axis direction immediately
                      const entry: MappingEntry = { kind: "axis", axisIndex: h.axisIdx, direction: h.dir };
                      const currentAction = listeningAction;
                      if (currentAction) {
                        const updated = { ...(mapping || {}), [currentAction]: entry };
                        onRemapAction(currentAction);
                      }
                    }}
                  />
                  <text x={h.x + h.w / 2} y={h.y + h.h / 2 + 4} textAnchor="middle"
                    fill={isActive || isListening ? "#fff" : "#555"} fontSize="9" fontFamily="monospace">
                    {h.label}
                  </text>
                </g>
              );
            });
          })()}

          {/* Trigger labels */}
          <text x="75" y="52" textAnchor="middle" fill="#333" fontSize="9" fontFamily="monospace">
            {controllerType === "playstation" ? "L2" : "LT"}
          </text>
          <text x="445" y="52" textAnchor="middle" fill="#333" fontSize="9" fontFamily="monospace">
            {controllerType === "playstation" ? "R2" : "RT"}
          </text>
        </svg>
      </div>

      {/* Action list */}
      <div className="grid gap-3">
        {actions.map(action => {
          const entry = mapping[action.id];
          const isListening = listeningAction === action.id;
          return (
            <div key={action.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              isListening ? "border-primary bg-primary/10"
              : entry ? "border-border bg-sidebar/20"
              : "border-border/50 bg-sidebar/10 opacity-60"
            }`}>
              <div className="space-y-0.5">
                <div className="text-sm font-semibold">{action.label}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{entryLabel(entry)}</div>
              </div>
              <div className="flex items-center gap-3">
                {entry && !isListening && (
                  <div className="size-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
                    <span className="text-primary font-black text-xs">
                      {entry.kind === "button"
                        ? (buttons.find(b => b.index === entry.buttonIndex)?.displayName ?? "?")
                        : `A${entry.axisIndex}`}
                    </span>
                  </div>
                )}
                {isListening && listenedBtn !== null && (
                  <div className="size-8 rounded-full bg-primary flex items-center justify-center animate-pulse">
                    <span className="text-primary-foreground font-black text-sm">{lastPressedLabel}</span>
                  </div>
                )}
                <button onClick={() => onRemapAction(action.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    isListening ? "bg-primary text-primary-foreground"
                    : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  }`}>
                  {isListening ? "Waiting..." : entry ? "Remap" : "Assign"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}