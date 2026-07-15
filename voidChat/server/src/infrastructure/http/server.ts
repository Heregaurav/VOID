import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import client from 'prom-client';
import { FeedUseCase } from '../../application/feed.usecase';
import { PostgresRepository } from '../database';
import { JWTManager } from '../security';

// Prometheus setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Custom metrics
export const activeSoulsGauge = new client.Gauge({
  name: 'void_active_souls',
  help: 'Number of active souls online in the void'
});

export const activeMatchesGauge = new client.Gauge({
  name: 'void_active_matches',
  help: 'Number of active matchmaking pairs'
});

export const apiRequestDuration = new client.Histogram({
  name: 'void_api_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export function configureHttp(app: express.Express, feedUseCase: FeedUseCase, dbRepo: PostgresRepository) {
  // CORS & Security headers
  app.use(cors({ origin: '*' }));
  
  // Custom Helmet configuration to allow inline images and scanline filters
  app.use(
    helmet({
      contentSecurityPolicy: false, // Let reverse proxy handle CSP or relax for local development
      crossOriginEmbedderPolicy: false
    })
  );
  
  app.use(express.json({ limit: '10mb' }));

  // Request duration metric middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      apiRequestDuration.labels(req.method, req.route?.path || req.path, String(res.statusCode)).observe(duration);
    });
    next();
  });

  // Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { error: 'The mist is too thick. Slow down your steps.' }
  });
  app.use('/api/', globalLimiter);

  // File Upload Setup
  const uploadDir = path.join(__dirname, '../../public/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'void-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
  });

  // Serve uploads statically
  app.use('/uploads', express.static(uploadDir));

  // --- Identity pools ---
  const AVATARS = ['👻','💀','🕷️','🦇','🐺','🕯️','☠️','🩸','👁️','🪦','🕸️','🔮','🗡️','🩻','🪄','🌑'];
  const PREFIXES = ['WRAITH','PHANTOM','SPECTER','LICH','GHOUL','BANSHEE','REVENANT','SHADE','DREAD','OMEN','CURSE','DUSK','RAVEN','TOMB','CRYPT','ABYSS','REAPER','VOID','GRIMM','DIRGE'];

  function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomId(prefix: string): string { return prefix + '_' + Math.floor(Math.random() * 9999).toString().padStart(4, '0'); }

  // --- Auth Route (IIIT Dharwad email validation & hash registration) ---
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'College email is required.' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail.endsWith('@iiitdwd.ac.in')) {
        return res.status(400).json({ error: 'Access denied. You must use an @iiitdwd.ac.in email address.' });
      }

      // Generate a deterministic deviceId/soulId by hashing the email
      const deviceId = crypto
        .createHash('sha256')
        .update(trimmedEmail + '_void_dwd_salt_666')
        .digest('hex');

      // Check if user already has a session / reputation
      let rep = await dbRepo.getSoulRep(deviceId);
      if (!rep) {
        // Create base reputation
        rep = await dbRepo.upsertSoulRep(deviceId, 0);
      }

      const seed = parseInt(deviceId.slice(0, 8), 16);
      const avatarIdx = seed % AVATARS.length;
      const prefixIdx = (seed >> 3) % PREFIXES.length;
      const suffix = (seed >> 6) % 10000;

      const avatar = AVATARS[avatarIdx];
      const name = PREFIXES[prefixIdx] + '_' + String(suffix).padStart(4, '0');

      const token = JWTManager.signToken({ deviceId, name, avatar });

      return res.json({ token, identity: { name, avatar, deviceId }, reputation: rep });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Feed Routes ---
  app.get('/api/feed/posts', async (req: Request, res: Response) => {
    try {
      const posts = await feedUseCase.getPosts();
      return res.json(posts);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/feed/posts', upload.single('image'), async (req: Request, res: Response) => {
    try {
      const { content, authorId, authorName, authorAvatar, pollOptions } = req.body;
      let imageUrl = null;
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }

      const options = pollOptions ? JSON.parse(pollOptions) : null;

      const post = await feedUseCase.createPost({
        content,
        imageUrl,
        authorId,
        authorName,
        authorAvatar,
        pollOptions: options
      });

      return res.status(201).json(post);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/feed/posts/:id/vote', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { delta, deviceId } = req.body; // delta is +1 or -1
      const votes = await feedUseCase.votePost(id, delta, deviceId);
      return res.json({ votes });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/feed/posts/:id/react', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { reactionType, authorId } = req.body;
      const reactions = await feedUseCase.reactPost(id, reactionType, authorId);
      return res.json({ reactions });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/feed/posts/:id/poll/vote', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { optionIdx, authorId } = req.body;
      const pollVotes = await feedUseCase.votePoll(id, optionIdx, authorId);
      return res.json({ pollVotes });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // --- Comments Routes ---
  app.get('/api/feed/posts/:id/comments', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const comments = await feedUseCase.getComments(id);
      return res.json(comments);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/feed/posts/:id/comments', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { parentId, content, authorId, authorName, authorAvatar } = req.body;
      const comment = await feedUseCase.createComment({
        postId: id,
        parentId,
        content,
        authorId,
        authorName,
        authorAvatar
      });
      return res.status(201).json(comment);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // --- Confessions Routes ---
  app.get('/api/confessions', async (req: Request, res: Response) => {
    try {
      const confessions = await feedUseCase.getConfessions();
      return res.json(confessions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/confessions', async (req: Request, res: Response) => {
    try {
      const { text, authorId } = req.body;
      const confession = await feedUseCase.createConfession(text, authorId);
      return res.status(201).json(confession);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/confessions/:id/react', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { reactionType, authorId } = req.body;
      const reactions = await feedUseCase.reactConfession(id, reactionType, authorId);
      return res.json({ reactions });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // --- Memes Routes ---
  app.get('/api/memes', async (req: Request, res: Response) => {
    try {
      const memes = await feedUseCase.getMemes();
      return res.json(memes);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/memes', upload.single('image'), async (req: Request, res: Response) => {
    try {
      const { title, authorId } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: 'Meme image is required' });
      }
      const imageUrl = `/uploads/${req.file.filename}`;
      const meme = await feedUseCase.createMeme(title, imageUrl, authorId);
      return res.status(201).json(meme);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/memes/:id/react', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { reactionType, authorId } = req.body;
      const reactions = await feedUseCase.reactMeme(id, reactionType, authorId);
      return res.json({ reactions });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // --- Marketplace Routes ---
  app.get('/api/marketplace', async (req: Request, res: Response) => {
    try {
      const items = await feedUseCase.getMarketplaceItems();
      return res.json(items);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/marketplace', upload.single('image'), async (req: Request, res: Response) => {
    try {
      const { title, description, price, authorId, authorName, authorAvatar, contactInfo } = req.body;
      if (!req.file) {
        return res.status(400).json({ error: 'Item image is required' });
      }
      const imageUrl = `/uploads/${req.file.filename}`;
      const item = await feedUseCase.createMarketplaceItem({
        title,
        description,
        price: Number(price),
        imageUrl,
        authorId,
        authorName,
        authorAvatar,
        contactInfo
      });
      return res.status(201).json(item);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/marketplace/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body; // 'active' | 'sold'
      await feedUseCase.updateMarketplaceItemStatus(id, status);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // --- Lost & Found Routes ---
  app.get('/api/lostfound', async (req: Request, res: Response) => {
    try {
      const items = await feedUseCase.getLostFoundItems();
      return res.json(items);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/lostfound', upload.single('image'), async (req: Request, res: Response) => {
    try {
      const { type, itemName, description, location, authorId, authorName, authorAvatar, contactInfo } = req.body;
      let imageUrl = null;
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }
      const item = await feedUseCase.createLostFoundItem({
        type,
        itemName,
        description,
        location,
        imageUrl,
        authorId,
        authorName,
        authorAvatar,
        contactInfo
      });
      return res.status(201).json(item);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/lostfound/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body; // 'active' | 'resolved'
      await feedUseCase.updateLostFoundItemStatus(id, status);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // --- Soul Reputation ---
  app.get('/api/reputation/:deviceId', async (req: Request, res: Response) => {
    try {
      const deviceId = req.params.deviceId as string;
      const rep = await dbRepo.getSoulRep(deviceId);
      return res.json(rep || { deviceId, score: 0, badges: ['Lost Soul'], reportsCount: 0 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Metrics Endpoint ---
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      res.set('Content-Type', client.register.contentType);
      res.end(await client.register.metrics());
    } catch (err: any) {
      res.status(500).end(err);
    }
  });

  // --- Health Endpoint ---
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'alive' });
  });
}
