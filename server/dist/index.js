"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const config_1 = require("./config");
const database_1 = require("./infrastructure/database");
const cache_1 = require("./infrastructure/cache");
const feed_usecase_1 = require("./application/feed.usecase");
const rooms_usecase_1 = require("./application/rooms.usecase");
const matching_usecase_1 = require("./application/matching.usecase");
const server_1 = require("./infrastructure/http/server");
const handler_1 = require("./infrastructure/sockets/handler");
async function startServer() {
    console.log('\n☠  INITIALIZING VOID CHAT CORE  ☠');
    // 1. Initialize DB and Redis
    await (0, config_1.initConfig)();
    const dbRepo = new database_1.PostgresRepository();
    const cacheRepo = new cache_1.RedisRepository();
    // Run DB Migrations
    await dbRepo.initDb();
    // 2. Initialize Use Cases
    const feedUseCase = new feed_usecase_1.FeedUseCase(dbRepo);
    const roomsUseCase = new rooms_usecase_1.RoomsUseCase(cacheRepo);
    const matchingUseCase = new matching_usecase_1.MatchingUseCase(cacheRepo);
    // 3. Create Express and HTTP Servers
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    // 4. Configure HTTP Routes
    (0, server_1.configureHttp)(app, feedUseCase, dbRepo);
    // 5. Configure Socket.IO with Redis Adapter
    const io = new socket_io_1.Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        pingTimeout: 20000,
        pingInterval: 10000,
        maxHttpBufferSize: 5e6 // 5MB limit
    });
    if (!config_1.useInMemoryCache) {
        io.adapter((0, redis_adapter_1.createAdapter)(config_1.redisPubClient, config_1.redisSubClient));
        console.log('✅ Socket.IO Redis Adapter configured.');
    }
    else {
        console.log('⚠️ Running Socket.IO in local memory mode (Redis not connected).');
    }
    // 6. Configure Sockets Handler
    (0, handler_1.configureSockets)(io, cacheRepo, dbRepo, roomsUseCase, matchingUseCase);
    // 7. Start Server
    server.listen(config_1.PORT, () => {
        console.log(`\n☠  VOID CHAT SERVER STARTED  ☠`);
        console.log(`   Listening on port ${config_1.PORT}`);
        console.log(`   Health: http://localhost:${config_1.PORT}/health`);
        console.log(`   Metrics: http://localhost:${config_1.PORT}/metrics\n`);
    });
}
startServer().catch(err => {
    console.error('❌ Failed to start the server:', err);
    process.exit(1);
});
