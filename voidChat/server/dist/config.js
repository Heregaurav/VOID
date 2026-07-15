"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useInMemoryCache = exports.useInMemoryDb = exports.redisSubClient = exports.redisPubClient = exports.redisClient = exports.pool = exports.RATE_LIMIT_MAX = exports.RATE_LIMIT_WINDOW = exports.MAX_MSG_LENGTH = exports.ADMIN_TOKEN = exports.JWT_SECRET = exports.REDIS_URL = exports.DATABASE_URL = exports.PORT = void 0;
exports.initConfig = initConfig;
const pg_1 = require("pg");
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.PORT = process.env.PORT || 5000;
exports.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://gaurav:password@localhost:5432/void_db';
exports.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
exports.JWT_SECRET = process.env.JWT_SECRET || 'void_ghost_jwt_secret_666';
exports.ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'void_secret_666';
// Max limits
exports.MAX_MSG_LENGTH = 300;
exports.RATE_LIMIT_WINDOW = 5000; // ms
exports.RATE_LIMIT_MAX = 5; // messages per window
// Database connection
exports.pool = new pg_1.Pool({
    connectionString: exports.DATABASE_URL,
    ssl: exports.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});
// Redis client
exports.redisClient = (0, redis_1.createClient)({ url: exports.REDIS_URL });
exports.redisPubClient = (0, redis_1.createClient)({ url: exports.REDIS_URL });
exports.redisSubClient = (0, redis_1.createClient)({ url: exports.REDIS_URL });
exports.useInMemoryDb = false;
exports.useInMemoryCache = false;
async function initConfig() {
    // Connect Redis client
    try {
        await exports.redisClient.connect();
        await exports.redisPubClient.connect();
        await exports.redisSubClient.connect();
        console.log('✅ Redis connected successfully.');
    }
    catch (err) {
        console.warn('⚠️ Redis not available. Using in-memory cache.');
        exports.useInMemoryCache = true;
    }
    // Connect Postgres
    try {
        const client = await exports.pool.connect();
        console.log('✅ PostgreSQL connected successfully.');
        client.release();
    }
    catch (err) {
        console.warn('⚠️ PostgreSQL not available. Using in-memory fallback.');
        exports.useInMemoryDb = true;
    }
}
