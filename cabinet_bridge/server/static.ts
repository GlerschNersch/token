import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";
import { log } from "./index";

export function serveStatic(app: Express) {
  // distPath should be relative to the WORKDIR /app in the Docker container.
  // The server bundled file is at /app/dist/index.cjs
  // Static files are at /app/dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");
  
  log(`Checking static assets at: ${distPath}`, "static");
  
  if (!fs.existsSync(distPath)) {
    log(`ERROR: Build directory not found! Path: ${distPath}`, "static");
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  log(`Serving static files from ${distPath}`, "static");
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.get("*", (req, res) => {
    // Log non-api requests that fall through to index.html
    if (!req.url.startsWith("/api")) {
       // log(`Route fallback: ${req.url} -> index.html`, "static");
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
