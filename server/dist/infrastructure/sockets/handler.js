"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureSockets = configureSockets;
const security_1 = require("../security");
const config_1 = require("../../config");
const server_1 = require("../http/server");
function configureSockets(io, cacheRepo, dbRepo, roomsUseCase, matchingUseCase) {
    // Update Prometheus metrics periodically
    setInterval(async () => {
        try {
            const sessions = await cacheRepo.getAllUserSessions();
            server_1.activeSoulsGauge.set(sessions.length);
            const pairedCount = sessions.filter(s => s.status === 'paired').length;
            server_1.activeMatchesGauge.set(pairedCount / 2);
        }
        catch {
            // Ignore
        }
    }, 10000);
    io.on('connection', async (socket) => {
        const forwarded = socket.handshake.headers['x-forwarded-for'];
        const ipAddress = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || socket.handshake.address;
        // Auth Token Check
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        let payload = null;
        if (token) {
            payload = security_1.JWTManager.verifyToken(token);
        }
        // Default if token is missing/expired
        const deviceId = socket.handshake.query.deviceId || 'void_dev_guest_' + Math.random().toString(36).substring(2, 9);
        const name = payload ? payload.name : 'LostSoul#' + Math.floor(Math.random() * 900 + 100);
        const avatar = payload ? payload.avatar : '👻';
        socket.session = { deviceId, name, avatar };
        // Check ban
        const banned = await dbRepo.checkIsBanned(ipAddress, deviceId);
        if (banned) {
            socket.emit('banned', { reason: 'Exiled from the Void.' });
            socket.disconnect(true);
            return;
        }
        // Initialize session state in cache
        const sessionDetail = {
            deviceId,
            name,
            avatar,
            ipAddress,
            socketId: socket.id,
            status: 'lobby',
            currentRoom: 'lobby',
            partnerId: null,
            matchRoom: null,
            msgCount: 0,
            windowStart: Date.now(),
            joinedAt: Date.now()
        };
        await cacheRepo.saveUserSession(socket.id, sessionDetail);
        console.log(`[+] ${name} ${avatar} connected (${socket.id})`);
        // Join lobby
        socket.join('lobby');
        socket.emit('your-identity', { avatar, name, deviceId });
        // Send history
        const history = await dbRepo.getChatHistory('lobby');
        socket.emit('history', history);
        // Join notification
        const joinMsg = {
            id: 'sys_' + Date.now() + '_' + Math.random(),
            room: 'lobby',
            authorId: 'system',
            avatar: '☠',
            name: 'VOID',
            text: `${avatar} ${name} has entered the void`,
            ts: Date.now(),
            reactions: {},
            isSystem: true
        };
        io.to('lobby').emit('system-message', joinMsg);
        // Send updated soul count
        const broadcastSoulCount = async () => {
            const sessions = await cacheRepo.getAllUserSessions();
            io.emit('soul-count', sessions.length);
        };
        await broadcastSoulCount();
        // Admin helper
        const broadcastAdminUsers = async () => {
            const sessions = await cacheRepo.getAllUserSessions();
            const onlineList = sessions.map(s => ({
                id: s.socketId,
                name: s.name,
                avatar: s.avatar,
                ipAddress: s.ipAddress,
                deviceId: s.deviceId,
                currentRoom: s.currentRoom,
                status: s.status
            }));
            for (const [sId, s] of io.sockets.sockets) {
                const extSocket = s;
                if (extSocket.isAdmin) {
                    extSocket.emit('admin-users-list', onlineList);
                }
            }
        };
        await broadcastAdminUsers();
        // --- Admin Auth ---
        socket.on('admin-auth', ({ token: adminToken }) => {
            if (adminToken === config_1.ADMIN_TOKEN) {
                socket.isAdmin = true;
                socket.emit('admin-auth-success');
                cacheRepo.getAllUserSessions().then(sessions => {
                    const onlineList = sessions.map(s => ({
                        id: s.socketId,
                        name: s.name,
                        avatar: s.avatar,
                        ipAddress: s.ipAddress,
                        deviceId: s.deviceId,
                        currentRoom: s.currentRoom,
                        status: s.status
                    }));
                    socket.emit('admin-users-list', onlineList);
                });
                dbRepo.getBansList().then(list => socket.emit('admin-bans-list', list));
            }
            else {
                socket.emit('admin-auth-fail', { message: 'Incorrect passcode. The darkness rejects you.' });
            }
        });
        // --- Admin Actions ---
        socket.on('admin-ban-user', async ({ socketId, deviceId: banDeviceId, ipAddress: banIp, reason }) => {
            if (!socket.isAdmin)
                return;
            await dbRepo.addBan(banIp, banDeviceId, reason);
            // Disconnect matching sockets
            const sockets = await io.fetchSockets();
            for (const s of sockets) {
                const extS = s;
                if (extS.session?.deviceId === banDeviceId) {
                    extS.emit('banned', { reason });
                    extS.disconnect(true);
                }
            }
            await broadcastAdminUsers();
            const list = await dbRepo.getBansList();
            for (const [sId, s] of io.sockets.sockets) {
                const extSocket = s;
                if (extSocket.isAdmin) {
                    extSocket.emit('admin-bans-list', list);
                }
            }
        });
        socket.on('admin-unban', async ({ ipOrDeviceId }) => {
            if (!socket.isAdmin)
                return;
            await dbRepo.removeBan(ipOrDeviceId);
            const list = await dbRepo.getBansList();
            socket.emit('admin-bans-list', list);
        });
        socket.on('admin-get-bans', async () => {
            if (!socket.isAdmin)
                return;
            const list = await dbRepo.getBansList();
            socket.emit('admin-bans-list', list);
        });
        // --- Room Navigation ---
        socket.on('switch-room', async (newRoom) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session || session.status === 'paired')
                return;
            const oldRoom = session.currentRoom;
            if (oldRoom === newRoom)
                return;
            socket.leave(oldRoom);
            const leaveMsg = {
                id: 'sys_' + Date.now() + '_' + Math.random(),
                room: oldRoom,
                authorId: 'system',
                avatar: '☠',
                name: 'VOID',
                text: `${session.avatar} ${session.name} has vanished into another realm`,
                ts: Date.now(),
                reactions: {},
                isSystem: true
            };
            io.to(oldRoom).emit('system-message', leaveMsg);
            socket.join(newRoom);
            session.currentRoom = newRoom;
            session.status = newRoom;
            await cacheRepo.saveUserSession(socket.id, session);
            const joinMsg = {
                id: 'sys_' + Date.now() + '_' + Math.random(),
                room: newRoom,
                authorId: 'system',
                avatar: '☠',
                name: 'VOID',
                text: `${session.avatar} ${session.name} has entered the room`,
                ts: Date.now(),
                reactions: {},
                isSystem: true
            };
            io.to(newRoom).emit('system-message', joinMsg);
            const historyList = await dbRepo.getChatHistory(newRoom);
            socket.emit('history', historyList);
            await broadcastAdminUsers();
        });
        // --- Matchmaking (Omegle mode) ---
        const handleUnpair = async (sId, reason) => {
            const s = await cacheRepo.getUserSession(sId);
            if (!s)
                return;
            const matchRoom = s.matchRoom;
            s.partnerId = null;
            s.matchRoom = null;
            s.status = 'lobby';
            s.currentRoom = 'lobby';
            await cacheRepo.saveUserSession(sId, s);
            const target = io.sockets.sockets.get(sId);
            if (target) {
                if (matchRoom)
                    target.leave(matchRoom);
                target.emit('match-unpaired', { reason });
                target.join('lobby');
                const hist = await dbRepo.getChatHistory('lobby');
                target.emit('history', hist);
            }
        };
        const tryProcessMatching = async () => {
            const pairs = await matchingUseCase.tryPairUsers();
            for (const pair of pairs) {
                const u1 = await cacheRepo.getUserSession(pair.socket1);
                const u2 = await cacheRepo.getUserSession(pair.socket2);
                if (!u1 || !u2) {
                    // Re-queue valid socket
                    if (u1)
                        await matchingUseCase.enterQueue(pair.socket1);
                    if (u2)
                        await matchingUseCase.enterQueue(pair.socket2);
                    continue;
                }
                u1.status = 'paired';
                u1.partnerId = pair.socket2;
                u1.matchRoom = pair.roomName;
                await cacheRepo.saveUserSession(pair.socket1, u1);
                u2.status = 'paired';
                u2.partnerId = pair.socket1;
                u2.matchRoom = pair.roomName;
                await cacheRepo.saveUserSession(pair.socket2, u2);
                const sock1 = io.sockets.sockets.get(pair.socket1);
                const sock2 = io.sockets.sockets.get(pair.socket2);
                if (sock1)
                    sock1.join(pair.roomName);
                if (sock2)
                    sock2.join(pair.roomName);
                io.to(pair.socket1).emit('match-paired', { partner: { name: u2.name, avatar: u2.avatar }, room: pair.roomName });
                io.to(pair.socket2).emit('match-paired', { partner: { name: u1.name, avatar: u1.avatar }, room: pair.roomName });
            }
        };
        socket.on('join-matchmaking', async () => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session || session.status === 'paired' || session.status === 'matching')
                return;
            socket.leave(session.currentRoom);
            const leaveMsg = {
                id: 'sys_' + Date.now() + '_' + Math.random(),
                room: session.currentRoom,
                authorId: 'system',
                avatar: '☠',
                name: 'VOID',
                text: `${session.avatar} ${session.name} has entered the matching mist`,
                ts: Date.now(),
                reactions: {},
                isSystem: true
            };
            io.to(session.currentRoom).emit('system-message', leaveMsg);
            session.status = 'matching';
            await cacheRepo.saveUserSession(socket.id, session);
            await matchingUseCase.enterQueue(socket.id);
            socket.emit('matchmaking-status', 'searching');
            await tryProcessMatching();
            await broadcastAdminUsers();
        });
        socket.on('leave-matchmaking', async () => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session || session.status !== 'matching')
                return;
            await matchingUseCase.leaveQueue(socket.id);
            session.status = 'lobby';
            session.currentRoom = 'lobby';
            await cacheRepo.saveUserSession(socket.id, session);
            socket.join('lobby');
            socket.emit('matchmaking-status', 'idle');
            const hist = await dbRepo.getChatHistory('lobby');
            socket.emit('history', hist);
            const joinMsg = {
                id: 'sys_' + Date.now() + '_' + Math.random(),
                room: 'lobby',
                authorId: 'system',
                avatar: '☠',
                name: 'VOID',
                text: `${session.avatar} ${session.name} has returned from the matching mist`,
                ts: Date.now(),
                reactions: {},
                isSystem: true
            };
            io.to('lobby').emit('system-message', joinMsg);
            await broadcastAdminUsers();
        });
        socket.on('skip-match', async () => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session || session.status !== 'paired' || !session.partnerId)
                return;
            const partnerId = session.partnerId;
            await handleUnpair(partnerId, 'partner_skipped');
            await handleUnpair(socket.id, 'you_skipped');
            // Put partner back in queue
            const pSession = await cacheRepo.getUserSession(partnerId);
            if (pSession) {
                pSession.status = 'matching';
                await cacheRepo.saveUserSession(partnerId, pSession);
                await matchingUseCase.enterQueue(partnerId);
                io.to(partnerId).emit('matchmaking-status', 'searching');
            }
            // Put myself back in queue
            session.status = 'matching';
            await cacheRepo.saveUserSession(socket.id, session);
            await matchingUseCase.enterQueue(socket.id);
            socket.emit('matchmaking-status', 'searching');
            await tryProcessMatching();
            await broadcastAdminUsers();
        });
        // --- WebRTC Signalling ---
        socket.on('webrtc-offer', async ({ sdp }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session && session.partnerId) {
                io.to(session.partnerId).emit('webrtc-offer', { sdp });
            }
        });
        socket.on('webrtc-answer', async ({ sdp }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session && session.partnerId) {
                io.to(session.partnerId).emit('webrtc-answer', { sdp });
            }
        });
        socket.on('webrtc-ice-candidate', async ({ candidate }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session && session.partnerId) {
                io.to(session.partnerId).emit('webrtc-ice-candidate', { candidate });
            }
        });
        socket.on('voice-state', async ({ enabled }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session && session.partnerId) {
                io.to(session.partnerId).emit('voice-state', { enabled });
            }
        });
        socket.on('video-state', async ({ enabled }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session && session.partnerId) {
                io.to(session.partnerId).emit('video-state', { enabled });
            }
        });
        // WebRTC connection quality status update helper
        socket.on('webrtc-quality-update', async (quality) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session && session.partnerId) {
                io.to(session.partnerId).emit('webrtc-quality-update', quality);
            }
        });
        // --- Chat Messages ---
        socket.on('send-message', async ({ text, imageUrl }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session)
                return;
            const trimmedText = (text || '').trim().slice(0, config_1.MAX_MSG_LENGTH);
            if (!trimmedText && !imageUrl)
                return;
            // Rate limit check
            const now = Date.now();
            if (now - session.windowStart > config_1.RATE_LIMIT_WINDOW) {
                session.windowStart = now;
                session.msgCount = 0;
            }
            session.msgCount++;
            await cacheRepo.saveUserSession(socket.id, session);
            if (session.msgCount > config_1.RATE_LIMIT_MAX) {
                socket.emit('rate-limited', { message: 'You are speaking too fast. The void grows impatient.' });
                return;
            }
            // AI moderation
            let cleaned = trimmedText;
            if (trimmedText) {
                const modResult = security_1.AIModerationService.moderateText(trimmedText);
                if (modResult.flagged) {
                    socket.emit('system-message', {
                        id: 'mod_' + Date.now(),
                        room: session.currentRoom,
                        authorId: 'system',
                        avatar: '☠',
                        name: 'VOID',
                        text: `Whisper blocked. Scams, abuse, or excessive profanity is forbidden in the void.`,
                        ts: Date.now(),
                        isSystem: true
                    });
                    return;
                }
                cleaned = modResult.cleanedText;
            }
            if (imageUrl) {
                const imgMod = security_1.AIModerationService.moderateImage(imageUrl);
                if (imgMod.flagged) {
                    socket.emit('system-message', {
                        id: 'mod_img_' + Date.now(),
                        room: session.currentRoom,
                        authorId: 'system',
                        avatar: '☠',
                        name: 'VOID',
                        text: `Image blocked by void filter.`,
                        ts: Date.now(),
                        isSystem: true
                    });
                    return;
                }
            }
            const activeRoom = session.status === 'paired' ? session.matchRoom : session.currentRoom;
            if (!activeRoom)
                return;
            const messageObj = {
                id: socket.id + '_' + Date.now() + '_' + Math.random(),
                room: activeRoom,
                authorId: socket.id,
                avatar: session.avatar,
                name: session.name,
                text: cleaned,
                imageUrl: imageUrl || null,
                reactions: {},
                ts: Date.now()
            };
            await dbRepo.saveChatMessage(messageObj);
            // Increment reputation slightly for messaging
            await dbRepo.upsertSoulRep(session.deviceId, 0.1);
            io.to(activeRoom).emit('receive-message', messageObj);
            socket.to(activeRoom).emit('user-stopped-typing', socket.id);
        });
        // --- Message Reactions ---
        socket.on('react-message', async ({ messageId, reactionType }) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session)
                return;
            if (!['skull', 'blood', 'eye'].includes(reactionType))
                return;
            const activeRoom = session.status === 'paired' ? session.matchRoom : session.currentRoom;
            if (!activeRoom)
                return;
            // Read reactions from message, toggle user.id
            const res = await dbRepo.getChatHistory(activeRoom, 200);
            const msg = res.find(m => m.id === messageId);
            if (!msg)
                return;
            const reactions = msg.reactions || {};
            if (!reactions[reactionType])
                reactions[reactionType] = [];
            const idx = reactions[reactionType].indexOf(socket.id);
            if (idx > -1) {
                reactions[reactionType].splice(idx, 1);
            }
            else {
                reactions[reactionType].push(socket.id);
            }
            // Update in PG
            await dbRepo.saveChatMessage({ ...msg, reactions });
            io.to(activeRoom).emit('message-reaction-updated', { messageId, reactions });
        });
        // --- Typing Indicators ---
        socket.on('typing-start', async () => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session)
                return;
            const activeRoom = session.status === 'paired' ? session.matchRoom : session.currentRoom;
            if (!activeRoom)
                return;
            socket.to(activeRoom).emit('user-typing', { id: socket.id, name: session.name, avatar: session.avatar });
        });
        socket.on('typing-stop', async () => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session)
                return;
            const activeRoom = session.status === 'paired' ? session.matchRoom : session.currentRoom;
            if (!activeRoom)
                return;
            socket.to(activeRoom).emit('user-stopped-typing', socket.id);
        });
        // --- Report ---
        socket.on('report-message', async ({ messageId }) => {
            // Find reporter
            const reporter = await cacheRepo.getUserSession(socket.id);
            if (!reporter)
                return;
            console.log(`[!] Message reported: ${messageId} by ${reporter.name}`);
            // We flag the author of the message
            // Find author from message id
            const sessionList = await cacheRepo.getAllUserSessions();
            const authorSocketId = messageId.split('_')[0];
            const authorSession = sessionList.find(s => s.socketId === authorSocketId);
            if (authorSession) {
                // deduct reputation
                await dbRepo.upsertSoulRep(authorSession.deviceId, -3, 1);
            }
            socket.emit('report-received', { message: 'The darkness has been notified. Reporting helps purify the mist.' });
        });
        // --- Temp Room Events ---
        socket.on('create-temp-room', async (roomData) => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (!session)
                return;
            try {
                const room = await roomsUseCase.createRoom({
                    name: roomData.name,
                    type: roomData.type,
                    durationMinutes: roomData.durationMinutes,
                    createdBy: session.deviceId
                });
                // Notify all clients of new room
                io.emit('temp-room-created', room);
            }
            catch (err) {
                socket.emit('system-message', {
                    id: 'room_err_' + Date.now(),
                    room: session.currentRoom,
                    authorId: 'system',
                    avatar: '☠',
                    name: 'VOID',
                    text: `Failed to create room.`,
                    ts: Date.now(),
                    isSystem: true
                });
            }
        });
        // --- Disconnect ---
        socket.on('disconnect', async () => {
            const session = await cacheRepo.getUserSession(socket.id);
            if (session) {
                console.log(`[-] ${session.name} disconnected`);
                const activeRoom = session.status === 'paired' ? session.matchRoom : session.currentRoom;
                await matchingUseCase.leaveQueue(socket.id);
                if (session.status === 'paired' && session.partnerId) {
                    const partnerId = session.partnerId;
                    await handleUnpair(partnerId, 'partner_disconnected');
                    // Auto re-queue partner
                    const pSession = await cacheRepo.getUserSession(partnerId);
                    if (pSession) {
                        pSession.status = 'matching';
                        await cacheRepo.saveUserSession(partnerId, pSession);
                        await matchingUseCase.enterQueue(partnerId);
                        const pSock = io.sockets.sockets.get(partnerId);
                        if (pSock)
                            pSock.emit('matchmaking-status', 'searching');
                        await tryProcessMatching();
                    }
                }
                else if (activeRoom) {
                    const leaveMsg = {
                        id: 'sys_' + Date.now() + '_' + Math.random(),
                        room: activeRoom,
                        authorId: 'system',
                        avatar: '☠',
                        name: 'VOID',
                        text: `${session.avatar} ${session.name} has vanished into the dark`,
                        ts: Date.now(),
                        reactions: {},
                        isSystem: true
                    };
                    io.to(activeRoom).emit('system-message', leaveMsg);
                }
                await cacheRepo.deleteUserSession(socket.id);
            }
            await broadcastSoulCount();
            await broadcastAdminUsers();
        });
    });
}
