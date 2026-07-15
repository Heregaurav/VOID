import { ICacheRepository } from '../domain/repositories';
import { TempRoom } from '../domain/entities';

export class RoomsUseCase {
  constructor(private cacheRepo: ICacheRepository) {}

  async getActiveRooms(): Promise<TempRoom[]> {
    return await this.cacheRepo.getTempRooms();
  }

  async createRoom(data: { name: string; type: 'text' | 'voice' | 'video'; durationMinutes: number; createdBy: string }): Promise<TempRoom> {
    const expiresAt = Date.now() + (data.durationMinutes * 60 * 1000);
    const room: TempRoom = {
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

  async deleteRoom(roomId: string): Promise<void> {
    await this.cacheRepo.deleteTempRoom(roomId);
  }
}
