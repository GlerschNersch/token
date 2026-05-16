import express from "express";
import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";

function staticLog(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [static] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    // Do NOT throw here - that would kill the process before HA ingress
    // can connect. Log the error and return gracefully instead.
    staticLog(`ERROR: Build output not found at ${distPath}`);
    return;
  }

  staticLog(`Serving from ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}
