export interface UserSession {
  deviceId: string;
  name: string;
  avatar: string;
  ipAddress: string;
  socketId: string;
  status: string; // 'lobby', 'matching', 'paired', or room name
  currentRoom: string;
  partnerId: string | null;
  matchRoom: string | null;
  msgCount: number;
  windowStart: number;
  joinedAt: number;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  votes: number;
  reactions: Record<string, string[]>; // reactionType -> array of deviceIds/authorIds
  pollOptions?: string[] | null;
  pollVotes?: Record<string, string[]> | null; // optionIndex -> array of deviceIds
  createdAt: number;
}

export interface Comment {
  id: string;
  postId: string;
  parentId?: string | null;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  reactions: Record<string, string[]>;
  createdAt: number;
}

export interface Confession {
  id: string;
  text: string;
  reactions: Record<string, string[]>;
  createdAt: number;
}

export interface Meme {
  id: string;
  title: string;
  imageUrl: string;
  reactions: Record<string, string[]>;
  createdAt: number;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  contactInfo: string;
  status: 'active' | 'sold';
  createdAt: number;
}

export interface LostFoundItem {
  id: string;
  type: 'lost' | 'found';
  itemName: string;
  description: string;
  location: string;
  imageUrl?: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  contactInfo: string;
  status: 'active' | 'resolved';
  createdAt: number;
}

export interface TempRoom {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'video';
  durationMinutes: number;
  expiresAt: number;
  createdBy: string;
  createdAt: number;
}

export interface SoulRep {
  deviceId: string;
  score: number;
  badges: string[];
  reportsCount: number;
}

export interface Ban {
  id?: number;
  ipAddress?: string;
  deviceId?: string;
  reason: string;
  createdAt: Date;
}
