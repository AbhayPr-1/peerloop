const config = require('./config').default;
const dns = require('dns');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const startContractListener = require('./contractListener');
const { createApp } = require('./app');

export function startServer() {
  // Fix MongoDB Atlas DNS resolution for this process.
  dns.setServers(['8.8.8.8', '1.1.1.1']);

  const appOrigins = config.appOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  const app = createApp({
    appOrigin: config.appOrigin,
    databaseStatus: () => mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || appOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 10000
  });

  io.on('connection', (socket) => {
    console.log(`User connected to Socket.IO: ${socket.id} (${socket.conn.transport.name}).`);
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}. Reason: ${reason}`);
    });
    socket.on('error', (error) => {
      console.error(`Socket error on ${socket.id}:`, error);
    });
  });

  mongoose.connect(config.mongoUri)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection error:', error));

  const port = config.port;
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other process or set a different PORT in the root .env file.`);
    } else {
      console.error('Backend server failed to start:', error);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
    const listenerHandle = startContractListener(io, { pollIntervalMs: 3000, lookbackBlocks: 3 });
    if (!config.chainRpcUrl || config.chainRpcUrl.includes('your_')) {
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

  return { app, server, io };
}

if (require.main === module) startServer();
