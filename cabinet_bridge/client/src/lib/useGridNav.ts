import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Keyboard + gamepad navigation for a CSS-grid of game cards.
 *
 * Controls
 * ─────────────────────────────────────────────────────────────
 * Arrow keys   – move focus through the grid
 * Enter / A    – open the focused card (onActivate)
 * F / Y        – toggle favourite (onFav)
 * Gamepad      – D-pad or left stick for movement, A=open, Y=fav
 *
 * Returns { focusedIndex } — pass as a prop to each card.
 * focusedIndex is -1 when navigation is inactive (no key pressed yet).
 */
export function useGridNav({
  count,
  gridRef,
  onActivate,
  onFav,
  disabled = false,
}: {
  count: number;
  gridRef: React.RefObject<HTMLElement | null>;
  onActivate: (index: number) => void;
  onFav: (index: number) => void;
  disabled?: boolean;
}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Keep refs so RAF callbacks always see latest values without re-creating
  const focusedRef = useRef(focusedIndex);
  const countRef = useRef(count);
  const disabledRef = useRef(disabled);
  focusedRef.current = focusedIndex;
  countRef.current = count;
  disabledRef.current = disabled;

  // Reset focus when games list changes length (new filter, search, etc.)
  useEffect(() => {
    setFocusedIndex(-1);
  }, [count]);

  // ── Column count ────────────────────────────────────────────────────────────
  const getColumns = useCallback(() => {
    if (!gridRef.current) return 1;
    const cols = getComputedStyle(gridRef.current)
      .gridTemplateColumns.trim()
      .split(/\s+/).length;
    return Math.max(1, cols);
  }, [gridRef]);

  // ── Scroll focused card into view ───────────────────────────────────────────
  const scrollIntoView = useCallback(
    (idx: number) => {
      const child = gridRef.current?.children[idx] as HTMLElement | undefined;
      child?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [gridRef],
  );

  // ── Move helper (shared by keyboard + gamepad) ──────────────────────────────
  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (disabledRef.current || countRef.current === 0) return;
      const cols = getColumns();
      const cur = focusedRef.current < 0 ? -1 : focusedRef.current;
      let next: number;

      if (cur < 0) {
        // First interaction — jump to first card
        next = dir === "up" || dir === "left" ? countRef.current - 1 : 0;
      } else {
        switch (dir) {
          case "right": next = Math.min(countRef.current - 1, cur + 1); break;
          case "left":  next = Math.max(0, cur - 1); break;
          case "down":  next = Math.min(countRef.current - 1, cur + cols); break;
          case "up":    next = Math.max(0, cur - cols); break;
        }
      }

      setFocusedIndex(next);
      scrollIntoView(next);
    },
    [getColumns, scrollIntoView],
  );

  // ── Keyboard handler ────────────────────────────────────────────────────────
  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't steal keys while an input/textarea is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "ArrowRight": e.preventDefault(); move("right"); break;
        case "ArrowLeft":  e.preventDefault(); move("left");  break;
        case "ArrowDown":  e.preventDefault(); move("down");  break;
        case "ArrowUp":    e.preventDefault(); move("up");    break;
        case "Enter":
          if (focusedRef.current >= 0) { e.preventDefault(); onActivate(focusedRef.current); }
          break;
        case "f":
        case "F":
          if (focusedRef.current >= 0) { e.preventDefault(); onFav(focusedRef.current); }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, move, onActivate, onFav]);

  // ── Gamepad polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    const DEAD_ZONE = 0.4;
    const REPEAT_DELAY = 450;   // ms before auto-repeat starts
    const REPEAT_RATE  = 130;   // ms between repeats

    let rafId = 0;
    let heldDir: "up" | "down" | "left" | "right" | null = null;
    let holdStart = 0;
    let lastRepeat = 0;
    let prevA = false;
    let prevY = false;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (disabledRef.current) return;

      const gp = navigator.getGamepads?.().find((g) => g !== null);
      if (!gp) return;

      const up    = gp.buttons[12]?.pressed || gp.axes[1] < -DEAD_ZONE;
      const down  = gp.buttons[13]?.pressed || gp.axes[1] >  DEAD_ZONE;
      const left  = gp.buttons[14]?.pressed || gp.axes[0] < -DEAD_ZONE;
      const right = gp.buttons[15]?.pressed || gp.axes[0] >  DEAD_ZONE;
      const dir: typeof heldDir = up ? "up" : down ? "down" : left ? "left" : right ? "right" : null;

      if (dir !== heldDir) {
        heldDir = dir;
        holdStart = now;
        lastRepeat = 0;
        if (dir) move(dir);
      } else if (dir) {
        const elapsed = now - holdStart;
        if (elapsed > REPEAT_DELAY && now - lastRepeat > REPEAT_RATE) {
          lastRepeat = now;
          move(dir);
        }
      }

      // A button (index 0) → open
      const curA = gp.buttons[0]?.pressed ?? false;
      if (curA && !prevA && focusedRef.current >= 0) onActivate(focusedRef.current);
      prevA = curA;

      // Y button (index 3) → favourite
      const curY = gp.buttons[3]?.pressed ?? false;
      if (curY && !prevY && focusedRef.current >= 0) onFav(focusedRef.current);
      prevY = curY;
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [move, onActivate, onFav]);

  return { focusedIndex, setFocusedIndex };
}
