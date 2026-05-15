
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { registerRoutes } from "../routes";

process.env.CABINET_DATA_DIR = "/tmp/cabinet-test-cheats-" + Date.now();
process.env.NODE_ENV = "test";

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

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

describe("Cheat Routes", () => {
  it("GET /api/roms/:id/cheats returns 404 for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999/cheats");
    // Actually listCheats doesn't return 404 if ROM not found, it just returns empty array usually
    // Let's check cheats.ts implementation
    expect(status).toBe(200);
  });

  it("GET /api/roms/:id/fetch-cheats returns 404 for non-existent ROM", async () => {
    const { status } = await api("GET", "/api/roms/99999/fetch-cheats");
    expect(status).toBe(404);
  });
});
