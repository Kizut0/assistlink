import express from 'express';
import path from 'node:path';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

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
