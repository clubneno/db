const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Import the main server for API routes
const mainServer = require('./server.js');
const healthRouter = require('./health.js');

// Health check route
app.use('/api', healthRouter);

// API routes (mainServer already has /api prefix)
app.use('/', mainServer);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

module.exports = app;