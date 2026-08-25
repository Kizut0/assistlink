const express = require('express');

const app = express();

app.use(express.json());

app.get('/assistlink/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() }));

module.exports = app;
