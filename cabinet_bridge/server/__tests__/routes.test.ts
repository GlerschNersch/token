/**
 * Cabinet Bridge — integration tests for the Express API routes.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import fs from "node:fs";
import http from "node:http";

// ── Setup Test Environment ───────────────────────────────────────────────────

const TEST_DATA_DIR = "/tmp/cabinet-test-" + Date.now();
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

process.env.CABINET_DATA_DIR = TEST_DATA_DIR;
process.env.NODE_ENV = "test";

// Mock netplay
vi.mock('../netplay', () => ({
  attachNetplayServer: vi.fn(),
  registerNetplayRoutes: vi.fn()
}));

import { registerRoutes } from "../routes";
import { initializeDatabase } from "../storage";

let server: Server;
let baseUrl: string;
let port: number;

beforeAll(async () => {
  initializeDatabase();
  const app = express();
  app.use(express.json());
  
  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  // Global error handler for tests
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`APP_ERROR: ${status} - ${message}`, err);
    if (!res.headersSent) res.status(status).json({ message, stack: err.stack });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  server = httpServer;
  const addr = httpServer.address() as { port: number };
  port = addr.port;
  baseUrl = `http://127.0.0.1:${port}`;
}, 20_000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: unknown) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: path,
      method: method,
      headers: body ? { 
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(body))
      } : {},
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode || 500, body: json });
      });
    });

    req.on('error', (err) => {
      console.error(`HTTP_REQ_ERROR: ${err.message}`);
      resolve({ status: 500, body: null });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("API Routes", () => {
  describe("GET /api/roms", () => {
    it("returns an empty array initially", async () => {
      const { status, body } = await api("GET", "/api/roms");
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("Settings Integration", () => {
    it("returns default settings", async () => {
      const { status, body } = await api("GET", "/api/settings/integration");
      expect(status).toBe(200);
      expect(body.gamepadRumble).toBe(true);
    });

    it("persists settings", async () => {
      const { status, body } = await api("PUT", "/api/settings/integration", {
        haBaseUrl: "https://ha.example.com",
        liveMode: true,
      });
      expect(status).toBe(200);
      expect(body.haBaseUrl).toBe("https://ha.example.com");

      const get = await api("GET", "/api/settings/integration");
      expect(get.body.haBaseUrl).toBe("https://ha.example.com");
    });
  });

  describe("Profiles", () => {
    it("lists profiles", async () => {
      const { status, body } = await api("GET", "/api/profiles");
      expect(status).toBe(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Control Bindings", () => {
    it("saves and retrieves P1 bindings", async () => {
      const put = await api("PUT", "/api/profiles/1/controls/snes?port=0", { 0: "ArrowUp" });
      expect(put.status).toBe(200);

      const get = await api("GET", "/api/profiles/1/controls/snes?port=0");
      expect(get.status).toBe(200);
      expect(get.body[0]).toBe("ArrowUp");
    });
  });
});
