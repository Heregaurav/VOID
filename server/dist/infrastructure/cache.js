"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisRepository = void 0;
const config_1 = require("../config");
// In-memory fallbacks
let inMemorySessions = {};
let inMemoryTempRooms = {};
let inMemoryMatchQueue = [];
class RedisRepository {
    SESSION_PREFIX = 'void:session:';
    ROOMS_KEY = 'void:temp_rooms';
    MATCH_QUEUE_KEY = 'void:match_queue';
    // --- User Socket Sessions ---
    async saveUserSession(socketId, session) {
        if (config_1.useInMemoryCache) {
            inMemorySessions[socketId] = session;
            return;
        }
        try {
            await config_1.redisClient.set(`${this.SESSION_PREFIX}${socketId}`, JSON.stringify(session), {
                EX: 86400 // Expire in 1 day if disconnected
            });
        }
        catch {
            // In-memory fallback on failure
            inMemorySessions[socketId] = session;
        }
    }
    async getUserSession(socketId) {
        if (config_1.useInMemoryCache) {
            return inMemorySessions[socketId] || null;
        }
        try {
            const data = await config_1.redisClient.get(`${this.SESSION_PREFIX}${socketId}`);
            return data ? JSON.parse(data) : null;
        }
        catch {
            return inMemorySessions[socketId] || null;
        }
    }
    async deleteUserSession(socketId) {
        if (config_1.useInMemoryCache) {
            delete inMemorySessions[socketId];
            return;
        }
        try {
            await config_1.redisClient.del(`${this.SESSION_PREFIX}${socketId}`);
        }
        catch {
            delete inMemorySessions[socketId];
        }
    }
    async getAllUserSessions() {
        if (config_1.useInMemoryCache) {
            return Object.values(inMemorySessions);
        }
        try {
            const keys = await config_1.redisClient.keys(`${this.SESSION_PREFIX}*`);
            if (keys.length === 0)
                return [];
            const results = await config_1.redisClient.mGet(keys);
            return results.map(data => (data ? JSON.parse(data) : null)).filter(Boolean);
        }
        catch {
            return Object.values(inMemorySessions);
        }
    }
    // --- Temporary Rooms ---
    async saveTempRoom(room) {
        if (config_1.useInMemoryCache) {
            inMemoryTempRooms[room.id] = room;
            return;
        }
        try {
            await config_1.redisClient.hSet(this.ROOMS_KEY, room.id, JSON.stringify(room));
        }
        catch {
            inMemoryTempRooms[room.id] = room;
        }
    }
    async getTempRooms() {
        const now = Date.now();
        if (config_1.useInMemoryCache) {
            const rooms = [];
            for (const key in inMemoryTempRooms) {
                const room = inMemoryTempRooms[key];
                if (room.expiresAt > now) {
                    rooms.push(room);
                }
                else {
                    delete inMemoryTempRooms[key];
                }
            }
            return rooms;
        }
        try {
            const data = await config_1.redisClient.hGetAll(this.ROOMS_KEY);
            const rooms = [];
            for (const key in data) {
                const room = JSON.parse(data[key]);
                if (room.expiresAt > now) {
                    rooms.push(room);
                }
                else {
                    await this.deleteTempRoom(room.id);
                }
            }
            return rooms;
        }
        catch {
            const rooms = [];
            for (const key in inMemoryTempRooms) {
                const room = inMemoryTempRooms[key];
                if (room.expiresAt > now) {
                    rooms.push(room);
                }
                else {
                    delete inMemoryTempRooms[key];
                }
            }
            return rooms;
        }
    }
    async deleteTempRoom(roomId) {
        if (config_1.useInMemoryCache) {
            delete inMemoryTempRooms[roomId];
            return;
        }
        try {
            await config_1.redisClient.hDel(this.ROOMS_KEY, roomId);
        }
        catch {
            delete inMemoryTempRooms[roomId];
        }
    }
    // --- Matchmaking Queue ---
    async addToMatchQueue(socketId) {
        if (config_1.useInMemoryCache) {
            inMemoryMatchQueue.push(socketId);
            return;
        }
        try {
            await config_1.redisClient.rPush(this.MATCH_QUEUE_KEY, socketId);
        }
        catch {
            inMemoryMatchQueue.push(socketId);
        }
    }
    async removeFromMatchQueue(socketId) {
        if (config_1.useInMemoryCache) {
            inMemoryMatchQueue = inMemoryMatchQueue.filter(id => id !== socketId);
            return;
        }
        try {
            await config_1.redisClient.lRem(this.MATCH_QUEUE_KEY, 0, socketId);
        }
        catch {
            inMemoryMatchQueue = inMemoryMatchQueue.filter(id => id !== socketId);
        }
    }
    async getMatchQueue() {
        if (config_1.useInMemoryCache) {
            return [...inMemoryMatchQueue];
        }
        try {
            return await config_1.redisClient.lRange(this.MATCH_QUEUE_KEY, 0, -1);
        }
        catch {
            return [...inMemoryMatchQueue];
        }
    }
    async popMatchQueue(count) {
        if (config_1.useInMemoryCache) {
            const popped = inMemoryMatchQueue.slice(0, count);
            inMemoryMatchQueue = inMemoryMatchQueue.slice(count);
            return popped;
        }
        try {
            const popped = [];
            for (let i = 0; i < count; i++) {
                const sId = await config_1.redisClient.lPop(this.MATCH_QUEUE_KEY);
                if (sId) {
                    popped.push(sId);
                }
                else {
                    break;
                }
            }
            return popped;
        }
        catch {
            const popped = inMemoryMatchQueue.slice(0, count);
            inMemoryMatchQueue = inMemoryMatchQueue.slice(count);
            return popped;
        }
    }
}
exports.RedisRepository = RedisRepository;
