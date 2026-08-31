import express from 'express';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.use(express.json());
app.use(requestLogger);

// All API routes are namespaced under /assistlink/api (course infra requirement).
app.use('/assistlink/api', routes);

// 404 + centralized error handling (must be last).
app.use(notFound);
app.use(errorHandler);

export default app;
