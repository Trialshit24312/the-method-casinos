import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Express } from 'express';

export function applySecurityMiddleware(app: Express): void {
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  app.use('/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts — try again later' },
  }));

  app.use('/api/discover', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Discovery rate limit — wait before starting another scan' },
  }));

  app.use('/api/check', rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'URL check rate limit' },
  }));

  app.use('/api/report', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Report rate limit' },
  }));

  app.use('/api/similar', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Similar web search rate limit — try again later' },
  }));

  app.use('/api/ask', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'AI rate limit — try again later' },
  }));
}
