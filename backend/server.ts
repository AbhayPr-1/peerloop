// backend/server.js
const config = require('./config').default;

// Fix MongoDB Atlas DNS resolution
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const startContractListener = require('./contractListener');

const app = express();
const server = http.createServer(app);
const APP_ORIGIN = config.appOrigin;
const APP_ORIGINS = APP_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || APP_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    methods: ["GET", "POST"]
  },
  // FIX: Explicitly configure aggressive timeouts to prevent "transport close"
  pingTimeout: 60000, // Keep connection alive for up to 60 seconds of silence
  pingInterval: 10000 // Send ping every 10 seconds
});

function createIpRateLimiter(maxRequests, windowMs, message) {
  const buckets = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({ msg: message });
    }

    bucket.count += 1;
    return next();
  };
}

function applySecurityHeaders(_req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:5001 https://ethereum-sepolia-rpc.publicnode.com ws: wss:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
}

function redirectHttpToHttps(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.secure || req.headers['x-forwarded-proto'] === 'https' || ['localhost', '127.0.0.1', '::1'].includes(req.hostname)) {
    return next();
  }
  const httpsUrl = `https://${req.headers.host}${req.originalUrl}`;
  return res.redirect(301, httpsUrl);
}

// --- Middleware ---
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(redirectHttpToHttps);
app.use(applySecurityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || APP_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));
app.use('/api/auth', createIpRateLimiter(20, 60 * 1000, 'Too many auth requests. Try again later.'));
app.use('/api/upload', createIpRateLimiter(20, 60 * 1000, 'Too many upload requests. Try again later.'));
app.use(express.json({ limit: '5mb' }));

// --- Database Connection ---
mongoose.connect(config.mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// --- API Routes ---
app.use('/api/auth', require('./modules/auth').default);
app.use('/api/upload', require('./modules/uploads').default);
app.use('/api/listing-metadata', require('./modules/listing-metadata').default);
app.use('/api/config', require('./modules/public-config').default);

app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: 'peerloop-backend',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
  console.log(`User connected to Socket.IO: ${socket.id} (${socket.conn.transport.name}).`);

  // Log disconnection reasons
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id}. Reason: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`Socket error on ${socket.id}:`, error);
  });
});

// --- Start Server ---
const PORT = config.port;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT in the root .env file.`);
  } else {
    console.error('Backend server failed to start:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  const listenerHandle = startContractListener(io, { pollIntervalMs: 3000, lookbackBlocks: 3 });
  if (!process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL.includes('your_')) {
    console.warn('Skipping blockchain listener because SEPOLIA_RPC_URL is still a placeholder. Add a real RPC URL in root .env to enable live contract events.');
  }

  const shutdown = (signal) => {
    console.log(`${signal} received - stopping listener and server...`);
    if (listenerHandle && typeof listenerHandle.stop === 'function') listenerHandle.stop();
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0));
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
});
