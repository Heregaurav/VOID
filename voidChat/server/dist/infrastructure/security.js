"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIModerationService = exports.JWTManager = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const Filter = require('bad-words');
const filter = new Filter();
class JWTManager {
    static signToken(payload) {
        return jsonwebtoken_1.default.sign(payload, config_1.JWT_SECRET, { expiresIn: '30d' });
    }
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
        }
        catch {
            return null;
        }
    }
}
exports.JWTManager = JWTManager;
class AIModerationService {
    static SCAM_KEYWORDS = [
        'cashapp', 'venmo', 'paypal', 'zelle', 'crypto', 'airdrop', 'free money',
        'whatsapp investment', 'telegram channel', 'dm for details', 'earn easy cash',
        'make money fast', 'get rich', 'sugar daddy', 'onlyfans', 'investment advice'
    ];
    static ABUSE_KEYWORDS = [
        'kys', 'retard', 'faggot', 'nigger', 'cunt', 'whore', 'slut', 'rape',
        'kill yourself', 'hang yourself', 'beat you up', 'punch you'
    ];
    static moderateText(text) {
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
        }
        catch (e) {
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
    static moderateImage(base64Image) {
        // Simple heuristic analysis for mock AI moderation (NSFW check)
        // In production, you would run a TensorFlow model or call Gemini multimodal API
        if (!base64Image)
            return { flagged: false };
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
exports.AIModerationService = AIModerationService;
