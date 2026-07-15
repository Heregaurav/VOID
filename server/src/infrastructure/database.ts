import { pool, useInMemoryDb } from '../config';
import { IDatabaseRepository } from '../domain/repositories';
import { Post, Comment, Confession, Meme, MarketplaceItem, LostFoundItem, SoulRep, Ban } from '../domain/entities';

// In-memory fallbacks
let inMemoryMessages: any[] = [];
let inMemoryBans: Ban[] = [];
let inMemoryPosts: Post[] = [];
let inMemoryComments: Comment[] = [];
let inMemoryConfessions: Confession[] = [];
let inMemoryMemes: Meme[] = [];
let inMemoryMarketplace: MarketplaceItem[] = [];
let inMemoryLostFound: LostFoundItem[] = [];
let inMemoryReputations: Record<string, SoulRep> = {};

export class PostgresRepository implements IDatabaseRepository {
  
  async initDb(): Promise<void> {
    if (useInMemoryDb) {
      console.log('⚠️ Running in-memory database mode.');
      return;
    }

    try {
      // 1. Messages table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_messages (
          id TEXT PRIMARY KEY,
          room TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_avatar TEXT NOT NULL,
          author_name TEXT NOT NULL,
          text TEXT NOT NULL,
          image_url TEXT,
          reactions JSONB NOT NULL DEFAULT '{}',
          ts BIGINT NOT NULL
        );
      `);

      // 2. Bans table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_bans (
          id SERIAL PRIMARY KEY,
          ip_address TEXT,
          device_id TEXT,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Posts table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_posts (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          image_url TEXT,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_avatar TEXT NOT NULL,
          votes INTEGER NOT NULL DEFAULT 0,
          reactions JSONB NOT NULL DEFAULT '{}',
          poll_options JSONB DEFAULT NULL,
          poll_votes JSONB DEFAULT NULL,
          created_at BIGINT NOT NULL
        );
      `);

      // 4. Comments table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_comments (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL REFERENCES void_posts(id) ON DELETE CASCADE,
          parent_id TEXT,
          content TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_avatar TEXT NOT NULL,
          reactions JSONB NOT NULL DEFAULT '{}',
          created_at BIGINT NOT NULL
        );
      `);

      // 5. Confessions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_confessions (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          reactions JSONB NOT NULL DEFAULT '{}',
          created_at BIGINT NOT NULL
        );
      `);

      // 6. Memes table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_memes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          image_url TEXT NOT NULL,
          reactions JSONB NOT NULL DEFAULT '{}',
          created_at BIGINT NOT NULL
        );
      `);

      // 7. Marketplace table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_marketplace (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          price NUMERIC NOT NULL,
          image_url TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_avatar TEXT NOT NULL,
          contact_info TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at BIGINT NOT NULL
        );
      `);

      // 8. Lost & Found table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_lost_found (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          item_name TEXT NOT NULL,
          description TEXT NOT NULL,
          location TEXT NOT NULL,
          image_url TEXT,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          author_avatar TEXT NOT NULL,
          contact_info TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at BIGINT NOT NULL
        );
      `);

      // 9. Reputations table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS void_reputations (
          device_id TEXT PRIMARY KEY,
          score INTEGER NOT NULL DEFAULT 0,
          badges TEXT[] NOT NULL DEFAULT '{}',
          reports_count INTEGER NOT NULL DEFAULT 0
        );
      `);

      console.log('✅ PostgreSQL database tables checked/created.');
    } catch (err) {
      console.error('❌ Failed to run database migrations:', err);
      // Fallback on error
      console.warn('⚠️ Falling back to in-memory database mode due to initialization error.');
      (global as any).useInMemoryDb = true; // set globally for this execution context
    }
  }

  // --- Feed posts ---
  async createPost(post: Post): Promise<void> {
    if (useInMemoryDb) {
      inMemoryPosts.unshift(post);
      return;
    }

    await pool.query(
      `INSERT INTO void_posts (id, content, image_url, author_id, author_name, author_avatar, votes, reactions, poll_options, poll_votes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        post.id,
        post.content,
        post.imageUrl || null,
        post.authorId,
        post.authorName,
        post.authorAvatar,
        post.votes,
        JSON.stringify(post.reactions),
        post.pollOptions ? JSON.stringify(post.pollOptions) : null,
        post.pollVotes ? JSON.stringify(post.pollVotes) : null,
        post.createdAt
      ]
    );
  }

  async getPosts(): Promise<Post[]> {
    if (useInMemoryDb) {
      return [...inMemoryPosts];
    }

    const res = await pool.query(`SELECT * FROM void_posts ORDER BY created_at DESC LIMIT 100`);
    return res.rows.map(row => ({
      id: row.id,
      content: row.content,
      imageUrl: row.image_url,
      authorId: row.author_id,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      votes: row.votes,
      reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions) : (row.reactions || {}),
      pollOptions: row.poll_options ? (typeof row.poll_options === 'string' ? JSON.parse(row.poll_options) : row.poll_options) : null,
      pollVotes: row.poll_votes ? (typeof row.poll_votes === 'string' ? JSON.parse(row.poll_votes) : row.poll_votes) : null,
      createdAt: Number(row.created_at)
    }));
  }

  async getPostById(id: string): Promise<Post | null> {
    if (useInMemoryDb) {
      return inMemoryPosts.find(p => p.id === id) || null;
    }

    const res = await pool.query(`SELECT * FROM void_posts WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      content: row.content,
      imageUrl: row.image_url,
      authorId: row.author_id,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      votes: row.votes,
      reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions) : (row.reactions || {}),
      pollOptions: row.poll_options ? (typeof row.poll_options === 'string' ? JSON.parse(row.poll_options) : row.poll_options) : null,
      pollVotes: row.poll_votes ? (typeof row.poll_votes === 'string' ? JSON.parse(row.poll_votes) : row.poll_votes) : null,
      createdAt: Number(row.created_at)
    };
  }

  async votePost(postId: string, delta: number): Promise<void> {
    if (useInMemoryDb) {
      const post = inMemoryPosts.find(p => p.id === postId);
      if (post) {
        post.votes += delta;
      }
      return;
    }

    await pool.query(`UPDATE void_posts SET votes = votes + $1 WHERE id = $2`, [delta, postId]);
  }

  async reactPost(postId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    if (useInMemoryDb) {
      const post = inMemoryPosts.find(p => p.id === postId);
      if (!post) return {};
      if (!post.reactions) post.reactions = {};
      if (!post.reactions[reactionType]) post.reactions[reactionType] = [];
      const idx = post.reactions[reactionType].indexOf(authorId);
      if (idx > -1) {
        post.reactions[reactionType].splice(idx, 1);
      } else {
        post.reactions[reactionType].push(authorId);
      }
      return post.reactions;
    }

    const res = await pool.query(`SELECT reactions FROM void_posts WHERE id = $1`, [postId]);
    if (res.rows.length === 0) return {};
    let reactions = typeof res.rows[0].reactions === 'string' ? JSON.parse(res.rows[0].reactions) : (res.rows[0].reactions || {});
    if (!reactions[reactionType]) reactions[reactionType] = [];
    
    const idx = reactions[reactionType].indexOf(authorId);
    if (idx > -1) {
      reactions[reactionType].splice(idx, 1);
    } else {
      reactions[reactionType].push(authorId);
    }
    await pool.query(`UPDATE void_posts SET reactions = $1 WHERE id = $2`, [JSON.stringify(reactions), postId]);
    return reactions;
  }

  async votePoll(postId: string, optionIdx: number, authorId: string): Promise<Record<string, string[]>> {
    if (useInMemoryDb) {
      const post = inMemoryPosts.find(p => p.id === postId);
      if (!post || !post.pollVotes) return {};
      for (const key in post.pollVotes) {
        post.pollVotes[key] = (post.pollVotes[key] || []).filter((uid: string) => uid !== authorId);
      }
      const key = String(optionIdx);
      if (!post.pollVotes[key]) post.pollVotes[key] = [];
      post.pollVotes[key].push(authorId);
      return post.pollVotes;
    }

    const res = await pool.query(`SELECT poll_votes FROM void_posts WHERE id = $1`, [postId]);
    if (res.rows.length === 0) return {};
    let pollVotes = typeof res.rows[0].poll_votes === 'string' ? JSON.parse(res.rows[0].poll_votes) : (res.rows[0].poll_votes || {});
    
    // Clear user's previous votes on this poll
    for (const key in pollVotes) {
      pollVotes[key] = (pollVotes[key] || []).filter((uid: string) => uid !== authorId);
    }

    const key = String(optionIdx);
    if (!pollVotes[key]) pollVotes[key] = [];
    pollVotes[key].push(authorId);

    await pool.query(`UPDATE void_posts SET poll_votes = $1 WHERE id = $2`, [JSON.stringify(pollVotes), postId]);
    return pollVotes;
  }

  // --- Comments ---
  async createComment(comment: Comment): Promise<void> {
    if (useInMemoryDb) {
      inMemoryComments.push(comment);
      return;
    }

    await pool.query(
      `INSERT INTO void_comments (id, post_id, parent_id, content, author_id, author_name, author_avatar, reactions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        comment.id,
        comment.postId,
        comment.parentId || null,
        comment.content,
        comment.authorId,
        comment.authorName,
        comment.authorAvatar,
        JSON.stringify(comment.reactions),
        comment.createdAt
      ]
    );
  }

  async getComments(postId: string): Promise<Comment[]> {
    if (useInMemoryDb) {
      return inMemoryComments.filter(c => c.postId === postId);
    }

    const res = await pool.query(`SELECT * FROM void_comments WHERE post_id = $1 ORDER BY created_at ASC`, [postId]);
    return res.rows.map(row => ({
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      content: row.content,
      authorId: row.author_id,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions) : (row.reactions || {}),
      createdAt: Number(row.created_at)
    }));
  }

  async reactComment(commentId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    if (useInMemoryDb) {
      const comment = inMemoryComments.find(c => c.id === commentId);
      if (!comment) return {};
      if (!comment.reactions) comment.reactions = {};
      if (!comment.reactions[reactionType]) comment.reactions[reactionType] = [];
      const idx = comment.reactions[reactionType].indexOf(authorId);
      if (idx > -1) {
        comment.reactions[reactionType].splice(idx, 1);
      } else {
        comment.reactions[reactionType].push(authorId);
      }
      return comment.reactions;
    }

    const res = await pool.query(`SELECT reactions FROM void_comments WHERE id = $1`, [commentId]);
    if (res.rows.length === 0) return {};
    let reactions = typeof res.rows[0].reactions === 'string' ? JSON.parse(res.rows[0].reactions) : (res.rows[0].reactions || {});
    if (!reactions[reactionType]) reactions[reactionType] = [];
    
    const idx = reactions[reactionType].indexOf(authorId);
    if (idx > -1) {
      reactions[reactionType].splice(idx, 1);
    } else {
      reactions[reactionType].push(authorId);
    }
    await pool.query(`UPDATE void_comments SET reactions = $1 WHERE id = $2`, [JSON.stringify(reactions), commentId]);
    return reactions;
  }

  // --- Confessions ---
  async createConfession(confession: Confession): Promise<void> {
    if (useInMemoryDb) {
      inMemoryConfessions.unshift(confession);
      return;
    }

    await pool.query(
      `INSERT INTO void_confessions (id, text, reactions, created_at) VALUES ($1, $2, $3, $4)`,
      [confession.id, confession.text, JSON.stringify(confession.reactions), confession.createdAt]
    );
  }

  async getConfessions(limit: number = 50): Promise<Confession[]> {
    if (useInMemoryDb) {
      return inMemoryConfessions.slice(0, limit);
    }

    const res = await pool.query(`SELECT * FROM void_confessions ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows.map(row => ({
      id: row.id,
      text: row.text,
      reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions) : (row.reactions || {}),
      createdAt: Number(row.created_at)
    }));
  }

  async reactConfession(confessionId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    if (useInMemoryDb) {
      const confession = inMemoryConfessions.find(c => c.id === confessionId);
      if (!confession) return {};
      if (!confession.reactions) confession.reactions = {};
      if (!confession.reactions[reactionType]) confession.reactions[reactionType] = [];
      const idx = confession.reactions[reactionType].indexOf(authorId);
      if (idx > -1) {
        confession.reactions[reactionType].splice(idx, 1);
      } else {
        confession.reactions[reactionType].push(authorId);
      }
      return confession.reactions;
    }

    const res = await pool.query(`SELECT reactions FROM void_confessions WHERE id = $1`, [confessionId]);
    if (res.rows.length === 0) return {};
    let reactions = typeof res.rows[0].reactions === 'string' ? JSON.parse(res.rows[0].reactions) : (res.rows[0].reactions || {});
    if (!reactions[reactionType]) reactions[reactionType] = [];

    const idx = reactions[reactionType].indexOf(authorId);
    if (idx > -1) {
      reactions[reactionType].splice(idx, 1);
    } else {
      reactions[reactionType].push(authorId);
    }
    await pool.query(`UPDATE void_confessions SET reactions = $1 WHERE id = $2`, [JSON.stringify(reactions), confessionId]);
    return reactions;
  }

  // --- Memes ---
  async createMeme(meme: Meme): Promise<void> {
    if (useInMemoryDb) {
      inMemoryMemes.unshift(meme);
      return;
    }

    await pool.query(
      `INSERT INTO void_memes (id, title, image_url, reactions, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [meme.id, meme.title, meme.imageUrl, JSON.stringify(meme.reactions), meme.createdAt]
    );
  }

  async getMemes(): Promise<Meme[]> {
    if (useInMemoryDb) {
      return [...inMemoryMemes];
    }

    const res = await pool.query(`SELECT * FROM void_memes ORDER BY created_at DESC LIMIT 50`);
    return res.rows.map(row => ({
      id: row.id,
      title: row.title,
      imageUrl: row.image_url,
      reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions) : (row.reactions || {}),
      createdAt: Number(row.created_at)
    }));
  }

  async reactMeme(memeId: string, reactionType: string, authorId: string): Promise<Record<string, string[]>> {
    if (useInMemoryDb) {
      const meme = inMemoryMemes.find(m => m.id === memeId);
      if (!meme) return {};
      if (!meme.reactions) meme.reactions = {};
      if (!meme.reactions[reactionType]) meme.reactions[reactionType] = [];
      const idx = meme.reactions[reactionType].indexOf(authorId);
      if (idx > -1) {
        meme.reactions[reactionType].splice(idx, 1);
      } else {
        meme.reactions[reactionType].push(authorId);
      }
      return meme.reactions;
    }

    const res = await pool.query(`SELECT reactions FROM void_memes WHERE id = $1`, [memeId]);
    if (res.rows.length === 0) return {};
    let reactions = typeof res.rows[0].reactions === 'string' ? JSON.parse(res.rows[0].reactions) : (res.rows[0].reactions || {});
    if (!reactions[reactionType]) reactions[reactionType] = [];

    const idx = reactions[reactionType].indexOf(authorId);
    if (idx > -1) {
      reactions[reactionType].splice(idx, 1);
    } else {
      reactions[reactionType].push(authorId);
    }
    await pool.query(`UPDATE void_memes SET reactions = $1 WHERE id = $2`, [JSON.stringify(reactions), memeId]);
    return reactions;
  }

  // --- Marketplace ---
  async createMarketplaceItem(item: MarketplaceItem): Promise<void> {
    if (useInMemoryDb) {
      inMemoryMarketplace.unshift(item);
      return;
    }

    await pool.query(
      `INSERT INTO void_marketplace (id, title, description, price, image_url, author_id, author_name, author_avatar, contact_info, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [item.id, item.title, item.description, item.price, item.imageUrl, item.authorId, item.authorName, item.authorAvatar, item.contactInfo, item.status, item.createdAt]
    );
  }

  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
    if (useInMemoryDb) {
      return [...inMemoryMarketplace];
    }

    const res = await pool.query(`SELECT * FROM void_marketplace ORDER BY created_at DESC LIMIT 100`);
    return res.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      price: Number(row.price),
      imageUrl: row.image_url,
      authorId: row.author_id,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      contactInfo: row.contact_info,
      status: row.status as 'active' | 'sold',
      createdAt: Number(row.created_at)
    }));
  }

  async updateMarketplaceItemStatus(itemId: string, status: 'active' | 'sold'): Promise<void> {
    if (useInMemoryDb) {
      const item = inMemoryMarketplace.find(i => i.id === itemId);
      if (item) item.status = status;
      return;
    }

    await pool.query(`UPDATE void_marketplace SET status = $1 WHERE id = $2`, [status, itemId]);
  }

  // --- Lost & Found ---
  async createLostFoundItem(item: LostFoundItem): Promise<void> {
    if (useInMemoryDb) {
      inMemoryLostFound.unshift(item);
      return;
    }

    await pool.query(
      `INSERT INTO void_lost_found (id, type, item_name, description, location, image_url, author_id, author_name, author_avatar, contact_info, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [item.id, item.type, item.itemName, item.description, item.location, item.imageUrl || null, item.authorId, item.authorName, item.authorAvatar, item.contactInfo, item.status, item.createdAt]
    );
  }

  async getLostFoundItems(): Promise<LostFoundItem[]> {
    if (useInMemoryDb) {
      return [...inMemoryLostFound];
    }

    const res = await pool.query(`SELECT * FROM void_lost_found ORDER BY created_at DESC LIMIT 100`);
    return res.rows.map(row => ({
      id: row.id,
      type: row.type as 'lost' | 'found',
      itemName: row.item_name,
      description: row.description,
      location: row.location,
      imageUrl: row.image_url,
      authorId: row.author_id,
      authorName: row.author_name,
      authorAvatar: row.author_avatar,
      contactInfo: row.contact_info,
      status: row.status as 'active' | 'resolved',
      createdAt: Number(row.created_at)
    }));
  }

  async updateLostFoundItemStatus(itemId: string, status: 'active' | 'resolved'): Promise<void> {
    if (useInMemoryDb) {
      const item = inMemoryLostFound.find(i => i.id === itemId);
      if (item) item.status = status;
      return;
    }

    await pool.query(`UPDATE void_lost_found SET status = $1 WHERE id = $2`, [status, itemId]);
  }

  // --- Reputation & Badges ---
  async getSoulRep(deviceId: string): Promise<SoulRep | null> {
    if (useInMemoryDb) {
      return inMemoryReputations[deviceId] || null;
    }

    const res = await pool.query(`SELECT * FROM void_reputations WHERE device_id = $1`, [deviceId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      deviceId: row.device_id,
      score: row.score,
      badges: row.badges || [],
      reportsCount: row.reports_count
    };
  }

  async upsertSoulRep(deviceId: string, scoreDelta: number, reportDelta: number = 0): Promise<SoulRep> {
    if (useInMemoryDb) {
      let rep = inMemoryReputations[deviceId];
      if (!rep) {
        const score = Math.max(0, 10 + scoreDelta);
        rep = {
          deviceId,
          score,
          badges: this.calculateBadges(score),
          reportsCount: reportDelta
        };
      } else {
        const score = Math.max(0, rep.score + scoreDelta);
        rep = {
          deviceId,
          score,
          badges: this.calculateBadges(score),
          reportsCount: rep.reportsCount + reportDelta
        };
      }
      inMemoryReputations[deviceId] = rep;
      return rep;
    }

    const rep = await this.getSoulRep(deviceId);
    if (!rep) {
      const score = Math.max(0, 10 + scoreDelta); // start reputation at 10
      const badges = this.calculateBadges(score);
      const insertRes = await pool.query(
        `INSERT INTO void_reputations (device_id, score, badges, reports_count)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [deviceId, score, badges, reportDelta]
      );
      const row = insertRes.rows[0];
      return {
        deviceId: row.device_id,
        score: row.score,
        badges: row.badges || [],
        reportsCount: row.reports_count
      };
    } else {
      const newScore = Math.max(0, rep.score + scoreDelta);
      const newReports = rep.reportsCount + reportDelta;
      const newBadges = this.calculateBadges(newScore);
      const updateRes = await pool.query(
        `UPDATE void_reputations
         SET score = $1, badges = $2, reports_count = $3
         WHERE device_id = $4
         RETURNING *`,
        [newScore, newBadges, newReports, deviceId]
      );
      const row = updateRes.rows[0];
      return {
        deviceId: row.device_id,
        score: row.score,
        badges: row.badges || [],
        reportsCount: row.reports_count
      };
    }
  }

  private calculateBadges(score: number): string[] {
    const badges: string[] = ['Lost Soul']; // base badge
    if (score >= 30) badges.push('Lurker in Fog');
    if (score >= 60) badges.push('Cursed Whisperer');
    if (score >= 100) badges.push('Void Walker');
    if (score >= 150) badges.push('Eerie Specter');
    return badges;
  }

  // --- Bans ---
  async addBan(ip: string, deviceId: string, reason: string): Promise<void> {
    if (useInMemoryDb) {
      inMemoryBans.unshift({ ipAddress: ip, deviceId, reason, createdAt: new Date() });
      return;
    }

    await pool.query(
      `INSERT INTO void_bans (ip_address, device_id, reason) VALUES ($1, $2, $3)`,
      [ip || null, deviceId || null, reason]
    );
  }

  async removeBan(ipOrDeviceIdOrId: string): Promise<void> {
    if (useInMemoryDb) {
      inMemoryBans = inMemoryBans.filter(ban =>
        ban.ipAddress !== ipOrDeviceIdOrId &&
        ban.deviceId !== ipOrDeviceIdOrId &&
        String(ban.id) !== ipOrDeviceIdOrId
      );
      return;
    }

    await pool.query(
      `DELETE FROM void_bans WHERE id::text = $1 OR ip_address = $1 OR device_id = $1`,
      [ipOrDeviceIdOrId]
    );
  }

  async checkIsBanned(ip: string, deviceId: string): Promise<boolean> {
    if (useInMemoryDb) {
      return inMemoryBans.some(ban => ban.ipAddress === ip || ban.deviceId === deviceId);
    }

    const res = await pool.query(
      `SELECT * FROM void_bans WHERE ip_address = $1 OR device_id = $2`,
      [ip, deviceId]
    );
    return res.rows.length > 0;
  }

  async getBansList(): Promise<Ban[]> {
    if (useInMemoryDb) {
      return [...inMemoryBans].map((b, i) => ({ ...b, id: i + 1 }));
    }

    const res = await pool.query(`SELECT * FROM void_bans ORDER BY created_at DESC`);
    return res.rows.map(row => ({
      id: row.id,
      ipAddress: row.ip_address,
      deviceId: row.device_id,
      reason: row.reason,
      createdAt: row.created_at
    }));
  }

  // --- Message history ---
  async saveChatMessage(msg: { id: string; room: string; authorId: string; avatar: string; name: string; text: string; imageUrl?: string | null; reactions: Record<string, string[]>; ts: number }): Promise<void> {
    if (useInMemoryDb) {
      inMemoryMessages.push(msg);
      return;
    }

    await pool.query(
      `INSERT INTO void_messages (id, room, author_id, author_avatar, author_name, text, image_url, reactions, ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [msg.id, msg.room, msg.authorId, msg.avatar, msg.name, msg.text, msg.imageUrl || null, JSON.stringify(msg.reactions), msg.ts]
    );
  }

  async getChatHistory(room: string, limit: number = 50): Promise<any[]> {
    if (useInMemoryDb) {
      return inMemoryMessages.filter(m => m.room === room).slice(-limit);
    }

    const res = await pool.query(
      `SELECT * FROM void_messages WHERE room = $1 ORDER BY ts ASC LIMIT $2`,
      [room, limit]
    );
    return res.rows.map(row => ({
      id: row.id,
      room: row.room,
      authorId: row.author_id,
      avatar: row.author_avatar,
      name: row.author_name,
      text: row.text,
      imageUrl: row.image_url,
      reactions: typeof row.reactions === 'string' ? JSON.parse(row.reactions) : (row.reactions || {}),
      ts: Number(row.ts)
    }));
  }
}
