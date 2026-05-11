/**
 * Cabinet Bridge — integration tests for the Express API routes.
 *
 * Run with:  npx vitest run  (or add "test": "vitest run" to package.json)
 *
 * These tests create an in-process Express app backed by an in-memory SQLite
 * database so no real data files are created or modified.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";

// ── Minimal in-memory server fixture ─────────────────────────────────────────
// We spin up the real registerRoutes() but override CABINET_DATA_DIR to a
// temp directory so tests don't read/write real data.

process.env.CABINET_DATA_DIR = "/tmp/cabinet-test-" + Date.now();
process.env.NODE_ENV = "test";

import { registerRoutes } from "../routes";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  server = httpServer;
  const addr = httpServer.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
}, 15_000);

afterAll(() => {
  server?.close();
});

// ── Helper ────────────────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/roms", () => {
  it("returns an empty array initially", async () => {
    const { status, body } = await api("GET", "/api/roms");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});

describe("GET /api/collections", () => {
  it("returns an empty array initially", async () => {
    const { status, body } = await api("GET", "/api/collections");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

describe("POST /api/collections", () => {
  it("creates a collection", async () => {
    const { status, body } = await api("POST", "/api/collections", { name: "Test Collection" });
    expect(status).toBe(201);
    expect(body.name).toBe("Test Collection");
    expect(typeof body.id).toBe("number");
  });

  it("rejects empty name", async () => {
    const { status } = await api("POST", "/api/collections", { name: "" });
    expect(status).toBe(400);
  });
});

describe("GET /api/roms/:id — not found", () => {
  it("returns 404 for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999");
    expect(status).toBe(404);
  });
});

describe("GET /api/roms/:id/save-states", () => {
  it("returns 404 for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999/save-states");
    expect(status).toBe(404);
  });
});

describe("GET /api/roms/:id/save-backups", () => {
  it("returns 404 for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999/save-backups");
    expect(status).toBe(404);
  });
});

describe("GET /api/kiosk", () => {
  it("returns kiosk config", async () => {
    const { status, body } = await api("GET", "/api/kiosk");
    expect(status).toBe(200);
    expect(typeof body.enabled).toBe("boolean");
  });
});

describe("GET /api/settings/integration", () => {
  it("returns default settings", async () => {
    const { status, body } = await api("GET", "/api/settings/integration");
    expect(status).toBe(200);
    expect(typeof body.haBaseUrl).toBe("string");
    expect(typeof body.liveMode).toBe("boolean");
  });

  it("returns gamepadRumble: true by default", async () => {
    const { status, body } = await api("GET", "/api/settings/integration");
    expect(status).toBe(200);
    expect(body.gamepadRumble).toBe(true);
  });

  it("returns systemDisplay as an object by default", async () => {
    const { status, body } = await api("GET", "/api/settings/integration");
    expect(status).toBe(200);
    expect(body.systemDisplay).toBeDefined();
    expect(typeof body.systemDisplay).toBe("object");
  });
});

describe("PUT /api/settings/integration", () => {
  it("persists settings", async () => {
    const { status, body } = await api("PUT", "/api/settings/integration", {
      haBaseUrl: "https://ha.example.com",
      haToken: "",
      liveMode: true,
      endpoints: {},
      ssUserId: "",
      ssPassword: "",
      kioskMode: false,
      kioskPin: "",
      kioskCollectionId: null,
      raUsername: "testuser",
      raToken: "",
    });
    expect(status).toBe(200);
    expect(body.haBaseUrl).toBe("https://ha.example.com");
    expect(body.raUsername).toBe("testuser");

    // Re-fetch to confirm persistence
    const get = await api("GET", "/api/settings/integration");
    expect(get.body.haBaseUrl).toBe("https://ha.example.com");
  });

  it("persists gamepadRumble: false and re-reads it back", async () => {
    const { status, body } = await api("PUT", "/api/settings/integration", {
      gamepadRumble: false,
    });
    expect(status).toBe(200);
    expect(body.gamepadRumble).toBe(false);

    const get = await api("GET", "/api/settings/integration");
    expect(get.body.gamepadRumble).toBe(false);
  });

  it("persists systemDisplay per-system options", async () => {
    const { status, body } = await api("PUT", "/api/settings/integration", {
      systemDisplay: {
        snes: { aspectRatio: "8/7", integerScale: true, shader: "crt" },
        gba:  { aspectRatio: "3/2", integerScale: false },
      },
    });
    expect(status).toBe(200);
    expect(body.systemDisplay?.snes?.aspectRatio).toBe("8/7");
    expect(body.systemDisplay?.snes?.integerScale).toBe(true);
    expect(body.systemDisplay?.snes?.shader).toBe("crt");
    expect(body.systemDisplay?.gba?.aspectRatio).toBe("3/2");

    const get = await api("GET", "/api/settings/integration");
    expect(get.body.systemDisplay?.snes?.aspectRatio).toBe("8/7");
    expect(get.body.systemDisplay?.gba?.integerScale).toBe(false);
  });

  it("restores gamepadRumble to true for subsequent tests", async () => {
    const { status } = await api("PUT", "/api/settings/integration", { gamepadRumble: true });
    expect(status).toBe(200);
  });
});

describe("POST /api/import/emulationstation", () => {
  it("handles empty gamelist gracefully", async () => {
    const xml = '<?xml version="1.0"?><gameList></gameList>';
    const res = await fetch(`${baseUrl}/api/import/emulationstation`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xml,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.imported).toBe(0);
    expect(body.skipped).toBe(0);
  });
});

describe("POST /api/import/launchbox", () => {
  it("handles empty LaunchBox XML gracefully", async () => {
    const xml = '<?xml version="1.0"?><LaunchBox></LaunchBox>';
    const res = await fetch(`${baseUrl}/api/import/launchbox`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xml,
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.imported).toBe(0);
  });
});

describe("GET /api/system-images", () => {
  it("lists all system images", async () => {
    const { status, body } = await api("GET", "/api/system-images");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(5);
    const ids = body.map((s: { id: string }) => s.id);
    expect(ids).toContain("nes");
    expect(ids).toContain("ps1");
    expect(ids).toContain("gb");
    expect(ids).toContain("psp");
    expect(ids).toContain("nds");
  });
});

describe("GET /api/upload-limits", () => {
  it("returns max upload size", async () => {
    const { status, body } = await api("GET", "/api/upload-limits");
    expect(status).toBe(200);
    expect(typeof body.maxUploadMb).toBe("number");
    expect(body.maxUploadMb).toBeGreaterThan(0);
  });
});

// ── Profiles ──────────────────────────────────────────────────────────────────

describe("GET /api/profiles", () => {
  it("returns at least the default profile", async () => {
    const { status, body } = await api("GET", "/api/profiles");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].id).toBe(1);
  });
});

describe("POST /api/profiles", () => {
  it("creates a named profile", async () => {
    const { status, body } = await api("POST", "/api/profiles", { name: "Alice", color: "#ff0000" });
    expect(status).toBe(201);
    expect(body.name).toBe("Alice");
    expect(typeof body.id).toBe("number");
  });

  it("rejects missing name", async () => {
    const { status } = await api("POST", "/api/profiles", { color: "#00ff00" });
    expect(status).toBe(400);
  });
});

// ── P1 / P2 control bindings (?port param) ────────────────────────────────────
//
// Port=0 stores bindings under the plain core key ("snes").
// Port=1 stores bindings under the suffixed key ("snes_p2").
// The two slots are completely independent — writing one must not touch the other.

describe("Per-profile controls — P1 (port=0)", () => {
  // Use the default profile (id=1) throughout — always present.
  const profileId = 1;

  it("GET returns an empty object before any bindings are set", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/controls/snes?port=0`);
    expect(status).toBe(200);
    expect(typeof body).toBe("object");
  });

  it("PUT saves P1 bindings", async () => {
    const { status } = await api("PUT", `/api/profiles/${profileId}/controls/snes?port=0`, {
      0: "ArrowUp",
      1: "ArrowDown",
      2: "ArrowLeft",
      3: "ArrowRight",
    });
    expect(status).toBe(200);
  });

  it("GET returns the saved P1 bindings", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/controls/snes?port=0`);
    expect(status).toBe(200);
    expect(body[0]).toBe("ArrowUp");
    expect(body[1]).toBe("ArrowDown");
  });
});

describe("Per-profile controls — P2 (port=1)", () => {
  const profileId = 1;

  it("GET returns an empty object before P2 bindings are set", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/controls/snes?port=1`);
    expect(status).toBe(200);
    expect(typeof body).toBe("object");
    // P2 slot starts empty even though P1 has bindings
    expect(Object.keys(body).length).toBe(0);
  });

  it("PUT saves P2 bindings independently from P1", async () => {
    const { status } = await api("PUT", `/api/profiles/${profileId}/controls/snes?port=1`, {
      0: "KeyW",
      1: "KeyS",
      2: "KeyA",
      3: "KeyD",
    });
    expect(status).toBe(200);
  });

  it("GET returns the saved P2 bindings", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/controls/snes?port=1`);
    expect(status).toBe(200);
    expect(body[0]).toBe("KeyW");
    expect(body[1]).toBe("KeyS");
  });

  it("P1 bindings are unchanged after P2 was written", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/controls/snes?port=0`);
    expect(status).toBe(200);
    // P1 still has the values set in the P1 describe block
    expect(body[0]).toBe("ArrowUp");
  });

  it("DELETE with port=1 clears only P2 bindings", async () => {
    const { status } = await api("DELETE", `/api/profiles/${profileId}/controls/snes?port=1`);
    expect(status).toBe(200);

    const p2 = await api("GET", `/api/profiles/${profileId}/controls/snes?port=1`);
    expect(Object.keys(p2.body).length).toBe(0);

    // P1 must survive the P2 delete
    const p1 = await api("GET", `/api/profiles/${profileId}/controls/snes?port=0`);
    expect(p1.body[0]).toBe("ArrowUp");
  });
});

describe("Per-profile controls — port defaults to P1 when omitted", () => {
  const profileId = 1;

  it("GET without ?port reads the P1 slot", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/controls/snes`);
    expect(status).toBe(200);
    // Should match the P1 binding set above
    expect(body[0]).toBe("ArrowUp");
  });
});

// ── P1 / P2 gamepad bindings ──────────────────────────────────────────────────

describe("Gamepad bindings — P1 (port=0)", () => {
  const profileId = 1;

  it("GET returns an object before any bindings are set", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/gamepad-bindings/default?port=0`);
    expect(status).toBe(200);
    expect(typeof body).toBe("object");
  });

  it("PUT saves P1 gamepad bindings", async () => {
    const { status } = await api("PUT", `/api/profiles/${profileId}/gamepad-bindings/default?port=0`, {
      0: 0,
      1: 1,
      8: 8,
      9: 9,
    });
    expect(status).toBe(200);
  });

  it("GET returns the saved P1 gamepad bindings", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/gamepad-bindings/default?port=0`);
    expect(status).toBe(200);
    expect(body[0]).toBe(0);
    expect(body[1]).toBe(1);
  });
});

describe("Gamepad bindings — P2 (port=1)", () => {
  const profileId = 1;

  it("GET returns empty object before P2 gamepad bindings are set", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/gamepad-bindings/default?port=1`);
    expect(status).toBe(200);
    expect(typeof body).toBe("object");
    expect(Object.keys(body).length).toBe(0);
  });

  it("PUT saves P2 gamepad bindings under a separate slot", async () => {
    const { status } = await api("PUT", `/api/profiles/${profileId}/gamepad-bindings/default?port=1`, {
      0: 2,
      1: 3,
      8: 6,
      9: 7,
    });
    expect(status).toBe(200);
  });

  it("GET returns the saved P2 gamepad bindings", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/gamepad-bindings/default?port=1`);
    expect(status).toBe(200);
    expect(body[0]).toBe(2);
    expect(body[1]).toBe(3);
  });

  it("P1 gamepad bindings are unchanged after P2 was written", async () => {
    const { status, body } = await api("GET", `/api/profiles/${profileId}/gamepad-bindings/default?port=0`);
    expect(status).toBe(200);
    expect(body[0]).toBe(0);
    expect(body[1]).toBe(1);
  });
});

// ── Schema validation ─────────────────────────────────────────────────────────

describe("Integration settings schema validation", () => {
  it("rejects systemDisplay with an aspectRatio string over 16 chars", async () => {
    const { status } = await api("PUT", "/api/settings/integration", {
      systemDisplay: {
        snes: { aspectRatio: "99999999999999999/1" }, // 19 chars — over limit
      },
    });
    expect(status).toBe(400);
  });

  it("rejects systemDisplay with a shader string over 64 chars", async () => {
    const { status } = await api("PUT", "/api/settings/integration", {
      systemDisplay: {
        nes: { shader: "a".repeat(65) },
      },
    });
    expect(status).toBe(400);
  });

  it("accepts systemDisplay with all optional sub-fields omitted", async () => {
    const { status, body } = await api("PUT", "/api/settings/integration", {
      systemDisplay: { gb: {} },
    });
    expect(status).toBe(200);
    expect(body.systemDisplay?.gb).toBeDefined();
  });
});
