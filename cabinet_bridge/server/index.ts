import "dotenv/config";
import compression from "compression";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initializeDatabase } from "./storage";
import { registerRoutes } from "./routes/index";
import { attachNetplayServer } from "./netplay";
import { serveStatic } from "./static";
import { setupVite } from "./vite";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();
const httpServer = createServer(app);

app.use(compression({
  filter: (req, res) => {
    if (req.path.endsWith("/scrape-all")) return false;
    return compression.filter(req, res);
  },
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Global security headers to ensure assets load correctly under HA Ingress
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  
  // Only apply strict isolation to the emulator player route
  // This allows the dashboard to load images without strict CORP checks
  const isPlayerRoute = req.path.includes("/player") || req.path.includes("/emulatorjs");
  if (isPlayerRoute) {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  }
  
  next();
});

// Strip HA ingress prefix so routes work under the ingress proxy
const INGRESS_PREFIX_RE = /^\/api\/(?:hassio_)?ingress\/[^/]+/;
app.use((req, _res, next) => {
  const match = req.url.match(INGRESS_PREFIX_RE);
  if (match) {
    const stripped = req.url.slice(match[0].length) || "/";
    req.url = stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const p = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined;
  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: unknown) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return originalResJson(bodyJson);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (p.startsWith("/api") && p !== "/api/health" && p !== "/api/debug") {
      let logLine = `${req.method} ${p} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });
  next();
});

// Health endpoint - responds immediately so HA ingress never times out
let appReady = false;
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: appReady ? "ok" : "starting" });
});

// Debug endpoint - dumps runtime environment info for troubleshooting
app.get("/api/debug", (_req: Request, res: Response) => {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const indexPath = path.resolve(distPath, "index.html");
  let entryScript: string | null = null;
  let assetList: string[] = [];
  if (fs.existsSync(indexPath)) {
    const content = readFileSync(indexPath, "utf-8");
    const scriptMatch = content.match(/src="([^"]+\.js)"/);
    entryScript = scriptMatch?.[1] ?? null;
    const allMatches = [...content.matchAll(/src="([^"]+)"/g)];
    assetList = allMatches.map((m) => m[1]);
  }
  res.json({
    version: process.env.npm_package_version ?? "unknown",
    nodeEnv: process.env.NODE_ENV,
    appReady,
    cwd: process.cwd(),
    distExists: fs.existsSync(distPath),
    indexExists: fs.existsSync(indexPath),
    entryScript,
    assetList,
  });
});

const port = parseInt(process.env.PORT ?? "5000", 10);

// Bind the port FIRST - HA ingress expects port 5000 to be open within seconds
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  log(`HomeArcade v${process.env.npm_package_version ?? "unknown"} listening on port ${port}`, "boot");
  initApp().catch((err) => {
    console.error("FATAL: startup failed:", err);
    process.exit(1);
  });
});

async function initApp() {
  log("Initializing database...", "boot");
  initializeDatabase();
  log("Database ready", "boot");

  await registerRoutes(httpServer, app);
  log("Routes registered", "boot");

  attachNetplayServer(httpServer);

  // Error handler must be registered after all routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[error] ${status} ${message}\n${err.stack ?? ""}`);
    if (!res.headersSent) res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(process.cwd(), "dist", "public");
    if (!fs.existsSync(distPath)) {
      log(`WARNING: dist/public not found at ${distPath} - UI will not be served`, "boot");
    } else {
      serveStatic(app);
      log(`Serving static files from ${distPath}`, "boot");

      // Log the entry script path from the built index.html
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        const content = readFileSync(indexPath, "utf-8");
        const scriptMatch = content.match(/src="([^"]+\.js)"/);
        log(`index.html entry script: ${scriptMatch?.[1] ?? "NOT FOUND"}`, "boot");
      }
    }
  } else {
    await setupVite(httpServer, app);
  }

  appReady = true;
  log("App fully initialized", "boot");
}
