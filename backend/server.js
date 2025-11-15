// backend/server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// optional debug (keep while testing)
console.log('DEBUG: SEPOLIA_RPC_URL=', !!process.env.SEPOLIA_RPC_URL);
console.log('DEBUG: CONTRACT_ADDRESS=', !!process.env.CONTRACT_ADDRESS);
console.log('DEBUG: MONGO_URI=', !!process.env.MONGO_URI);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); 
const { Server } = require("socket.io"); 
const startContractListener = require('./contractListener');

const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // FIX: Explicitly configure aggressive timeouts to prevent "transport close"
  pingTimeout: 60000, // Keep connection alive for up to 60 seconds of silence
  pingInterval: 10000 // Send ping every 10 seconds
});

// --- Middleware ---
app.use(cors({ origin: '*' }));
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  const listenerHandle = startContractListener(io, { pollIntervalMs: 3000, lookbackBlocks: 3 });

// graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT received - stopping listener and server...');
  if (listenerHandle && typeof listenerHandle.stop === 'function') listenerHandle.stop();
  server.close(() => process.exit(0));
});
});