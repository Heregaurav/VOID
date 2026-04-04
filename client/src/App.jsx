import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { useSocket } from './useSocket';

// ─── Helpers ─────────────────────────────────────────────
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CharCount({ value, max }) {
  const remaining = max - value.length;
  const cls = remaining < 20 ? 'danger' : remaining < 60 ? 'warn' : '';
  if (remaining >= max - 10) return null;
  return <span className={`char-count ${cls}`}>{remaining}</span>;
}

// ─── Toast system ─────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}

// ─── Message Component ────────────────────────────────────
function Message({ msg, isMine, socketId, onReport }) {
  if (msg.isSystem) {
    return <div className="sys-msg">// {msg.text} //</div>;
  }

  return (
    <div className={`msg-group ${isMine ? 'mine' : ''}`}>
      <div className="msg-avatar-wrap">{msg.avatar}</div>
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-author">{isMine ? 'YOU' : msg.name}</span>
          {' · '}
          {formatTime(msg.ts)}
        </div>
        <div className="msg-bubble">
          <span className="msg-text">{msg.text}</span>
        </div>
      </div>
      {!isMine && (
        <button
          className="msg-report"
          onClick={() => onReport(msg.id)}
          title="Report this soul"
        >
          ⚑
        </button>
      )}
    </div>
  );
}

// ─── Typing Bar ───────────────────────────────────────────
function TypingBar({ typingUsers }) {
  const typers = Object.values(typingUsers);
  if (typers.length === 0) return <div className="typing-bar" />;

  const label =
    typers.length === 1
      ? `${typers[0].avatar} ${typers[0].name} is whispering`
      : `${typers.length} souls are whispering`;

  return (
    <div className="typing-bar">
      <div className="typing-dots">
        <span /><span /><span />
      </div>
      {label}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────
function Sidebar({ identity, soulCount, connected, socketId, typingUsers }) {
  const connClass = connected ? 'connected' : 'disconnected';
  const connLabel = connected ? 'CONNECTED' : 'RECONNECTING...';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">☠ VOID</div>
        <div className="logo-sub">ANONYMOUS CHAT</div>
      </div>

      {identity && (
        <div className="my-card">
          <div className="my-card-label">YOUR SOUL</div>
          <div className="my-identity">
            <div className="my-avatar">{identity.avatar}</div>
            <div className="my-name">
              {identity.name}
              <span>Anonymous</span>
            </div>
          </div>
        </div>
      )}

      <div className="soul-count-wrap">
        <div className="soul-pulse" />
        <span className="soul-count-text">
          <strong>{soulCount}</strong> {soulCount === 1 ? 'soul' : 'souls'} online
        </span>
      </div>

      <div className="users-section">
        <div className="users-section-label">WANDERING SOULS</div>
        {Object.entries(typingUsers).map(([id, u]) => (
          <div key={id} className="user-item">
            <span className="u-avatar">{u.avatar}</span>
            <span className="u-name">{u.name}</span>
          </div>
        ))}
      </div>

      <div className="conn-status">
        <div className={`conn-dot ${connClass}`} />
        <span className={`conn-label ${connClass}`}>{connLabel}</span>
      </div>
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────
export default function App() {
  const {
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
  } = useSocket();

  const [input, setInput] = useState('');
  const [toasts, setToasts] = useState([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isAtBottomRef = useRef(true);

  const MAX_LEN = 300;

  // ── Auto-scroll ────────────────────────────────────────
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
  }, []);

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
  };

  // ── Toasts ─────────────────────────────────────────────
  const addToast = useCallback((text) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // ── Typing ─────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    sendTypingStart();
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTypingStop(), 2500);
  };

  // ── Send ───────────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text || !connected) return;
    sendMessage(text);
    setInput('');
    clearTimeout(typingTimerRef.current);
    sendTypingStop();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Report ─────────────────────────────────────────────
  const handleReport = (msgId) => {
    reportMessage(msgId);
    addToast('⚑ Report sent. The void will judge them.');
  };

  return (
    <div className="app">
      {/* CRT effect */}
      <div className="crt-overlay">
        <div className="crt-scanlines" />
        <div className="crt-vignette" />
      </div>

      <Sidebar
        identity={identity}
        soulCount={soulCount}
        connected={connected}
        socketId={socketId}
        typingUsers={typingUsers}
      />

      <main className="chat-main">
        {/* Messages */}
        <div
          className="messages-area"
          ref={messagesAreaRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="empty-void">
              <div className="empty-skull">💀</div>
              <div className="empty-text">
                THE VOID AWAITS<br />YOUR WHISPERS...
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <Message
                key={msg.id || msg.ts}
                msg={msg}
                isMine={msg.authorId === socketId}
                socketId={socketId}
                onReport={handleReport}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll-to-bottom */}
        {showScrollBtn && (
          <button className="scroll-btn" onClick={scrollToBottom} title="Scroll to bottom">
            ↓
          </button>
        )}

        {/* Typing indicator */}
        <TypingBar typingUsers={typingUsers} />

        {/* Input area */}
        <div className="input-area">
          <div className="input-wrap">
            <textarea
              className="chat-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={connected ? 'speak into the void...' : 'connecting to the dark...'}
              maxLength={MAX_LEN}
              rows={1}
              disabled={!connected}
            />
            <CharCount value={input} max={MAX_LEN} />
          </div>
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!connected || !input.trim()}
          >
            SEND
          </button>
        </div>
      </main>

      <Toast toasts={toasts} />
    </div>
  );
}
