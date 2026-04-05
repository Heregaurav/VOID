import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_SERVER_URL ;

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState(null);       // { avatar, name }
  const [messages, setMessages] = useState([]);
  const [soulCount, setSoulCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState({});   // { id: { name, avatar } }
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('your-identity', (data) => {
      setIdentity(data);
    });

    socket.on('history', (msgs) => {
      setMessages(msgs);
    });

    socket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('system-message', (msg) => {
      setMessages((prev) => [...prev, { ...msg, isSystem: true }]);
    });

    socket.on('soul-count', (count) => {
      setSoulCount(count);
    });

    socket.on('user-typing', ({ id, name, avatar }) => {
      setTypingUsers((prev) => ({ ...prev, [id]: { name, avatar } }));
    });

    socket.on('user-stopped-typing', (id) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    socket.on('rate-limited', ({ message }) => {
      // surface as system-ish message
      setMessages((prev) => [
        ...prev,
        { id: 'rl_' + Date.now(), isSystem: true, text: message, ts: Date.now() },
      ]);
    });

    socket.on('report-received', ({ message }) => {
      setMessages((prev) => [
        ...prev,
        { id: 'rep_' + Date.now(), isSystem: true, text: message, ts: Date.now() },
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = useCallback((text) => {
    socketRef.current?.emit('send-message', text);
  }, []);

  const sendTypingStart = useCallback(() => {
    socketRef.current?.emit('typing-start');
  }, []);

  const sendTypingStop = useCallback(() => {
    socketRef.current?.emit('typing-stop');
  }, []);

  const reportMessage = useCallback((messageId) => {
    socketRef.current?.emit('report-message', { messageId });
  }, []);

  const socketId = socketRef.current?.id;

  return {
    connected,
    identity,
    messages,
    soulCount,
    typingUsers,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    reportMessage,
    socketId,
  };
}
