import express from 'express';
import path from 'node:path';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { auth } from './middleware/auth.js';
import { ApiError } from './utils/ApiError.js';

const app = express();

// The production reverse proxy is local to the VM. Trusting loopback lets the
// demo-login throttle distinguish remote clients without trusting arbitrary
// forwarded headers from direct connections.
app.set('trust proxy', 'loopback');
app.use(express.json());
app.use(requestLogger);
app.use((_req, res, next) => {
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
  next();
});

// All API routes are namespaced under /assistlink/api (course infra requirement).
app.use('/assistlink/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, routes);

app.get('/', (_req, res) => res.redirect('/assistlink/'));
app.use('/assistlink', express.static(path.join(import.meta.dirname, '../public')));
const webIndex = path.join(import.meta.dirname, '../public/index.html');
app.get('/assistlink/login', (_req, res) => res.sendFile(webIndex));
const protectedPages = [
  '/assistlink/opportunities', '/assistlink/opportunities/:id',
  '/assistlink/profile', '/assistlink/applications', '/assistlink/manage', '/assistlink/users',
];
app.get(protectedPages, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  void auth(req, res, error => {
    if (error instanceof ApiError && error.statusCode === 401) {
      return res.redirect(`/assistlink/login/?next=${encodeURIComponent(req.originalUrl)}`);
    }
    if (error) return next(error);
    return res.sendFile(webIndex);
  });
});

// 404 + centralized error handling (must be last).
app.use(notFound);
app.use(errorHandler);

export default app;
