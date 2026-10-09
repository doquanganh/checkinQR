import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { buildInfo, config } from './config.ts';
import { db } from './db.ts';
import { apiRouter } from './api.ts';
import { attachUser, authRouter } from './auth.ts';

// Builds the API app (no listening, no Vite) so tests can drive it directly
export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // upgrade-insecure-requests and HSTS only make sense (and only work) when served over HTTPS
  const https = config.cookieSecure;

  app.use(
    helmet({
      strictTransportSecurity: https ? undefined : false,
      // Vite dev injects inline scripts; the production bundle only needs same-origin + data: images (QR)
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                upgradeInsecureRequests: https ? [] : null,
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                mediaSrc: ["'self'", 'blob:', 'data:'],
                workerSrc: ["'self'", 'blob:'],
                connectSrc: ["'self'"],
              },
            }
          : false,
    })
  );

  app.use(express.json({ limit: '5mb' }));

  // CSRF guard: browsers always send Origin on cross-site writes, so reject a foreign one.
  // SameSite=Lax session cookies are the second layer.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      let host = '';
      try {
        host = new URL(origin).host;
      } catch {
        /* malformed Origin is rejected below */
      }
      const allowed = [req.get('host'), config.appUrl ? new URL(config.appUrl).host : ''];
      if (!host || !allowed.includes(host)) {
        return res.status(403).json({ success: false, message: 'Origin không được phép' });
      }
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    try {
      db.sqlite.prepare('SELECT 1').get();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: buildInfo.version,
        commit: buildInfo.commit,
        built_at: buildInfo.builtAt,
      });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  app.use('/api', attachUser, authRouter, apiRouter);

  app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Không tìm thấy API' }));

  // Express 4 routes this for sync errors thrown inside handlers
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, message: 'Dữ liệu gửi lên quá lớn' });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, message: 'JSON không hợp lệ' });
    }
    if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ success: false, message: 'Dữ liệu bị trùng hoặc không hợp lệ' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  });

  return app;
}
