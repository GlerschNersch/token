import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";
import { log } from "./log";

export function serveStatic(app: Express) {
  const distPath = path.join(process.cwd(), "dist", "public");
  
  log(`Checking static assets at: ${distPath}`, "static");
  
  if (!fs.existsSync(distPath)) {
    log(`CRITICAL ERROR: Static asset directory not found! Expected at ${distPath}`, "static");
  } else {
    const indexFile = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexFile)) {
      log(`CRITICAL ERROR: index.html not found at ${indexFile}`, "static");
    } else {
      log("Static assets verified", "static");
    }
  }

  // Serve static assets with a short cache time
  app.use(express.static(distPath, {
    maxAge: '1h',
    index: false 
  }));

  // Handle SPA routing - send index.html for any non-API request
  app.get("*", (req, res, next) => {
    // Skip if it's an API call that happened to fall through
    if (req.url.startsWith("/api")) {
      return next();
    }
    
    // Log non-api requests that fall through to index.html
    if (!req.url.startsWith("/api")) {
       // log(`Route fallback: ${req.url} -> index.html`, "static");
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
