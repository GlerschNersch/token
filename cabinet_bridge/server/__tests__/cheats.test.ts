import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

// ── Setup Test Environment ───────────────────────────────────────────────────

const TEST_DATA_DIR = "/tmp/cabinet-test-cheats-" + Date.now();
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

describe("Cheat Routes", () => {
  it("GET /api/roms/:id/cheats returns 200 (empty array) for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999/cheats");
    expect(status).toBe(200);
  });

  it("GET /api/roms/:id/fetch-cheats returns 404 for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999/fetch-cheats");
    expect(status).toBe(404);
  });
});
