import { IDatabaseRepository } from '../domain/repositories';
import { Post, Comment, Confession, Meme, MarketplaceItem, LostFoundItem } from '../domain/entities';
import { AIModerationService } from '../infrastructure/security';

export class FeedUseCase {
  constructor(private dbRepo: IDatabaseRepository) {}

  // --- Posts ---
  async getPosts(): Promise<Post[]> {
    return await this.dbRepo.getPosts();
  }

  async createPost(data: { content: string; imageUrl?: string | null; authorId: string; authorName: string; authorAvatar: string; pollOptions?: string[] | null }): Promise<Post> {
    // 1. AI Moderation
    const modResult = AIModerationService.moderateText(data.content);
    if (modResult.flagged) {
      throw new Error(`Content flagged for moderation: ${modResult.reason}`);
    }

    if (data.imageUrl) {
      const imgMod = AIModerationService.moderateImage(data.imageUrl);
      if (imgMod.flagged) {
        throw new Error(`Image flagged for moderation: ${imgMod.reason}`);
      }
    }

    // 2. Setup Post
    const post: Post = {
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
      }, {} as Record<string, string[]>) : null,
      createdAt: Date.now()
    };

    await this.dbRepo.createPost(post);
    
    // Reward for active contribution
    await this.dbRepo.upsertSoulRep(data.authorId, 2);

    return post;
  }

  async votePost(postId: string, delta: number, deviceId: string): Promise<number> {
    const post = await this.dbRepo.getPostById(postId);
    if (!post) throw new Error('Post not found');
    
    await this.dbRepo.votePost(postId, delta);
    
    // Update poster's reputation based on votes received
    await this.dbRepo.upsertSoulRep(post.authorId, delta > 0 ? 1 : -1);
    
    return post.votes + delta;
  }

  async reactPost(postId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    return await this.dbRepo.reactPost(postId, reactionType, authorId);
  }

  async votePoll(postId: string, optionIdx: number, authorId: string): Promise<Record<string, string[]>> {
    return await this.dbRepo.votePoll(postId, optionIdx, authorId);
  }

  // --- Comments ---
  async getComments(postId: string): Promise<Comment[]> {
    return await this.dbRepo.getComments(postId);
  }

  async createComment(data: { postId: string; parentId?: string | null; content: string; authorId: string; authorName: string; authorAvatar: string }): Promise<Comment> {
    const modResult = AIModerationService.moderateText(data.content);
    if (modResult.flagged) {
      throw new Error(`Content flagged for moderation: ${modResult.reason}`);
    }

    const comment: Comment = {
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

  async reactComment(commentId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    return await this.dbRepo.reactComment(commentId, reactionType, authorId);
  }

  // --- Confessions ---
  async getConfessions(): Promise<Confession[]> {
    return await this.dbRepo.getConfessions();
  }

  async createConfession(text: string, authorId: string): Promise<Confession> {
    const modResult = AIModerationService.moderateText(text);
    if (modResult.flagged) {
      throw new Error(`Confession flagged: ${modResult.reason}`);
    }

    const confession: Confession = {
      id: 'conf_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      text: modResult.cleanedText,
      reactions: {},
      createdAt: Date.now()
    };

    await this.dbRepo.createConfession(confession);
    await this.dbRepo.upsertSoulRep(authorId, 1);
    return confession;
  }

  async reactConfession(confessionId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    return await this.dbRepo.reactConfession(confessionId, reactionType, authorId);
  }

  // --- Memes ---
  async getMemes(): Promise<Meme[]> {
    return await this.dbRepo.getMemes();
  }

  async createMeme(title: string, imageUrl: string, authorId: string): Promise<Meme> {
    const modResult = AIModerationService.moderateText(title);
    if (modResult.flagged) {
      throw new Error(`Meme text flagged: ${modResult.reason}`);
    }

    const imgMod = AIModerationService.moderateImage(imageUrl);
    if (imgMod.flagged) {
      throw new Error(`Meme image flagged: ${imgMod.reason}`);
    }

    const meme: Meme = {
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

  async reactMeme(memeId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    return await this.dbRepo.reactMeme(memeId, reactionType, authorId);
  }

  // --- Marketplace ---
  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
    return await this.dbRepo.getMarketplaceItems();
  }

  async createMarketplaceItem(data: { title: string; description: string; price: number; imageUrl: string; authorId: string; authorName: string; authorAvatar: string; contactInfo: string }): Promise<MarketplaceItem> {
    const textMod = AIModerationService.moderateText(data.title + ' ' + data.description);
    if (textMod.flagged) {
      throw new Error(`Marketplace content flagged: ${textMod.reason}`);
    }

    const imgMod = AIModerationService.moderateImage(data.imageUrl);
    if (imgMod.flagged) {
      throw new Error(`Marketplace image flagged: ${imgMod.reason}`);
    }

    const item: MarketplaceItem = {
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

  async updateMarketplaceItemStatus(itemId: string, status: 'active' | 'sold'): Promise<void> {
    await this.dbRepo.updateMarketplaceItemStatus(itemId, status);
  }

  // --- Lost & Found ---
  async getLostFoundItems(): Promise<LostFoundItem[]> {
    return await this.dbRepo.getLostFoundItems();
  }

  async createLostFoundItem(data: { type: 'lost' | 'found'; itemName: string; description: string; location: string; imageUrl?: string | null; authorId: string; authorName: string; authorAvatar: string; contactInfo: string }): Promise<LostFoundItem> {
    const textMod = AIModerationService.moderateText(data.itemName + ' ' + data.description + ' ' + data.location);
    if (textMod.flagged) {
      throw new Error(`Lost & Found content flagged: ${textMod.reason}`);
    }

    if (data.imageUrl) {
      const imgMod = AIModerationService.moderateImage(data.imageUrl);
      if (imgMod.flagged) {
        throw new Error(`Lost & Found image flagged: ${imgMod.reason}`);
      }
    }

    const item: LostFoundItem = {
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

  async updateLostFoundItemStatus(itemId: string, status: 'active' | 'resolved'): Promise<void> {
    await this.dbRepo.updateLostFoundItemStatus(itemId, status);
  }
}
