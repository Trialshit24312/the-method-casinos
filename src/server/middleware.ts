import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Express } from 'express';

const DISCORD_IMG_ORIGINS = [
  'https://cdn.discordapp.com',
  'https://cdn.discord.com',
  'https://media.discordapp.net',
];

export function applySecurityMiddleware(app: Express): void {
  const defaultDirectives = helmet.contentSecurityPolicy.getDefaultDirectives();
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...defaultDirectives,
        'img-src': ["'self'", 'data:', 'blob:', ...DISCORD_IMG_ORIGINS],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'connect-src': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use('/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts — try again later' },
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
