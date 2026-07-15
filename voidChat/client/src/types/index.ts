export interface Message {
  id: string;
  room: string;
  authorId: string;
  avatar: string;
  name: string;
  text: string;
  imageUrl?: string | null;
  reactions: Record<string, string[]>;
  ts: number;
  isSystem?: boolean;
}

export interface Partner {
  name: string;
  avatar: string;
}

export interface AdminUser {
  id: string;
  name: string;
  avatar: string;
  ipAddress: string;
  deviceId: string;
  currentRoom: string;
  status: string;
}

export interface AdminBan {
  id: number;
  ipAddress?: string;
  deviceId?: string;
  reason: string;
  createdAt: string | Date;
}

export interface Identity {
  name: string;
  avatar: string;
  deviceId: string;
}

export interface ToastType {
  id: number;
  text: string;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  votes: number;
  reactions: Record<string, string[]>;
  pollOptions?: string[] | null;
  pollVotes?: Record<string, string[]> | null;
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

