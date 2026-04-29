# ☠ VOID — Horror Anonymous Real-Time Chat : - still working over it version 1.2 will be coming soon..

> "Speak into the darkness. Something always answers."

A full-stack anonymous real-time chat platform with a horror aesthetic.
Built with React + Socket.IO + Node.js/Express.

## Project Structure

```
void-chat/
├── server/
│   ├── index.js        ← Socket.IO server, rate limiting, profanity filter
│   └── package.json
├── client/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.jsx        
│   │   ├── App.css         
│   │   ├── useSocket.js    ← Custom hook: all socket logic
│   │   └── index.js
│   └── package.json
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Start the server

```bash
cd server
npm run dev    
```

Runs on: http://localhost:5000

### 3. Start the client (new terminal)

```bash
cd client
npm start
```

Runs on: http://localhost:3000

## Features

CORE
- Anonymous identity — random horror avatar + name on connect
- Real-time messaging — Socket.IO WebSockets
- Message history — last 50 messages loaded on join
- Live soul counter
- Typing indicators
- Auto-scroll with scroll-to-bottom button
- Report button (hover any message)
- Profanity filter (bad-words)
- Rate limiting — 5 msgs per 5 seconds
- Join/leave system messages

HORROR UI
- CRT scanlines + vignette overlay
- Flickering blood-red logo
- Your messages in blood red, others in bone white
- Floating skull when chat is empty
- Pulsing soul dot
- Creepster + Special Elite + Share Tech Mono fonts
- Connection status indicator
- Toast notifications

## Environment Variables

Client — create client/.env:
  REACT_APP_SERVER_URL=http://localhost:5000

For production:
  REACT_APP_SERVER_URL=https://your-server.com

## Deploy

Server → Railway / Render / Fly.io (Node.js)
Client → Vercel / Netlify (set REACT_APP_SERVER_URL first, then npm run build)

## Planned Upgrades

- Random 1-on-1 Omegle mode + skip button
- Rooms / channels
- Image sharing
- Reactions (skull, blood drop, eye)
- Voice chat via WebRTC
- Persistent storage with MongoDB
- Admin ban panel
