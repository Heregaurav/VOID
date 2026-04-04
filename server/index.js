const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Filter = require('bad-words');

const app = express();
const server = http.createServer(app);
const filter = new Filter();

// ─── Config ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MAX_MSG_LENGTH = 300;
const RATE_LIMIT_WINDOW = 5000;   // ms
const RATE_LIMIT_MAX = 5;         // messages per window
const MESSAGE_HISTORY = 50;       // how many messages to keep in memory

// ─── Identity pools ───────────────────────────────────────
const AVATARS = ['👻','💀','🕷️','🦇','🐺','🕯️','☠️','🩸','👁️','🪦','🕸️','🔮','🗡️','🩻','🪄','🌑'];
const PREFIXES = ['WRAITH','PHANTOM','SPECTER','LICH','GHOUL','BANSHEE','REVENANT','SHADE','DREAD','OMEN','CURSE','DUSK','RAVEN','TOMB','CRYPT','ABYSS','REAPER','VOID','GRIMM','DIRGE'];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomId(prefix) { return prefix + '_' + Math.floor(Math.random() * 9999).toString().padStart(4, '0'); }

// ─── State ────────────────────────────────────────────────
const users = {};           // socketId → { avatar, name, joinedAt, msgCount, windowStart }
const messageHistory = [];  // last N messages

// ─── CORS ─────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'alive', souls: Object.keys(users).length });
});

// ─── Socket.IO ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 20000,
  pingInterval: 10000
});

io.on('connection', (socket) => {
  // Assign identity
  const avatar = randomFrom(AVATARS);
  const name = randomId(randomFrom(PREFIXES));

  users[socket.id] = {
    avatar,
    name,
    joinedAt: Date.now(),
    msgCount: 0,
    windowStart: Date.now()
  };

  console.log(`[+] ${name} ${avatar} connected  (${Object.keys(users).length} souls online)`);

  // Send identity to the connecting user
  socket.emit('your-identity', { avatar, name });

  // Send message history
  socket.emit('history', messageHistory);

  // Broadcast join notification
  const joinMsg = {
    type: 'system',
    text: `${avatar} ${name} has entered the void`,
    ts: Date.now()
  };
  io.emit('system-message', joinMsg);

  // Broadcast updated soul count
  io.emit('soul-count', Object.keys(users).length);

  // ── Incoming message ──────────────────────────────────
  socket.on('send-message', (text) => {
    const user = users[socket.id];
    if (!user) return;

    // Validate
    if (typeof text !== 'string') return;
    text = text.trim().slice(0, MAX_MSG_LENGTH);
    if (!text) return;

    // Rate limiting
    const now = Date.now();
    if (now - user.windowStart > RATE_LIMIT_WINDOW) {
      user.windowStart = now;
      user.msgCount = 0;
    }
    user.msgCount++;

    if (user.msgCount > RATE_LIMIT_MAX) {
      socket.emit('rate-limited', { message: 'You are speaking too fast. The void grows impatient.' });
      return;
    }

    // Profanity filter
    let cleanText;
    try {
      cleanText = filter.clean(text);
    } catch (e) {
      cleanText = text;
    }

    const message = {
      id: socket.id + '_' + now,
      authorId: socket.id,
      avatar: user.avatar,
      name: user.name,
      text: cleanText,
      ts: now
    };

    // Save to history
    messageHistory.push(message);
    if (messageHistory.length > MESSAGE_HISTORY) {
      messageHistory.shift();
    }

    // Broadcast to ALL
    io.emit('receive-message', message);

    // Clear typing indicator for this user
    socket.broadcast.emit('user-stopped-typing', socket.id);
  });

  // ── Typing indicators ─────────────────────────────────
  socket.on('typing-start', () => {
    const user = users[socket.id];
    if (!user) return;
    socket.broadcast.emit('user-typing', { id: socket.id, name: user.name, avatar: user.avatar });
  });

  socket.on('typing-stop', () => {
    socket.broadcast.emit('user-stopped-typing', socket.id);
  });

  // ── Report message ────────────────────────────────────
  socket.on('report-message', ({ messageId }) => {
    console.log(`[!] Message reported: ${messageId} by ${users[socket.id]?.name}`);
    socket.emit('report-received', { message: 'The darkness has been notified.' });
  });

  // ── Disconnect ────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      console.log(`[-] ${user.name} disconnected  (${Object.keys(users).length - 1} souls remain)`);
      const leaveMsg = {
        type: 'system',
        text: `${user.avatar} ${user.name} has vanished into the dark`,
        ts: Date.now()
      };
      io.emit('system-message', leaveMsg);
    }
    delete users[socket.id];
    socket.broadcast.emit('user-stopped-typing', socket.id);
    io.emit('soul-count', Object.keys(users).length);
  });
});

// ─── Start ────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n☠  VOID CHAT SERVER  ☠`);
  console.log(`   Running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
