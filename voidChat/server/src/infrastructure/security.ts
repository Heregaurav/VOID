import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
const Filter = require('bad-words');

const filter = new Filter();

export interface SessionPayload {
  deviceId: string;
  name: string;
  avatar: string;
}

export class JWTManager {
  static signToken(payload: SessionPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  }

  static verifyToken(token: string): SessionPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as SessionPayload;
    } catch {
      return null;
    }
  }
}

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  cleanedText: string;
}

export class AIModerationService {
  private static SCAM_KEYWORDS = [
    'cashapp', 'venmo', 'paypal', 'zelle', 'crypto', 'airdrop', 'free money', 
    'whatsapp investment', 'telegram channel', 'dm for details', 'earn easy cash',
    'make money fast', 'get rich', 'sugar daddy', 'onlyfans', 'investment advice'
  ];

  private static ABUSE_KEYWORDS = [
    'kys', 'retard', 'faggot', 'nigger', 'cunt', 'whore', 'slut', 'rape', 
    'kill yourself', 'hang yourself', 'beat you up', 'punch you'
  ];

  static moderateText(text: string): ModerationResult {
    const trimmed = text.trim();
    if (!trimmed) {
      return { flagged: false, cleanedText: '' };
    }

    const lower = trimmed.toLowerCase();

    // Check scam keywords
    for (const keyword of this.SCAM_KEYWORDS) {
      if (lower.includes(keyword)) {
        return {
          flagged: true,
          reason: 'scam',
          cleanedText: trimmed
        };
      }
    }

    // Check high abuse keywords
    for (const keyword of this.ABUSE_KEYWORDS) {
      if (lower.includes(keyword)) {
        return {
          flagged: true,
          reason: 'abuse',
          cleanedText: trimmed
        };
      }
    }

    // Standard profanity filter cleaning
    let cleanedText = trimmed;
    try {
      cleanedText = filter.clean(trimmed);
    } catch (e) {
      // fallback if bad-words errors out
    }

    // Heuristic checking if it was severely censored
    const starCount = (cleanedText.match(/\*/g) || []).length;
    const isTooBad = starCount > 0 && starCount / trimmed.length > 0.4; // > 40% stars is flagged

    return {
      flagged: isTooBad,
      reason: isTooBad ? 'profanity' : undefined,
      cleanedText
    };
  }

  static moderateImage(base64Image: string): { flagged: boolean; reason?: string } {
    // Simple heuristic analysis for mock AI moderation (NSFW check)
    // In production, you would run a TensorFlow model or call Gemini multimodal API
    if (!base64Image) return { flagged: false };
    
    // Simulating checking image sizes or content patterns
    if (base64Image.length > 3 * 1024 * 1024) {
      return { flagged: true, reason: 'Image payload is too large (>3MB)' };
    }
    
    // Mock moderation trigger for specific mock values or random (or safely assume unflagged)
    if (base64Image.includes('NSFW_MOCK_TRIGGER')) {
      return { flagged: true, reason: 'NSFW content detected' };
    }

    return { flagged: false };
  }
}
