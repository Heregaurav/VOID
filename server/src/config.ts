import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://gaurav:password@localhost:5432/void_db';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const JWT_SECRET = process.env.JWT_SECRET || 'void_ghost_jwt_secret_666';
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'void_secret_666';

// Max limits
export const MAX_MSG_LENGTH = 300;
export const RATE_LIMIT_WINDOW = 5000; // ms
export const RATE_LIMIT_MAX = 5; // messages per window

// Database connection
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Redis client
export const redisClient = createClient({ url: REDIS_URL });
export const redisPubClient = createClient({ url: REDIS_URL });
export const redisSubClient = createClient({ url: REDIS_URL });

export let useInMemoryDb = false;
export let useInMemoryCache = false;

export async function initConfig() {
  // Connect Redis client
  try {
    await redisClient.connect();
    await redisPubClient.connect();
    await redisSubClient.connect();
    console.log('✅ Redis connected successfully.');
  } catch (err) {
    console.warn('⚠️ Redis not available. Using in-memory cache.');
    useInMemoryCache = true;
  }

  // Connect Postgres
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully.');
    client.release();
  } catch (err) {
    console.warn('⚠️ PostgreSQL not available. Using in-memory fallback.');
    useInMemoryDb = true;
  }
}
