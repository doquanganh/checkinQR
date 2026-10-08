import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, isProd } from './server/config.ts';
import { db } from './server/db.ts';
import { createApp } from './server/app.ts';
import { bootstrapAdmin } from './server/auth.ts';
import { seedSampleData } from './server/seed.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  await bootstrapAdmin();
  if (config.seedSampleData) seedSampleData();

  const app = createApp();

  if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  } else {
    // Imported lazily so production never loads Vite
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`🚀 Event Guest & QR Check-in Server running at http://0.0.0.0:${config.port}`);
  });

  db.purgeExpiredSessions();
  const purge = setInterval(() => db.purgeExpiredSessions(), 60 * 60 * 1000);
  purge.unref();

  // Graceful shutdown: stop accepting, drop SSE streams, flush and close SQLite
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    clearInterval(purge);
    db.closeAllSSE();
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeAllConnections?.();
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
