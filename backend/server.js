// backend/server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const io = new Server(server, {
  cors: {
    origin: APP_ORIGIN,
    methods: ["GET", "POST"]
  },
  // FIX: Explicitly configure aggressive timeouts to prevent "transport close"
  pingTimeout: 60000, // Keep connection alive for up to 60 seconds of silence
  pingInterval: 10000 // Send ping every 10 seconds
});

// --- Middleware ---
app.use(cors({ origin: APP_ORIGIN }));
app.use(express.json({ limit: '5mb' }));

// --- Database Connection ---
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/peerloop';
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// --- API Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/config', require('./routes/config')); // <— ADDED LINE

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
  console.log('User connected to Socket.IO.');

  // Log disconnection reasons
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id}. Reason: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`Socket error on ${socket.id}:`, error);
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 5001;
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

  // graceful shutdown
  process.on('SIGINT', async () => {
    console.log('SIGINT received - stopping listener and server...');
    if (listenerHandle && typeof listenerHandle.stop === 'function') listenerHandle.stop();
    server.close(() => process.exit(0));
  });
});
