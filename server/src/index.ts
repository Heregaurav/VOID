import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { PORT, initConfig, pool, redisClient, redisPubClient, redisSubClient, useInMemoryCache } from './config';
import { PostgresRepository } from './infrastructure/database';
import { RedisRepository } from './infrastructure/cache';
import { FeedUseCase } from './application/feed.usecase';
import { RoomsUseCase } from './application/rooms.usecase';
import { MatchingUseCase } from './application/matching.usecase';
import { configureHttp } from './infrastructure/http/server';
import { configureSockets } from './infrastructure/sockets/handler';

async function startServer() {
  console.log('\n☠  INITIALIZING VOID CHAT CORE  ☠');

  // 1. Initialize DB and Redis
  await initConfig();

  const dbRepo = new PostgresRepository();
  const cacheRepo = new RedisRepository();

  // Run DB Migrations
  await dbRepo.initDb();

  // 2. Initialize Use Cases
  const feedUseCase = new FeedUseCase(dbRepo);
  const roomsUseCase = new RoomsUseCase(cacheRepo);
  const matchingUseCase = new MatchingUseCase(cacheRepo);

  // 3. Create Express and HTTP Servers
  const app = express();
  const server = http.createServer(app);

  // 4. Configure HTTP Routes
  configureHttp(app, feedUseCase, dbRepo);

  // 5. Configure Socket.IO with Redis Adapter
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
    maxHttpBufferSize: 5e6 // 5MB limit
  });

  if (!useInMemoryCache) {
    io.adapter(createAdapter(redisPubClient, redisSubClient));
    console.log('✅ Socket.IO Redis Adapter configured.');
  } else {
    console.log('⚠️ Running Socket.IO in local memory mode (Redis not connected).');
  }

  // 6. Configure Sockets Handler
  configureSockets(io, cacheRepo, dbRepo, roomsUseCase, matchingUseCase);

  // 7. Start Server
  server.listen(PORT, () => {
    console.log(`\n☠  VOID CHAT SERVER STARTED  ☠`);
    console.log(`   Listening on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Metrics: http://localhost:${PORT}/metrics\n`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start the server:', err);
  process.exit(1);
});
