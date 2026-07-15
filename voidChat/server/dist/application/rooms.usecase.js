"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsUseCase = void 0;
class RoomsUseCase {
    cacheRepo;
    constructor(cacheRepo) {
        this.cacheRepo = cacheRepo;
    }
    async getActiveRooms() {
        return await this.cacheRepo.getTempRooms();
    }
    async createRoom(data) {
        const expiresAt = Date.now() + (data.durationMinutes * 60 * 1000);
        const room = {
            id: 'room_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            name: data.name.trim().slice(0, 30),
            type: data.type,
            durationMinutes: data.durationMinutes,
            expiresAt,
            createdBy: data.createdBy,
            createdAt: Date.now()
        };
        await this.cacheRepo.saveTempRoom(room);
        return room;
    }
    async deleteRoom(roomId) {
        await this.cacheRepo.deleteTempRoom(roomId);
    }
}
exports.RoomsUseCase = RoomsUseCase;
