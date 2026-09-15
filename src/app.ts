import express from 'express';
import path from 'node:path';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

// The production reverse proxy is local to the VM. Trusting loopback lets the
// demo-login throttle distinguish remote clients without trusting arbitrary
// forwarded headers from direct connections.
app.set('trust proxy', 'loopback');
app.use(express.json());
app.use(requestLogger);

// All API routes are namespaced under /assistlink/api (course infra requirement).
app.use('/assistlink/api', routes);

app.get('/', (_req, res) => res.redirect('/assistlink/'));
app.use('/assistlink', express.static(path.join(import.meta.dirname, '../public')));

// 404 + centralized error handling (must be last).
app.use(notFound);
app.use(errorHandler);

export default app;
