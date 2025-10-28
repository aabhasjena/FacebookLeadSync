// server.js
// Simple Express server with optional route mounting and a poller.
// Written for readability: beginner-friendly, with clear sections & comments.

require('dotenv').config(); // load .env into process.env
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

/* ----------------------------
   Basic middleware & settings
   ---------------------------- */

// Limit JSON body size to avoid huge payloads
app.use(express.json({ limit: '2mb' }));

// Simple startup log (shows Node version and working directory)
console.log('Starting server.js', {
  node: process.version,
  cwd: process.cwd(),
});

/* ----------------------------
   Global error handlers (stability)
   ---------------------------- */

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err && err.stack ? err.stack : err);
});

/* ----------------------------
   CORS configuration
   ---------------------------- */

// Allow origins configured in env var CORS_ALLOWED_ORIGINS (comma-separated)
// Default includes localhost ports commonly used during development.
const DEFAULT_ORIGINS = 'http://localhost:5173,http://localhost:3000';
const FRONTEND_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || DEFAULT_ORIGINS)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// CORS options - function form lets us allow server-to-server requests
app.use(cors({
  origin: function (origin, callback) {
    // If no origin (curl, server-to-server), allow
    if (!origin) return callback(null, true);
    if (FRONTEND_ORIGINS.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 204
}));

/* ----------------------------
   Helper: safeRequireRouter
   Tries to require a route file only if it exists.
   Keeps main flow tidy and avoids crashes if optional files missing.
   ---------------------------- */
function safeRequireRouter(routeFilePath, mountPath) {
  if (fs.existsSync(routeFilePath)) {
    try {
      const router = require(routeFilePath);
      app.use(mountPath, router);
      console.log(`Mounted ${mountPath} -> ${routeFilePath}`);
    } catch (err) {
      console.error(`Failed to mount ${routeFilePath} at ${mountPath}:`, err && err.stack ? err.stack : err);
    }
  } else {
    console.warn(`${routeFilePath} NOT found (skipping ${mountPath})`);
  }
}

/* ----------------------------
   Mount optional/conditional routes
   Files are optional in your repo; if present they will be mounted.
   ---------------------------- */

// Example webhook for Facebook (optional)
const webhookPath = path.join(__dirname, 'facebookWebhookTest.js');
if (fs.existsSync(webhookPath)) {
  app.use('/webhook/facebook', require(webhookPath));
  console.log('Mounted /webhook/facebook ->', webhookPath);
} else {
  console.warn('facebookWebhookTest.js NOT found at', webhookPath);
}

// If you added a generic API router under routes/fetchLeadsApi.js
safeRequireRouter(path.join(__dirname, 'routes', 'fetchLeadsApi.js'), '/facebook-lead');

// Poller service (optional). If present, call startCron(schedule)
const pollerPath = path.join(__dirname, 'services', 'poller.js');
if (fs.existsSync(pollerPath)) {
  try {
    const poller = require(pollerPath);
    // Allow override via env var POLL_CRON; default schedule runs every 30 seconds here
    const schedule = process.env.POLL_CRON || '*/30 * * * * *';
    if (poller && typeof poller.startCron === 'function') {
      poller.startCron(schedule);
      console.log('Poller started with schedule:', schedule);
    } else {
      console.warn('poller module found but startCron() not exported');
    }
  } catch (err) {
    console.error('Failed to start poller:', err && err.stack ? err.stack : err);
  }
} else {
  console.warn('services/poller.js NOT found at', pollerPath);
}

// Mount a route that fetches leads from DB (optional)
const dbLeadRoute = path.join(__dirname, 'routes', 'fetchLeadsFromDB.js');
if (fs.existsSync(dbLeadRoute)) {
  app.use('/leadsync/facebook-leads', require(dbLeadRoute));
  console.log('Mounted /facebook-leads ->', dbLeadRoute);
} else {
  console.warn('routes/fetchLeadsFromDB.js NOT found');
}

// Mount credentials router (optional)
const credsRouterPath = path.join(__dirname, 'routes', 'facebookCredentialsDb.js');
if (fs.existsSync(credsRouterPath)) {
  app.use('/leadsync/facebook-credentials', require(credsRouterPath));
  console.log('Mounted /api/facebook-credentials ->', credsRouterPath);
}

/* ----------------------------
   Root route (Welcome page)
   ---------------------------- */

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Welcome to LeadSync</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f9fafc;
            color: #333;
            text-align: center;
            padding-top: 100px;
          }
          h1 {
            color: #007bff;
          }
          p {
            font-size: 18px;
            margin-top: 10px;
          }
          .info {
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <h1>🚀 Welcome to LeadSync API</h1>
        <p>Your commercial lead synchronization server is running successfully.</p>
        <div class="info">
          <p>Available endpoints:</p>
          <ul style="list-style:none; padding:0;">
            <li>➡️ <b>/leadsync/facebook-leads</b> — Fetch Facebook leads</li>
            <li>➡️ <b>/leadsync/facebook-credentials</b> — Manage Facebook credentials</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});


/* ----------------------------
   Start server
   ---------------------------- */

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

/* ----------------------------
   Graceful shutdown helper
   Stops accepting new connections and exits cleanly.
   Also forces exit if shutdown hangs.
   ---------------------------- */
function shutdown(signal) {
  console.log('Shutting down (signal:', signal || 'manual', ')...');
  server.close(() => {
    console.log('HTTP server closed. Exiting.');
    process.exit(0);
  });

  // If not closed within 5 seconds, force exit.
  setTimeout(() => {
    console.error('Forcing exit.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/* ----------------------------
   Exports (optional)
   If you want to import this app in tests, export it.
   ---------------------------- */
module.exports = app;
