import { useState, useEffect, useCallback } from "react";

export type ActionId = "select" | "back" | "favorite" | "menu";

export type MappingEntry =
  | { kind: "button"; buttonIndex: number }
  | { kind: "axis"; axisIndex: number; direction: -1 | 1 };

export type ActionMapping = Record<string, MappingEntry | undefined>;

export interface ButtonState {
  index: number;
  label: string;
  pressed: boolean;
}

export interface GamepadButtonInfo {
  index: number;
  label: string;
  displayName: string;
  svgX: number;
  svgY: number;
}

export interface ControllerLayout {
  faceButtons: GamepadButtonInfo[];
  shoulderLabels: { left: string; right: string };
  stickLabels: { left: string; right: string };
  triggerLabels: { left: string; right: string };
}

const XBOX_LAYOUT: GamepadButtonInfo[] = [
  { index: 0,  label: "a_btn",       displayName: "A",     svgX: 370, svgY: 315 },
  { index: 1,  label: "b_btn",     displayName: "B",     svgX: 420, svgY: 270 },
  { index: 2,  label: "x_btn",     displayName: "X",     svgX: 320, svgY: 270 },
  { index: 3,  label: "y_btn",     displayName: "Y",     svgX: 370, svgY: 225 },
  { index: 4,  label: "l_btn",     displayName: "LB",    svgX: 70,  svgY: 75  },
  { index: 5,  label: "r_btn",     displayName: "RB",    svgX: 450, svgY: 75  },
  { index: 6,  label: "start_btn", displayName: "☰",     svgX: 300, svgY: 220 },
  { index: 7,  label: "select_btn",displayName: "≡",     svgX: 220, svgY: 220 },
  { index: 8,  label: "l3_btn",   displayName: "L3",    svgX: 155, svgY: 235 },
  { index: 9,  label: "r3_btn",   displayName: "R3",    svgX: 365, svgY: 235 },
  { index: 10, label: "dpad_up",   displayName: "↑",     svgX: 80,  svgY: 195 },
  { index: 11, label: "dpad_down", displayName: "↓",     svgX: 80,  svgY: 255 },
  { index: 12, label: "dpad_left", displayName: "←",     svgX: 50,  svgY: 225 },
  { index: 13, label: "dpad_right",displayName: "→",     svgX: 110, svgY: 225 },
];

const PS_LAYOUT: GamepadButtonInfo[] = [
  { index: 0,  label: "cross_btn",    displayName: "×",    svgX: 370, svgY: 315 },
  { index: 1,  label: "circle_btn",   displayName: "○",    svgX: 420, svgY: 270 },
  { index: 2,  label: "square_btn",   displayName: "□",    svgX: 320, svgY: 270 },
  { index: 3,  label: "triangle_btn", displayName: "△",    svgX: 370, svgY: 225 },
  { index: 4,  label: "l_btn",       displayName: "L1",   svgX: 70,  svgY: 75  },
  { index: 5,  label: "r_btn",       displayName: "R1",   svgX: 450, svgY: 75  },
  { index: 6,  label: "start_btn",   displayName: "☰",    svgX: 300, svgY: 220 },
  { index: 7,  label: "select_btn",  displayName: "≡",    svgX: 220, svgY: 220 },
  { index: 8,  label: "l3_btn",     displayName: "L3",   svgX: 155, svgY: 235 },
  { index: 9,  label: "r3_btn",     displayName: "R3",   svgX: 365, svgY: 235 },
  { index: 10, label: "dpad_up",    displayName: "↑",    svgX: 80,  svgY: 195 },
  { index: 11, label: "dpad_down",  displayName: "↓",    svgX: 80,  svgY: 255 },
  { index: 12, label: "dpad_left",  displayName: "←",    svgX: 50,  svgY: 225 },
  { index: 13, label: "dpad_right", displayName: "→",    svgX: 110, svgY: 225 },
];

const AXIS_LABELS: Record<number, string> = {
  0: "Left Stick ←→",
  1: "Left Stick ↑↓",
  2: "Right Stick ←→",
  3: "Right Stick ↑↓",
};

/** Detect controller type from Gamepad ID string */
export function detectControllerType(id: string): "xbox" | "playstation" | "generic" {
  const lower = id.toLowerCase();
  if (lower.includes("xbox") || lower.includes("360") || lower.includes("Xbox Wireless")) return "xbox";
  if (lower.includes("dualshock") || lower.includes("dualsense") || lower.includes("playstation")) return "playstation";
  return "generic";
}

/** Get the button list for the controller type */
export function getButtonLayout(type: "xbox" | "playstation" | "generic"): GamepadButtonInfo[] {
  return type === "playstation" ? PS_LAYOUT : XBOX_LAYOUT;
}

/** Get the label for an axis direction */
export function getAxisLabel(axisIndex: number, direction: -1 | 1, type: "xbox" | "playstation" | "generic"): string {
  const prefix = type === "playstation" ? "L" : "L";
  const stickLabels = axisIndex < 2 ? ["←", "→", "↑", "↓"] : ["←", "→", "↑", "↓"];
  return `${axisIndex % 2 === 0 ? prefix : "R"}${direction > 0 ? stickLabels[axisIndex % 2 + 2] : stickLabels[axisIndex % 2]}`;
}

/** Get all pressed button indices from a Gamepad */
export function getPressedButtons(gp: Gamepad): number[] {
  return gp.buttons.reduce<number[]>((acc, btn, i) => {
    if (btn.pressed) acc.push(i);
    return acc;
  }, []);
}

/** Find the primary (lowest index) pressed button from a Gamepad */
export function getPrimaryPressedButton(gp: Gamepad): number | null {
  for (let i = 0; i < gp.buttons.length; i++) {
    if (gp.buttons[i].pressed) return i;
  }
  return null;
}

export function useGamepadRemap() {
  const [listeningAction, setListeningAction] = useState<ActionId | null>(null);
  const [listenedBtn, setListenedBtn] = useState<number | null>(null);
  const [lastPressedLabel, setLastPressedLabel] = useState<string>("");

  const startListening = useCallback((action: ActionId) => {
    setListeningAction(action);
    setListenedBtn(null);
    setLastPressedLabel("");
  }, []);

  const stopListening = useCallback(() => {
    setListeningAction(null);
    setListenedBtn(null);
    setLastPressedLabel("");
  }, []);

  // Poll gamepads while listening
  useEffect(() => {
    if (!listeningAction) return;

    let rafId = 0;
    const DEAD_ZONE = 0.5;
    const tick = () => {
      const gps = navigator.getGamepads?.();
      for (const gp of gps ?? []) {
        if (!gp) continue;
        const btn = getPrimaryPressedButton(gp);
        if (btn !== null) {
          setListenedBtn(btn);
          const info = XBOX_LAYOUT.find(b => b.index === btn) ?? PS_LAYOUT.find(b => b.index === btn);
          setLastPressedLabel(info?.displayName ?? `BTN ${btn}`);
          break;
        }
        // Check axes
        const detectedType = detectControllerType(gp.id);
        for (let i = 0; i < gp.axes.length; i++) {
          const val = gp.axes[i];
          if (Math.abs(val) > DEAD_ZONE) {
            const direction: -1 | 1 = val > 0 ? 1 : -1;
            const encoded = i * 2 + (direction > 0 ? 1 : 0);
            setListenedBtn(encoded);
            const AXIS_DISPLAY: Record<number, Record<number, string>> = {
              0: { [-1]: "←", 1: "→" },
              1: { [-1]: "↑", 1: "↓" },
              2: { [-1]: "←", 1: "→" },
              3: { [-1]: "↑", 1: "↓" },
            };
            const stick = i < 2 ? "L" : "R";
            setLastPressedLabel(`${stick}${AXIS_DISPLAY[i]?.[direction] ?? direction > 0 ? "+" : "-"}`);
            break;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [listeningAction]);

  return {
    listeningAction,
    listenedBtn,
    lastPressedLabel,
    startListening,
    stopListening,
  };
}