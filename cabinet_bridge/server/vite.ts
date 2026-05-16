import type { Express } from 'express';
import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export async function setupVite(server: Server, app: Express) {
  // Dynamic import keeps vite out of the production bundle entirely.
  // esbuild only sees this at runtime (dev mode only) so it is never
  // emitted as an external require() call in dist/index.cjs.
  const { createServer: createViteServer, createLogger } = await import('vite');
  const { default: viteConfig } = await import('../vite.config.js');
  const { nanoid } = await import('nanoid');

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: '/vite-hmr' },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: 'custom',
  });

  app.use(vite.middlewares);

  app.use('/{*path}', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        '..',
        'client',
        'index.html',
      );
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
