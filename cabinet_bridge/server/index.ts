import "dotenv/config";
import compression from "compression";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes, registerUploadRoute } from "./routes/index";
import { attachNetplayServer } from "./netplay";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { log } from "./log";
import { initializeDatabase } from "./storage";

const app = express();
const httpServer = createServer(app);

// Home Assistant ingress prefix stripping
const INGRESS_PREFIX_RE = /^\/api\/(?:hassio_)?ingress\/[^/]+/;
app.use((req, _res, next) => {
  const match = req.url.match(INGRESS_PREFIX_RE);
  if (match) {
    const stripped = req.url.slice(match[0].length) || "/";
    req.url = stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
  next();
});

// Register streaming routes BEFORE any body-parsing middleware.
registerUploadRoute(app);

app.use(compression({
  filter: (req, res) => {
    if (req.path.endsWith("/scrape-all")) return false;
    return compression.filter(req, res);
  }
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb", 
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Global request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  try {
    log("Initializing server sequence...", "boot");
    
    // Step 1: Initialize Database and run migrations
    log("Connecting to database...", "boot");
    initializeDatabase();
    log("Database ready", "boot");
    
    // Step 2: Register API routes
    await registerRoutes(httpServer, app);
    log("API routes registered successfully", "boot");
    
    // Step 3: Attach WebSocket netplay relay
    attachNetplayServer(httpServer);
    log("Netplay server attached", "boot");

    // Global Error Handler
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Internal Server Error:", err);
      if (res.headersSent) return next(err);
      return res.status(status).json({ message });
    });

    // Setup static file serving in production
    if (process.env.NODE_ENV === "production") {
      log("Production mode: setting up static server", "boot");
      serveStatic(app);
    } else {
      log("Development mode: setting up Vite", "boot");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      { port, host: "0.0.0.0" },
      () => {
        log(`serving on port ${port}`, "boot");
      },
    );
  } catch (err) {
    console.error("FATAL: Server failed to start!");
    console.error(err);
    process.exit(1);
  }
})();
