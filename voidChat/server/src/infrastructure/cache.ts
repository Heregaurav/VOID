import { redisClient, useInMemoryCache } from '../config';
import { ICacheRepository } from '../domain/repositories';
import { TempRoom } from '../domain/entities';

// In-memory fallbacks
let inMemorySessions: Record<string, any> = {};
let inMemoryTempRooms: Record<string, TempRoom> = {};
let inMemoryMatchQueue: string[] = [];

export class RedisRepository implements ICacheRepository {
  private SESSION_PREFIX = 'void:session:';
  private ROOMS_KEY = 'void:temp_rooms';
  private MATCH_QUEUE_KEY = 'void:match_queue';

  // --- User Socket Sessions ---
  async saveUserSession(socketId: string, session: any): Promise<void> {
    if (useInMemoryCache) {
      inMemorySessions[socketId] = session;
      return;
    }

    try {
      await redisClient.set(`${this.SESSION_PREFIX}${socketId}`, JSON.stringify(session), {
        EX: 86400 // Expire in 1 day if disconnected
      });
    } catch {
      // In-memory fallback on failure
      inMemorySessions[socketId] = session;
    }
  }

  async getUserSession(socketId: string): Promise<any | null> {
    if (useInMemoryCache) {
      return inMemorySessions[socketId] || null;
    }

    try {
      const data = await redisClient.get(`${this.SESSION_PREFIX}${socketId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return inMemorySessions[socketId] || null;
    }
  }

  async deleteUserSession(socketId: string): Promise<void> {
    if (useInMemoryCache) {
      delete inMemorySessions[socketId];
      return;
    }

    try {
      await redisClient.del(`${this.SESSION_PREFIX}${socketId}`);
    } catch {
      delete inMemorySessions[socketId];
    }
  }

  async getAllUserSessions(): Promise<any[]> {
    if (useInMemoryCache) {
      return Object.values(inMemorySessions);
    }

    try {
      const keys = await redisClient.keys(`${this.SESSION_PREFIX}*`);
      if (keys.length === 0) return [];
      
      const results = await redisClient.mGet(keys);
      return results.map(data => (data ? JSON.parse(data) : null)).filter(Boolean);
    } catch {
      return Object.values(inMemorySessions);
    }
  }

  // --- Temporary Rooms ---
  async saveTempRoom(room: TempRoom): Promise<void> {
    if (useInMemoryCache) {
      inMemoryTempRooms[room.id] = room;
      return;
    }

    try {
      await redisClient.hSet(this.ROOMS_KEY, room.id, JSON.stringify(room));
    } catch {
      inMemoryTempRooms[room.id] = room;
    }
  }

  async getTempRooms(): Promise<TempRoom[]> {
    const now = Date.now();

    if (useInMemoryCache) {
      const rooms: TempRoom[] = [];
      for (const key in inMemoryTempRooms) {
        const room = inMemoryTempRooms[key];
        if (room.expiresAt > now) {
          rooms.push(room);
        } else {
          delete inMemoryTempRooms[key];
        }
      }
      return rooms;
    }

    try {
      const data = await redisClient.hGetAll(this.ROOMS_KEY);
      const rooms: TempRoom[] = [];
      
      for (const key in data) {
        const room = JSON.parse(data[key]) as TempRoom;
        if (room.expiresAt > now) {
          rooms.push(room);
        } else {
          await this.deleteTempRoom(room.id);
        }
      }
      return rooms;
    } catch {
      const rooms: TempRoom[] = [];
      for (const key in inMemoryTempRooms) {
        const room = inMemoryTempRooms[key];
        if (room.expiresAt > now) {
          rooms.push(room);
        } else {
          delete inMemoryTempRooms[key];
        }
      }
      return rooms;
    }
  }

  async deleteTempRoom(roomId: string): Promise<void> {
    if (useInMemoryCache) {
      delete inMemoryTempRooms[roomId];
      return;
    }

    try {
      await redisClient.hDel(this.ROOMS_KEY, roomId);
    } catch {
      delete inMemoryTempRooms[roomId];
    }
  }

  // --- Matchmaking Queue ---
  async addToMatchQueue(socketId: string): Promise<void> {
    if (useInMemoryCache) {
      inMemoryMatchQueue.push(socketId);
      return;
    }

    try {
      await redisClient.rPush(this.MATCH_QUEUE_KEY, socketId);
    } catch {
      inMemoryMatchQueue.push(socketId);
    }
  }

  async removeFromMatchQueue(socketId: string): Promise<void> {
    if (useInMemoryCache) {
      inMemoryMatchQueue = inMemoryMatchQueue.filter(id => id !== socketId);
      return;
    }

    try {
      await redisClient.lRem(this.MATCH_QUEUE_KEY, 0, socketId);
    } catch {
      inMemoryMatchQueue = inMemoryMatchQueue.filter(id => id !== socketId);
    }
  }

  async getMatchQueue(): Promise<string[]> {
    if (useInMemoryCache) {
      return [...inMemoryMatchQueue];
    }

    try {
      return await redisClient.lRange(this.MATCH_QUEUE_KEY, 0, -1);
    } catch {
      return [...inMemoryMatchQueue];
    }
  }

  async popMatchQueue(count: number): Promise<string[]> {
    if (useInMemoryCache) {
      const popped = inMemoryMatchQueue.slice(0, count);
      inMemoryMatchQueue = inMemoryMatchQueue.slice(count);
      return popped;
    }

    try {
      const popped: string[] = [];
      for (let i = 0; i < count; i++) {
        const sId = await redisClient.lPop(this.MATCH_QUEUE_KEY);
        if (sId) {
          popped.push(sId);
        } else {
          break;
        }
      }
      return popped;
    } catch {
      const popped = inMemoryMatchQueue.slice(0, count);
      inMemoryMatchQueue = inMemoryMatchQueue.slice(count);
      return popped;
    }
  }
}
