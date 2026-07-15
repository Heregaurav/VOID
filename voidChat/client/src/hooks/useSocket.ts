import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, Partner, AdminUser, AdminBan, Identity, ToastType, Post, Comment, Confession, Meme, MarketplaceItem, LostFoundItem, TempRoom, SoulRep } from '../types';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || window.location.origin;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [soulCount, setSoulCount] = useState<number>(0);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; avatar: string }>>({});
  
  // JWT Token State
  const [token, setToken] = useState<string | null>(localStorage.getItem('void_session_token'));

  // Custom Toasts
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const triggerToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Room navigation
  const [currentRoom, setCurrentRoom] = useState<string>('lobby');

  // Matchmaking
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'paired'>('idle');
  const [partner, setPartner] = useState<Partner | null>(null);

  // WebRTC Media Streams
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [isVideoActive, setIsVideoActive] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isPartnerVoiceActive, setIsPartnerVoiceActive] = useState<boolean>(false);
  const [isPartnerVideoActive, setIsPartnerVideoActive] = useState<boolean>(false);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // WebRTC Quality Statistics
  const [rtcQuality, setRtcQuality] = useState<{ rtt: number; packetLoss: number }>({ rtt: 0, packetLoss: 0 });
  const qualityIntervalRef = useRef<any>(null);

  // Lists & Feeds state
  const [posts, setPosts] = useState<Post[]>([]);
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [memes, setMemes] = useState<Meme[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundItem[]>([]);
  const [tempRooms, setTempRooms] = useState<TempRoom[]>([]);
  const [soulRep, setSoulRep] = useState<SoulRep | null>(null);

  // Admin Panel
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminBans, setAdminBans] = useState<AdminBan[]>([]);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Bans
  const [isBanned, setIsBanned] = useState<boolean>(false);
  const [banReason, setBanReason] = useState<string>('');

  // Peer Connection Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const deviceId = useRef<string>('');

  // Load lists helper
  const fetchLists = useCallback(async () => {
    try {
      const postsRes = await fetch(`${SERVER_URL}/api/feed/posts`);
      if (postsRes.ok) setPosts(await postsRes.json());

      const confRes = await fetch(`${SERVER_URL}/api/confessions`);
      if (confRes.ok) setConfessions(await confRes.json());

      const memeRes = await fetch(`${SERVER_URL}/api/memes`);
      if (memeRes.ok) setMemes(await memeRes.json());

      const marketRes = await fetch(`${SERVER_URL}/api/marketplace`);
      if (marketRes.ok) setMarketplaceItems(await marketRes.json());

      const lfRes = await fetch(`${SERVER_URL}/api/lostfound`);
      if (lfRes.ok) setLostFoundItems(await lfRes.json());
    } catch (err) {
      console.error('Failed to fetch list data:', err);
    }
  }, []);

  // WebRTC Cleanup
  const closePeerConnection = useCallback(() => {
    if (qualityIntervalRef.current) {
      clearInterval(qualityIntervalRef.current);
      qualityIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    setRemoteStream(null);
    setIsVoiceActive(false);
    setIsVideoActive(false);
    setIsScreenSharing(false);
    setIsPartnerVoiceActive(false);
    setIsPartnerVideoActive(false);
    setRtcQuality({ rtt: 0, packetLoss: 0 });
  }, []);

  // Connect socket if token is available
  useEffect(() => {
    if (!token) {
      // Prompt login, don't connect
      setConnected(false);
      setIdentity(null);
      setSoulRep(null);
      return;
    }

    let devId = localStorage.getItem('void_device_id');
    if (!devId) {
      devId = 'void_dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      localStorage.setItem('void_device_id', devId);
    }
    deviceId.current = devId;

    // Connect socket
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      auth: { token },
      query: { deviceId: devId }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      triggerToast('Connected to the Void');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      closePeerConnection();
      triggerToast('Exited from the Void...');
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    socket.on('your-identity', (data: Identity) => {
      setIdentity({ ...data, deviceId: data.deviceId || devId || '' });
      // Fetch reputation
      fetch(`${SERVER_URL}/api/reputation/${data.deviceId || devId}`)
        .then(r => r.ok ? r.json() : null)
        .then(rep => {
          if (rep) setSoulRep(rep);
        });
    });

    socket.on('history', (msgs: Message[]) => {
      setMessages(msgs);
    });

    socket.on('receive-message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('system-message', (msg: Message) => {
      setMessages(prev => [...prev, { ...msg, isSystem: true }]);
    });

    socket.on('soul-count', (count: number) => {
      setSoulCount(count);
    });

    socket.on('user-typing', ({ id: typingId, name: typingName, avatar: typingAvatar }) => {
      setTypingUsers(prev => ({ ...prev, [typingId]: { name: typingName, avatar: typingAvatar } }));
    });

    socket.on('user-stopped-typing', (typingId: string) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[typingId];
        return next;
      });
    });

    socket.on('rate-limited', ({ message }: { message: string }) => {
      triggerToast(message);
    });

    socket.on('message-reaction-updated', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    socket.on('matchmaking-status', (status: 'searching' | 'idle') => {
      if (status === 'searching') {
        setMatchStatus('searching');
        setPartner(null);
        setMessages([]);
        triggerToast('Searching the Matching Mist...');
      } else if (status === 'idle') {
        setMatchStatus('idle');
        setPartner(null);
      }
    });

    socket.on('match-paired', ({ partner: partnerData }) => {
      setMatchStatus('paired');
      setPartner(partnerData);
      setMessages([]);
      closePeerConnection();
      triggerToast(`Paired with ${partnerData.avatar} ${partnerData.name}`);
    });

    socket.on('match-unpaired', ({ reason }) => {
      setMatchStatus('idle');
      setPartner(null);
      closePeerConnection();
      
      let text = 'Connection dissolved in the dark.';
      if (reason === 'partner_skipped') {
        text = 'Your partner has vanished. Searching...';
        socketRef.current?.emit('join-matchmaking');
      } else if (reason === 'partner_disconnected') {
        text = 'Your partner has disconnected. Searching...';
        socketRef.current?.emit('join-matchmaking');
      }
      triggerToast(text);
    });

    // WebRTC Signalling
    socket.on('webrtc-offer', async ({ sdp }) => {
      try {
        if (!pcRef.current) {
          initiatePeerConnection();
        }
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socketRef.current?.emit('webrtc-answer', { sdp: answer });
        }
      } catch (err) {
        console.error('WebRTC offer error:', err);
      }
    });

    socket.on('webrtc-answer', async ({ sdp }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (err) {
        console.error('WebRTC answer error:', err);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('WebRTC ICE candidate error:', err);
      }
    });

    socket.on('voice-state', ({ enabled }) => {
      setIsPartnerVoiceActive(enabled);
    });

    socket.on('video-state', ({ enabled }) => {
      setIsPartnerVideoActive(enabled);
    });

    socket.on('webrtc-quality-update', (quality) => {
      setRtcQuality(quality);
    });

    // Temp room notifications
    socket.on('temp-room-created', (room: TempRoom) => {
      setTempRooms(prev => [room, ...prev]);
      triggerToast(`Room "${room.name}" materialized`);
    });

    // Admin Auth
    socket.on('admin-auth-success', () => {
      setIsAdmin(true);
      setAdminError(null);
      triggerToast('Admin access granted');
    });

    socket.on('admin-auth-fail', ({ message }) => {
      setIsAdmin(false);
      setAdminError(message);
      triggerToast(message);
    });

    socket.on('admin-users-list', (list: AdminUser[]) => {
      setAdminUsers(list);
    });

    socket.on('admin-bans-list', (list: AdminBan[]) => {
      setAdminBans(list);
    });

    socket.on('banned', ({ reason }) => {
      setIsBanned(true);
      setBanReason(reason);
      closePeerConnection();
      socket.disconnect();
      triggerToast(`Exiled: ${reason}`);
    });

    socket.on('report-received', ({ message }) => {
      triggerToast(message);
    });

    // Initial pull
    fetchLists();

    return () => {
      closePeerConnection();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, closePeerConnection, fetchLists, triggerToast]);

  // --- Auth Commands ---
  const login = async (email: string): Promise<boolean> => {
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('void_session_token', data.token);
        setToken(data.token);
        setIdentity({ ...data.identity, deviceId: data.identity.deviceId });
        setSoulRep(data.reputation);
        triggerToast(`Welcome anonymous soul, ${data.identity.name}`);
        return true;
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to enter the Void.');
        return false;
      }
    } catch {
      triggerToast('Mist is too thick. Network error.');
      return false;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('void_session_token');
    setToken(null);
    setIdentity(null);
    setSoulRep(null);
    setMessages([]);
    setConnected(false);
    closePeerConnection();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [closePeerConnection]);

  // --- WebRTC call initiate helpers ---
  const initiatePeerConnection = () => {
    if (pcRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('webrtc-ice-candidate', { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    pcRef.current = pc;

    qualityIntervalRef.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        let rtt = 0;
        let packetLoss = 0;
        
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime * 1000;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const lost = report.packetsLost || 0;
            const received = report.packetsReceived || 1;
            packetLoss = (lost / (lost + received)) * 100;
          }
        });

        const quality = { rtt, packetLoss };
        setRtcQuality(quality);
        socketRef.current?.emit('webrtc-quality-update', quality);
      } catch {}
    }, 3000);
  };

  const syncLocalTracks = (stream: MediaStream) => {
    if (pcRef.current) {
      const senders = pcRef.current.getSenders();
      stream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          if (localStreamRef.current) {
            pcRef.current?.addTrack(track, localStreamRef.current);
          }
        }
      });
    }
  };

  const toggleVoice = async () => {
    if (isVoiceActive) {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.stop();
          localStreamRef.current.removeTrack(audioTrack);
        }
        if (localStreamRef.current.getTracks().length === 0) {
          localStreamRef.current = null;
          setLocalStream(null);
        } else {
          setLocalStream(localStreamRef.current);
        }
      }
      setIsVoiceActive(false);
      socketRef.current?.emit('voice-state', { enabled: false });
    } else {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const audioTrack = audioStream.getAudioTracks()[0];
        
        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        localStreamRef.current.addTrack(audioTrack);
        setLocalStream(localStreamRef.current);
        setIsVoiceActive(true);

        socketRef.current?.emit('voice-state', { enabled: true });

        initiatePeerConnection();
        syncLocalTracks(localStreamRef.current);

        if (isPartnerVoiceActive || isPartnerVideoActive) {
          initiateCall();
        }
      } catch (err) {
        console.error('Failed voice access:', err);
        triggerToast('Voice access denied.');
      }
    }
  };

  const toggleVideo = async () => {
    if (isVideoActive) {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          localStreamRef.current.removeTrack(videoTrack);
        }
        if (localStreamRef.current.getTracks().length === 0) {
          localStreamRef.current = null;
          setLocalStream(null);
        } else {
          setLocalStream(localStreamRef.current);
        }
      }
      setIsVideoActive(false);
      setIsScreenSharing(false);
      socketRef.current?.emit('video-state', { enabled: false });
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: 1280, height: 720 } });
        const videoTrack = videoStream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(localStreamRef.current);
        setIsVideoActive(true);

        socketRef.current?.emit('video-state', { enabled: true });

        initiatePeerConnection();
        syncLocalTracks(localStreamRef.current);

        if (isPartnerVoiceActive || isPartnerVideoActive) {
          initiateCall();
        }
      } catch (err) {
        console.error('Failed video access:', err);
        triggerToast('Camera access denied.');
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      toggleVideo();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        
        localStreamRef.current.getVideoTracks().forEach(t => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });

        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(localStreamRef.current);
        setIsScreenSharing(true);
        setIsVideoActive(true);
        socketRef.current?.emit('video-state', { enabled: true });

        initiatePeerConnection();
        syncLocalTracks(localStreamRef.current);

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          setIsVideoActive(false);
          socketRef.current?.emit('video-state', { enabled: false });
        };

        if (isPartnerVoiceActive || isPartnerVideoActive) {
          initiateCall();
        }
      } catch (err) {
        console.error('Failed screen share:', err);
      }
    }
  };

  const initiateCall = async () => {
    try {
      initiatePeerConnection();
      if (pcRef.current) {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        socketRef.current?.emit('webrtc-offer', { sdp: offer });
      }
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  };

  // --- Send Message ---
  const sendMessage = useCallback((text: string, imageUrl: string | null = null) => {
    socketRef.current?.emit('send-message', { text, imageUrl });
  }, []);

  const reactToMessage = useCallback((messageId: string, reactionType: string) => {
    socketRef.current?.emit('react-message', { messageId, reactionType });
  }, []);

  const sendTypingStart = useCallback(() => {
    socketRef.current?.emit('typing-start');
  }, []);

  const sendTypingStop = useCallback(() => {
    socketRef.current?.emit('typing-stop');
  }, []);

  const reportMessage = useCallback((messageId: string) => {
    socketRef.current?.emit('report-message', { messageId });
  }, []);

  // --- Rooms ---
  const switchRoom = useCallback((roomName: string) => {
    if (matchStatus === 'paired') return;
    setCurrentRoom(roomName);
    setMessages([]);
    socketRef.current?.emit('switch-room', roomName);
  }, [matchStatus]);

  const createTempRoom = useCallback((roomName: string, roomType: 'text' | 'voice' | 'video', durationMinutes: number) => {
    socketRef.current?.emit('create-temp-room', { name: roomName, type: roomType, durationMinutes });
  }, []);

  // --- Matchmaking ---
  const joinMatchmaking = useCallback(() => {
    socketRef.current?.emit('join-matchmaking');
  }, []);

  const leaveMatchmaking = useCallback(() => {
    socketRef.current?.emit('leave-matchmaking');
  }, []);

  const skipMatch = useCallback(() => {
    socketRef.current?.emit('skip-match');
  }, []);

  // --- HTTP POST API actions ---
  const addPost = async (content: string, imageFile?: File | null, pollOptions?: string[] | null) => {
    if (!identity) return;
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('authorId', identity.deviceId);
      formData.append('authorName', identity.name);
      formData.append('authorAvatar', identity.avatar);
      if (imageFile) formData.append('image', imageFile);
      if (pollOptions) formData.append('pollOptions', JSON.stringify(pollOptions));

      const res = await fetch(`${SERVER_URL}/api/feed/posts`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const post = await res.json();
        setPosts(prev => [post, ...prev]);
        triggerToast('Post whispered to the mist.');
        refreshReputation();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to whisper.');
      }
    } catch {
      triggerToast('Network error.');
    }
  };

  const votePost = async (postId: string, delta: number) => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/feed/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, deviceId: identity.deviceId })
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, votes: data.votes } : p));
      }
    } catch {}
  };

  const reactPost = async (postId: string, reactionType: string) => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/feed/posts/${postId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, authorId: identity.deviceId })
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: data.reactions } : p));
      }
    } catch {}
  };

  const votePoll = async (postId: string, optionIdx: number) => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/feed/posts/${postId}/poll/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIdx, authorId: identity.deviceId })
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, pollVotes: data.pollVotes } : p));
      }
    } catch {}
  };

  const addComment = async (postId: string, content: string) => {
    if (!identity) return null;
    try {
      const res = await fetch(`${SERVER_URL}/api/feed/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          authorId: identity.deviceId,
          authorName: identity.name,
          authorAvatar: identity.avatar
        })
      });
      if (res.ok) {
        const cmt = await res.json();
        triggerToast('Comment whispered.');
        refreshReputation();
        return cmt;
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to comment.');
      }
    } catch {}
    return null;
  };

  const addConfession = async (text: string) => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/confessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, authorId: identity.deviceId })
      });
      if (res.ok) {
        const conf = await res.json();
        setConfessions(prev => [conf, ...prev]);
        triggerToast('Confessed to the wall.');
        refreshReputation();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to confess.');
      }
    } catch {}
  };

  const reactConfession = async (confessionId: string, reactionType: string) => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/confessions/${confessionId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, authorId: identity.deviceId })
      });
      if (res.ok) {
        const data = await res.json();
        setConfessions(prev => prev.map(c => c.id === confessionId ? { ...c, reactions: data.reactions } : c));
      }
    } catch {}
  };

  const addMeme = async (title: string, file: File) => {
    if (!identity) return;
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('authorId', identity.deviceId);
      formData.append('image', file);

      const res = await fetch(`${SERVER_URL}/api/memes`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const meme = await res.json();
        setMemes(prev => [meme, ...prev]);
        triggerToast('Meme posted.');
        refreshReputation();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to post meme.');
      }
    } catch {}
  };

  const reactMeme = async (memeId: string, reactionType: string) => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/memes/${memeId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, authorId: identity.deviceId })
      });
      if (res.ok) {
        const data = await res.json();
        setMemes(prev => prev.map(m => m.id === memeId ? { ...m, reactions: data.reactions } : m));
      }
    } catch {}
  };

  const addMarketplaceItem = async (title: string, description: string, price: number, file: File, contactInfo: string) => {
    if (!identity) return;
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('price', String(price));
      formData.append('image', file);
      formData.append('authorId', identity.deviceId);
      formData.append('authorName', identity.name);
      formData.append('authorAvatar', identity.avatar);
      formData.append('contactInfo', contactInfo);

      const res = await fetch(`${SERVER_URL}/api/marketplace`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const item = await res.json();
        setMarketplaceItems(prev => [item, ...prev]);
        triggerToast('Trade listed in marketplace.');
        refreshReputation();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to list item.');
      }
    } catch {}
  };

  const updateMarketplaceItemStatus = async (itemId: string, status: 'active' | 'sold') => {
    try {
      const res = await fetch(`${SERVER_URL}/api/marketplace/${itemId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setMarketplaceItems(prev => prev.map(item => item.id === itemId ? { ...item, status } : item));
        triggerToast(`Item status updated to ${status}.`);
      }
    } catch {}
  };

  const addLostFoundItem = async (type: 'lost' | 'found', itemName: string, description: string, location: string, contactInfo: string, file?: File | null) => {
    if (!identity) return;
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('itemName', itemName);
      formData.append('description', description);
      formData.append('location', location);
      formData.append('authorId', identity.deviceId);
      formData.append('authorName', identity.name);
      formData.append('authorAvatar', identity.avatar);
      formData.append('contactInfo', contactInfo);
      if (file) formData.append('image', file);

      const res = await fetch(`${SERVER_URL}/api/lostfound`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const item = await res.json();
        setLostFoundItems(prev => [item, ...prev]);
        triggerToast(`${type === 'lost' ? 'Lost' : 'Found'} report created.`);
        refreshReputation();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to post report.');
      }
    } catch {}
  };

  const updateLostFoundItemStatus = async (itemId: string, status: 'active' | 'resolved') => {
    try {
      const res = await fetch(`${SERVER_URL}/api/lostfound/${itemId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setLostFoundItems(prev => prev.map(item => item.id === itemId ? { ...item, status } : item));
        triggerToast(`Report status updated to ${status}.`);
      }
    } catch {}
  };

  const refreshReputation = async () => {
    if (!identity) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/reputation/${identity.deviceId}`);
      if (res.ok) {
        setSoulRep(await res.json());
      }
    } catch {}
  };

  // --- Admin stats ---
  const authenticateAdmin = useCallback((adminToken: string) => {
    socketRef.current?.emit('admin-auth', { token: adminToken });
  }, []);

  const banUser = useCallback((socketId: string, userDeviceId: string, ipAddress: string, reason: string) => {
    socketRef.current?.emit('admin-ban-user', { socketId, deviceId: userDeviceId, ipAddress, reason });
  }, []);

  const unbanUser = useCallback((ipOrDeviceId: string) => {
    socketRef.current?.emit('admin-unban', { ipOrDeviceId });
  }, []);

  const getBans = useCallback(() => {
    socketRef.current?.emit('admin-get-bans');
  }, []);

  const socketId = socketRef.current?.id;
  const isLoggedIn = !!token;

  return {
    connected,
    identity,
    messages,
    soulCount,
    typingUsers,
    toasts,
    triggerToast,
    sendMessage,
    reactToMessage,
    sendTypingStart,
    sendTypingStop,
    reportMessage,
    socketId,

    // Session controls
    login,
    logout,
    isLoggedIn,

    // Realms navigation
    currentRoom,
    switchRoom,

    // Matchmaking
    matchStatus,
    partner,
    joinMatchmaking,
    leaveMatchmaking,
    skipMatch,

    // WebRTC Toggles
    isVoiceActive,
    isVideoActive,
    isScreenSharing,
    isPartnerVoiceActive,
    isPartnerVideoActive,
    toggleVoice,
    toggleVideo,
    toggleScreenShare,
    localStream,
    remoteStream,
    rtcQuality,

    // Feed / Wall states
    posts,
    confessions,
    memes,
    marketplaceItems,
    lostFoundItems,
    tempRooms,
    soulRep,
    addPost,
    votePost,
    reactPost,
    votePoll,
    addComment,
    addConfession,
    reactConfession,
    addMeme,
    reactMeme,
    addMarketplaceItem,
    updateMarketplaceItemStatus,
    addLostFoundItem,
    updateLostFoundItemStatus,
    createTempRoom,

    // Admin
    isAdmin,
    adminUsers,
    adminBans,
    adminError,
    authenticateAdmin,
    banUser,
    unbanUser,
    getBans,

    // Bans
    isBanned,
    banReason
  };
}
