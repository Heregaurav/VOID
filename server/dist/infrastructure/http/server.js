"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRequestDuration = exports.activeMatchesGauge = exports.activeSoulsGauge = void 0;
exports.configureHttp = configureHttp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const crypto_1 = __importDefault(require("crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prom_client_1 = __importDefault(require("prom-client"));
const security_1 = require("../security");
// Prometheus setup
const collectDefaultMetrics = prom_client_1.default.collectDefaultMetrics;
collectDefaultMetrics({ register: prom_client_1.default.register });
// Custom metrics
exports.activeSoulsGauge = new prom_client_1.default.Gauge({
    name: 'void_active_souls',
    help: 'Number of active souls online in the void'
});
exports.activeMatchesGauge = new prom_client_1.default.Gauge({
    name: 'void_active_matches',
    help: 'Number of active matchmaking pairs'
});
exports.apiRequestDuration = new prom_client_1.default.Histogram({
    name: 'void_api_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
});
function configureHttp(app, feedUseCase, dbRepo) {
    // CORS & Security headers
    app.use((0, cors_1.default)({ origin: '*' }));
    // Custom Helmet configuration to allow inline images and scanline filters
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false, // Let reverse proxy handle CSP or relax for local development
        crossOriginEmbedderPolicy: false
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    // Request duration metric middleware
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            exports.apiRequestDuration.labels(req.method, req.route?.path || req.path, String(res.statusCode)).observe(duration);
        });
        next();
    });
    // Rate Limiting
    const globalLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per window
        message: { error: 'The mist is too thick. Slow down your steps.' }
    });
    app.use('/api/', globalLimiter);
    // File Upload Setup
    const uploadDir = path_1.default.join(__dirname, '../../public/uploads');
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, 'void-' + uniqueSuffix + path_1.default.extname(file.originalname));
        }
    });
    const upload = (0, multer_1.default)({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
    });
    // Serve uploads statically
    app.use('/uploads', express_1.default.static(uploadDir));
    // --- Identity pools ---
    const AVATARS = ['👻', '💀', '🕷️', '🦇', '🐺', '🕯️', '☠️', '🩸', '👁️', '🪦', '🕸️', '🔮', '🗡️', '🩻', '🪄', '🌑'];
    const PREFIXES = ['WRAITH', 'PHANTOM', 'SPECTER', 'LICH', 'GHOUL', 'BANSHEE', 'REVENANT', 'SHADE', 'DREAD', 'OMEN', 'CURSE', 'DUSK', 'RAVEN', 'TOMB', 'CRYPT', 'ABYSS', 'REAPER', 'VOID', 'GRIMM', 'DIRGE'];
    function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randomId(prefix) { return prefix + '_' + Math.floor(Math.random() * 9999).toString().padStart(4, '0'); }
    // --- Auth Route (IIIT Dharwad email validation & hash registration) ---
    app.post('/api/auth/register', async (req, res) => {
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
            const deviceId = crypto_1.default
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
            const token = security_1.JWTManager.signToken({ deviceId, name, avatar });
            return res.json({ token, identity: { name, avatar, deviceId }, reputation: rep });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    // --- Feed Routes ---
    app.get('/api/feed/posts', async (req, res) => {
        try {
            const posts = await feedUseCase.getPosts();
            return res.json(posts);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/feed/posts', upload.single('image'), async (req, res) => {
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
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.post('/api/feed/posts/:id/vote', async (req, res) => {
        try {
            const id = req.params.id;
            const { delta, deviceId } = req.body; // delta is +1 or -1
            const votes = await feedUseCase.votePost(id, delta, deviceId);
            return res.json({ votes });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.post('/api/feed/posts/:id/react', async (req, res) => {
        try {
            const id = req.params.id;
            const { reactionType, authorId } = req.body;
            const reactions = await feedUseCase.reactPost(id, reactionType, authorId);
            return res.json({ reactions });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.post('/api/feed/posts/:id/poll/vote', async (req, res) => {
        try {
            const id = req.params.id;
            const { optionIdx, authorId } = req.body;
            const pollVotes = await feedUseCase.votePoll(id, optionIdx, authorId);
            return res.json({ pollVotes });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    // --- Comments Routes ---
    app.get('/api/feed/posts/:id/comments', async (req, res) => {
        try {
            const id = req.params.id;
            const comments = await feedUseCase.getComments(id);
            return res.json(comments);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/feed/posts/:id/comments', async (req, res) => {
        try {
            const id = req.params.id;
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
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    // --- Confessions Routes ---
    app.get('/api/confessions', async (req, res) => {
        try {
            const confessions = await feedUseCase.getConfessions();
            return res.json(confessions);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/confessions', async (req, res) => {
        try {
            const { text, authorId } = req.body;
            const confession = await feedUseCase.createConfession(text, authorId);
            return res.status(201).json(confession);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.post('/api/confessions/:id/react', async (req, res) => {
        try {
            const id = req.params.id;
            const { reactionType, authorId } = req.body;
            const reactions = await feedUseCase.reactConfession(id, reactionType, authorId);
            return res.json({ reactions });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    // --- Memes Routes ---
    app.get('/api/memes', async (req, res) => {
        try {
            const memes = await feedUseCase.getMemes();
            return res.json(memes);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/memes', upload.single('image'), async (req, res) => {
        try {
            const { title, authorId } = req.body;
            if (!req.file) {
                return res.status(400).json({ error: 'Meme image is required' });
            }
            const imageUrl = `/uploads/${req.file.filename}`;
            const meme = await feedUseCase.createMeme(title, imageUrl, authorId);
            return res.status(201).json(meme);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.post('/api/memes/:id/react', async (req, res) => {
        try {
            const id = req.params.id;
            const { reactionType, authorId } = req.body;
            const reactions = await feedUseCase.reactMeme(id, reactionType, authorId);
            return res.json({ reactions });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    // --- Marketplace Routes ---
    app.get('/api/marketplace', async (req, res) => {
        try {
            const items = await feedUseCase.getMarketplaceItems();
            return res.json(items);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/marketplace', upload.single('image'), async (req, res) => {
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
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.put('/api/marketplace/:id/status', async (req, res) => {
        try {
            const id = req.params.id;
            const { status } = req.body; // 'active' | 'sold'
            await feedUseCase.updateMarketplaceItemStatus(id, status);
            return res.json({ success: true });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    // --- Lost & Found Routes ---
    app.get('/api/lostfound', async (req, res) => {
        try {
            const items = await feedUseCase.getLostFoundItems();
            return res.json(items);
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    app.post('/api/lostfound', upload.single('image'), async (req, res) => {
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
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    app.put('/api/lostfound/:id/status', async (req, res) => {
        try {
            const id = req.params.id;
            const { status } = req.body; // 'active' | 'resolved'
            await feedUseCase.updateLostFoundItemStatus(id, status);
            return res.json({ success: true });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    });
    // --- Soul Reputation ---
    app.get('/api/reputation/:deviceId', async (req, res) => {
        try {
            const deviceId = req.params.deviceId;
            const rep = await dbRepo.getSoulRep(deviceId);
            return res.json(rep || { deviceId, score: 0, badges: ['Lost Soul'], reportsCount: 0 });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });
    // --- Metrics Endpoint ---
    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', prom_client_1.default.register.contentType);
            res.end(await prom_client_1.default.register.metrics());
        }
        catch (err) {
            res.status(500).end(err);
        }
    });
    // --- Health Endpoint ---
    app.get('/health', (req, res) => {
        res.json({ status: 'alive' });
    });
}
