import { Post, Comment, Confession, Meme, MarketplaceItem, LostFoundItem, TempRoom, SoulRep, Ban } from './entities';

export interface IDatabaseRepository {
  // Feed
  createPost(post: Post): Promise<void>;
  getPosts(): Promise<Post[]>;
  getPostById(id: string): Promise<Post | null>;
  votePost(postId: string, delta: number): Promise<void>;
  reactPost(postId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>>;
  votePoll(postId: string, optionIdx: number, authorId: string): Promise<Record<string, string[]>>;

  // Comments
  createComment(comment: Comment): Promise<void>;
  getComments(postId: string): Promise<Comment[]>;
  reactComment(commentId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>>;

  // Confessions
  createConfession(confession: Confession): Promise<void>;
  getConfessions(limit?: number): Promise<Confession[]>;
  reactConfession(confessionId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>>;

  // Memes
  createMeme(meme: Meme): Promise<void>;
  getMemes(): Promise<Meme[]>;
  reactMeme(memeId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>>;

  // Marketplace
  createMarketplaceItem(item: MarketplaceItem): Promise<void>;
  getMarketplaceItems(): Promise<MarketplaceItem[]>;
  updateMarketplaceItemStatus(itemId: string, status: 'active' | 'sold'): Promise<void>;

  // Lost & Found
  createLostFoundItem(item: LostFoundItem): Promise<void>;
  getLostFoundItems(): Promise<LostFoundItem[]>;
  updateLostFoundItemStatus(itemId: string, status: 'active' | 'resolved'): Promise<void>;

  // Reputation & Badges
  getSoulRep(deviceId: string): Promise<SoulRep | null>;
  upsertSoulRep(deviceId: string, scoreDelta: number, reportDelta?: number): Promise<SoulRep>;

  // Bans
  addBan(ip: string, deviceId: string, reason: string): Promise<void>;
  removeBan(ipOrDeviceIdOrId: string): Promise<void>;
  checkIsBanned(ip: string, deviceId: string): Promise<boolean>;
  getBansList(): Promise<Ban[]>;

  // Messages log
  saveChatMessage(msg: { id: string; room: string; authorId: string; avatar: string; name: string; text: string; imageUrl?: string | null; reactions: Record<string, string[]>; ts: number }): Promise<void>;
  getChatHistory(room: string, limit?: number): Promise<any[]>;
}

export interface ICacheRepository {
  // Socket sessions
  saveUserSession(socketId: string, session: any): Promise<void>;
  getUserSession(socketId: string): Promise<any | null>;
  deleteUserSession(socketId: string): Promise<void>;
  getAllUserSessions(): Promise<any[]>;

  // Temp Rooms
  saveTempRoom(room: TempRoom): Promise<void>;
  getTempRooms(): Promise<TempRoom[]>;
  deleteTempRoom(roomId: string): Promise<void>;

  // Matchmaking Queue
  addToMatchQueue(socketId: string): Promise<void>;
  removeFromMatchQueue(socketId: string): Promise<void>;
  getMatchQueue(): Promise<string[]>;
  popMatchQueue(count: number): Promise<string[]>;
}
