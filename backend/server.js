// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // 1. Import http
const { Server } = require("socket.io"); // 2. Import Server from socket.io

const app = express();
const server = http.createServer(app); // 3. Create an http server with your app

// 4. Initialize Socket.IO and attach it to the server, allowing all origins
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- Middleware ---
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- API Routes ---
// Pass `io` to your routes so they can emit events
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', (req, res, next) => {
  req.io = io;
  next();
}, require('./routes/products'));
app.use('/api/users', require('./routes/users'));

// --- Socket.IO Connection ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
// 5. Use `server.listen` instead of `app.listen`
server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});