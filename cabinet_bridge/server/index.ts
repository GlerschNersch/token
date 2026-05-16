import "dotenv/config";
import compression from "compression";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes/index";
import { attachNetplayServer } from "./netplay";
import { serveStatic } from "./static";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

// Gzip all responses — ~70% bandwidth saving on JSON + static assets.
// Skip SSE streams (scrape-all progress) since they need to flush incrementally.
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
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Home Assistant ingress (and a few similar reverse-proxy setups) sometimes
// forward requests with the original ingress prefix still in the URL. Strip
// any leading "/api/hassio_ingress/<token>" or "/api/ingress/<token>" so our
// route table stays prefix-agnostic.
const INGRESS_PREFIX_RE = /^\/api\/(?:hassio_)?ingress\/[^/]+/;
app.use((req, _res, next) => {
  const match = req.url.match(INGRESS_PREFIX_RE);
  if (match) {
    const stripped = req.url.slice(match[0].length) || "/";
    req.url = stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Initializing server sequence...", "boot");
    
    await registerRoutes(httpServer, app);
    log("Routes registered successfully", "boot");
    
    attachNetplayServer(httpServer);
    log("Netplay server attached", "boot");

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      log("Production mode: setting up static server", "boot");
      serveStatic(app);
    } else {
      log("Development mode: setting up Vite", "boot");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
      },
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
