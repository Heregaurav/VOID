"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedUseCase = void 0;
const security_1 = require("../infrastructure/security");
class FeedUseCase {
    dbRepo;
    constructor(dbRepo) {
        this.dbRepo = dbRepo;
    }
    // --- Posts ---
    async getPosts() {
        return await this.dbRepo.getPosts();
    }
    async createPost(data) {
        // 1. AI Moderation
        const modResult = security_1.AIModerationService.moderateText(data.content);
        if (modResult.flagged) {
            throw new Error(`Content flagged for moderation: ${modResult.reason}`);
        }
        if (data.imageUrl) {
            const imgMod = security_1.AIModerationService.moderateImage(data.imageUrl);
            if (imgMod.flagged) {
                throw new Error(`Image flagged for moderation: ${imgMod.reason}`);
            }
        }
        // 2. Setup Post
        const post = {
            id: 'post_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            content: modResult.cleanedText,
            imageUrl: data.imageUrl || null,
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            votes: 0,
            reactions: {},
            pollOptions: data.pollOptions || null,
            pollVotes: data.pollOptions ? data.pollOptions.reduce((acc, _, idx) => {
                acc[String(idx)] = [];
                return acc;
            }, {}) : null,
            createdAt: Date.now()
        };
        await this.dbRepo.createPost(post);
        // Reward for active contribution
        await this.dbRepo.upsertSoulRep(data.authorId, 2);
        return post;
    }
    async votePost(postId, delta, deviceId) {
        const post = await this.dbRepo.getPostById(postId);
        if (!post)
            throw new Error('Post not found');
        await this.dbRepo.votePost(postId, delta);
        // Update poster's reputation based on votes received
        await this.dbRepo.upsertSoulRep(post.authorId, delta > 0 ? 1 : -1);
        return post.votes + delta;
    }
    async reactPost(postId, reactionType, authorId) {
        return await this.dbRepo.reactPost(postId, reactionType, authorId);
    }
    async votePoll(postId, optionIdx, authorId) {
        return await this.dbRepo.votePoll(postId, optionIdx, authorId);
    }
    // --- Comments ---
    async getComments(postId) {
        return await this.dbRepo.getComments(postId);
    }
    async createComment(data) {
        const modResult = security_1.AIModerationService.moderateText(data.content);
        if (modResult.flagged) {
            throw new Error(`Content flagged for moderation: ${modResult.reason}`);
        }
        const comment = {
            id: 'cmt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            postId: data.postId,
            parentId: data.parentId || null,
            content: modResult.cleanedText,
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            reactions: {},
            createdAt: Date.now()
        };
        await this.dbRepo.createComment(comment);
        await this.dbRepo.upsertSoulRep(data.authorId, 1);
        return comment;
    }
    async reactComment(commentId, reactionType, authorId) {
        return await this.dbRepo.reactComment(commentId, reactionType, authorId);
    }
    // --- Confessions ---
    async getConfessions() {
        return await this.dbRepo.getConfessions();
    }
    async createConfession(text, authorId) {
        const modResult = security_1.AIModerationService.moderateText(text);
        if (modResult.flagged) {
            throw new Error(`Confession flagged: ${modResult.reason}`);
        }
        const confession = {
            id: 'conf_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            text: modResult.cleanedText,
            reactions: {},
            createdAt: Date.now()
        };
        await this.dbRepo.createConfession(confession);
        await this.dbRepo.upsertSoulRep(authorId, 1);
        return confession;
    }
    async reactConfession(confessionId, reactionType, authorId) {
        return await this.dbRepo.reactConfession(confessionId, reactionType, authorId);
    }
    // --- Memes ---
    async getMemes() {
        return await this.dbRepo.getMemes();
    }
    async createMeme(title, imageUrl, authorId) {
        const modResult = security_1.AIModerationService.moderateText(title);
        if (modResult.flagged) {
            throw new Error(`Meme text flagged: ${modResult.reason}`);
        }
        const imgMod = security_1.AIModerationService.moderateImage(imageUrl);
        if (imgMod.flagged) {
            throw new Error(`Meme image flagged: ${imgMod.reason}`);
        }
        const meme = {
            id: 'meme_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            title: modResult.cleanedText,
            imageUrl,
            reactions: {},
            createdAt: Date.now()
        };
        await this.dbRepo.createMeme(meme);
        await this.dbRepo.upsertSoulRep(authorId, 2);
        return meme;
    }
    async reactMeme(memeId, reactionType, authorId) {
        return await this.dbRepo.reactMeme(memeId, reactionType, authorId);
    }
    // --- Marketplace ---
    async getMarketplaceItems() {
        return await this.dbRepo.getMarketplaceItems();
    }
    async createMarketplaceItem(data) {
        const textMod = security_1.AIModerationService.moderateText(data.title + ' ' + data.description);
        if (textMod.flagged) {
            throw new Error(`Marketplace content flagged: ${textMod.reason}`);
        }
        const imgMod = security_1.AIModerationService.moderateImage(data.imageUrl);
        if (imgMod.flagged) {
            throw new Error(`Marketplace image flagged: ${imgMod.reason}`);
        }
        const item = {
            id: 'market_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            title: data.title,
            description: data.description,
            price: data.price,
            imageUrl: data.imageUrl,
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            contactInfo: data.contactInfo,
            status: 'active',
            createdAt: Date.now()
        };
        await this.dbRepo.createMarketplaceItem(item);
        await this.dbRepo.upsertSoulRep(data.authorId, 3);
        return item;
    }
    async updateMarketplaceItemStatus(itemId, status) {
        await this.dbRepo.updateMarketplaceItemStatus(itemId, status);
    }
    // --- Lost & Found ---
    async getLostFoundItems() {
        return await this.dbRepo.getLostFoundItems();
    }
    async createLostFoundItem(data) {
        const textMod = security_1.AIModerationService.moderateText(data.itemName + ' ' + data.description + ' ' + data.location);
        if (textMod.flagged) {
            throw new Error(`Lost & Found content flagged: ${textMod.reason}`);
        }
        if (data.imageUrl) {
            const imgMod = security_1.AIModerationService.moderateImage(data.imageUrl);
            if (imgMod.flagged) {
                throw new Error(`Lost & Found image flagged: ${imgMod.reason}`);
            }
        }
        const item = {
            id: 'lf_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
            type: data.type,
            itemName: data.itemName,
            description: data.description,
            location: data.location,
            imageUrl: data.imageUrl || null,
            authorId: data.authorId,
            authorName: data.authorName,
            authorAvatar: data.authorAvatar,
            contactInfo: data.contactInfo,
            status: 'active',
            createdAt: Date.now()
        };
        await this.dbRepo.createLostFoundItem(item);
        await this.dbRepo.upsertSoulRep(data.authorId, 3);
        return item;
    }
    async updateLostFoundItemStatus(itemId, status) {
        await this.dbRepo.updateLostFoundItemStatus(itemId, status);
    }
}
exports.FeedUseCase = FeedUseCase;
