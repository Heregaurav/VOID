import { ICacheRepository } from '../domain/repositories';

export interface MatchResult {
  roomName: string;
  socket1: string;
  socket2: string;
}

export class MatchingUseCase {
  constructor(private cacheRepo: ICacheRepository) {}

  async enterQueue(socketId: string): Promise<void> {
    await this.cacheRepo.addToMatchQueue(socketId);
  }

  async leaveQueue(socketId: string): Promise<void> {
    await this.cacheRepo.removeFromMatchQueue(socketId);
  }

  async tryPairUsers(): Promise<MatchResult[]> {
    const queue = await this.cacheRepo.getMatchQueue();
    const pairs: MatchResult[] = [];

    // Process pairing
    while (queue.length >= 2) {
      const popped = await this.cacheRepo.popMatchQueue(2);
      if (popped.length < 2) {
        // If we popped less than 2, put them back if they exist
        for (const sId of popped) {
          await this.cacheRepo.addToMatchQueue(sId);
        }
        break;
      }
      
      const [s1, s2] = popped;
      const roomName = `match_${s1}_${s2}`;
      pairs.push({
        roomName,
        socket1: s1,
        socket2: s2
      });
    }

    return pairs;
  }
}
