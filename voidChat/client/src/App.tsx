import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { useSocket } from './hooks/useSocket';
import { useAudio } from './hooks/useAudio';
import { CampusFeed } from './components/CampusFeed';
import { ConfessionWall } from './components/ConfessionWall';
import { MemeWall } from './components/MemeWall';
import { Marketplace } from './components/Marketplace';
import { LostFound } from './components/LostFound';
import { TempRooms } from './components/TempRooms';
import { MatchingMist } from './components/MatchingMist';
import { AdminDashboard } from './components/AdminDashboard';
import { Message as MessageType, ToastType } from './types';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const socket = useSocket();
  const audio = useAudio();
  
  // Navigation tabs: 'chat' | 'feed' | 'matching' | 'confessions' | 'memes' | 'marketplace' | 'lostfound' | 'temprooms' | 'admin'
  const [activeTab, setActiveTab] = useState<string>('chat');
  
  // Local chat typing input state
  const [inputText, setInputText] = useState('');
  const [inputImage, setInputImage] = useState<File | null>(null);
  
  // Sidebar state for mobile responsiveness
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Login Form States
  const [emailInput, setEmailInput] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const email = emailInput.trim();
    if (!email) {
      setLoginError('An email is required.');
      return;
    }
    if (!email.toLowerCase().endsWith('@iiitdwd.ac.in')) {
      setLoginError('Access denied. You must use an @iiitdwd.ac.in email address.');
      return;
    }

    setLoadingLogin(true);
    const success = await socket.login(email);
    setLoadingLogin(false);
    if (!success) {
      setLoginError('Failed to verify identity in the Void.');
    }
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Play audio cue on new incoming message (if audio enabled)
  useEffect(() => {
    if (socket.messages.length > 0 && activeTab === 'chat') {
      audio.playWhisperCue();
    }
    // Auto scroll to bottom in chat tab
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [socket.messages, activeTab]);

  // Audio Static on matchmaking trigger
  useEffect(() => {
    if (socket.matchStatus === 'searching') {
      audio.playRadioStatic(2.0);
    } else if (socket.matchStatus === 'paired') {
      audio.playRadioStatic(0.5);
    }
  }, [socket.matchStatus]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !inputImage) return;

    if (inputImage) {
      const reader = new FileReader();
      reader.readAsDataURL(inputImage);
      reader.onload = () => {
        const base64 = reader.result as string;
        socket.sendMessage(inputText, base64);
        setInputText('');
        setInputImage(null);
      };
    } else {
      socket.sendMessage(inputText, null);
      setInputText('');
    }
  };

  const handleKeyDown = () => {
    socket.sendTypingStart();
    const timeout = setTimeout(() => {
      socket.sendTypingStop();
    }, 1500);
    return () => clearTimeout(timeout);
  };

  if (!socket.isLoggedIn) {
    return (
      <div className="app login-layout">
        {/* Cinematic CRT Scanlines and vignette */}
        <div className="crt-overlay">
          <div className="crt-scanlines" />
          <div className="crt-vignette" />
        </div>
        
        {/* Dynamic Toast Popups */}
        <div className="toast-container">
          {socket.toasts.map((toast) => (
            <div key={toast.id} className="toast">// {toast.text} //</div>
          ))}
        </div>

        <div className="login-card">
          <div className="login-logo-glow">☠ VOID ☠</div>
          <div className="login-subtitle">CAMPUS ANONYMOUS PORTAL</div>
          <div className="login-divider" />
          <p className="login-instruction">
            Relinquish your identity. Enter your IIIT Dharwad email to materialize your digital soul. Your email is securely hashed and never stored.
          </p>

          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="input-group">
              <label className="login-label">COLLEGE EMAIL</label>
              <input
                type="email"
                placeholder="student@iiitdwd.ac.in"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className={`login-input ${loginError ? 'input-error' : ''}`}
                disabled={loadingLogin}
              />
              <span className="input-domain-hint">Must end with @iiitdwd.ac.in</span>
            </div>

            {loginError && <div className="login-error-msg">⚠️ {loginError}</div>}

            <button type="submit" className="login-submit-btn" disabled={loadingLogin}>
              {loadingLogin ? 'MATERIALIZING...' : 'ENTER THE FOG'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Cinematic CRT Scanlines and vignette */}
      <div className="crt-overlay">
        <div className="crt-scanlines" />
        <div className="crt-vignette" />
      </div>

      {/* Dynamic Toast Popups */}
      <div className="toast-container">
        {socket.toasts.map((toast) => (
          <div key={toast.id} className="toast">// {toast.text} //</div>
        ))}
      </div>

      {/* Ambient Audio controller overlay */}
      <button
        onClick={audio.toggleAudio}
        className={`audio-controller-badge ${audio.isEnabled ? 'active' : ''}`}
        title={audio.isEnabled ? 'Mute Heartbeat / Drone' : 'Unmute Ambient Soundscapes'}
      >
        {audio.isEnabled ? '🔊 AMBIENT ACTIVE' : '🔇 AMBIENT MUTED'}
      </button>

      {/* Mobile Header */}
      <header className="mobile-header">
        <button onClick={() => setSidebarOpen(true)} className="burger-menu-btn">☰</button>
        <span className="mobile-logo">☠ VOID</span>
        <span className="mobile-souls-indicator">👤 {socket.soulCount}</span>
      </header>

      {/* Sidebar Panel */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">☠ VOID</div>
          <div className="logo-sub">ANONYMOUS PLATFORM</div>
          <button onClick={() => setSidebarOpen(false)} className="close-sidebar-mobile">✕</button>
        </div>

        {/* User profile with badges & reputation score */}
        {socket.identity && (
          <div className="my-card">
            <div className="my-card-label">YOUR PROFILE</div>
            <div className="my-identity">
              <span className="my-avatar">{socket.identity.avatar}</span>
              <div className="my-name">
                {socket.identity.name}
                <div className="my-reputation">
                  Reputation: <code>{socket.soulRep?.score || 0}</code>
                </div>
              </div>
            </div>
            
            {socket.soulRep && socket.soulRep.badges.length > 0 && (
              <div className="badges-list">
                {socket.soulRep.badges.map((badge, idx) => (
                  <span key={idx} className="badge-pill" title="Anonymous reputation level">
                    🔮 {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="soul-count-wrap">
          <span className="soul-pulse" />
          <span className="soul-count-text">
            <strong>{socket.soulCount}</strong> souls active online
          </span>
        </div>

        {/* Navigation Realms & Channels */}
        <nav className="navigation-list">
          <div className="nav-section-label">REALM CORRIDORS</div>
          
          <button
            onClick={() => { setActiveTab('chat'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
          >
            💬 Realtime Channels
          </button>
          
          <button
            onClick={() => { setActiveTab('feed'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'feed' ? 'active' : ''}`}
          >
            📊 Campus Feed
          </button>
          
          <button
            onClick={() => { setActiveTab('matching'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'matching' ? 'active' : ''}`}
          >
            🔮 Matching Mist
          </button>
          
          <button
            onClick={() => { setActiveTab('confessions'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'confessions' ? 'active' : ''}`}
          >
            🩸 Confessions
          </button>
          
          <button
            onClick={() => { setActiveTab('memes'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'memes' ? 'active' : ''}`}
          >
            📷 Meme Wall
          </button>
          
          <button
            onClick={() => { setActiveTab('marketplace'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'marketplace' ? 'active' : ''}`}
          >
            ⚖️ Marketplace
          </button>
          
          <button
            onClick={() => { setActiveTab('lostfound'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'lostfound' ? 'active' : ''}`}
          >
            🔍 Lost & Found
          </button>

          <button
            onClick={() => { setActiveTab('temprooms'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'temprooms' ? 'active' : ''}`}
          >
            🧪 Materialize Room
          </button>

          <button
            onClick={() => { setActiveTab('admin'); setSidebarOpen(false); }}
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
          >
            🛡️ Surveillance
          </button>

          <button
            onClick={() => { socket.logout(); setSidebarOpen(false); }}
            className="nav-btn logout-sidebar-btn"
            style={{ marginTop: 'auto', borderTop: '1px solid rgba(220, 53, 69, 0.2)', color: '#dc3545' }}
          >
            ☠ Exile Soul (Logout)
          </button>
        </nav>
      </aside>

      {/* Main content display window */}
      <main className="main-content">
        {socket.isBanned ? (
          <div className="banned-gate">
            <span className="exile-icon">☠</span>
            <h1 className="exile-title">YOU HAVE BEEN EXILED</h1>
            <p className="exile-reason">Reason: "{socket.banReason}"</p>
            <p className="exile-footer">Your session has dissolved. The darkness does not welcome you.</p>
          </div>
        ) : (
          <>
            {/* 1. Realtime chat channel tab */}
            {activeTab === 'chat' && (
              <div className="chat-window">
                <div className="chat-header">
                  <span className="room-indicator">// CURRENT ROOM: {socket.currentRoom.toUpperCase()}</span>
                </div>
                
                <div className="messages-area">
                  {socket.messages.length === 0 ? (
                    <div className="empty-chat-state">
                      <span className="floating-skull">💀</span>
                      <p>The channel is silent. Whisper something into the void.</p>
                    </div>
                  ) : (
                    socket.messages.map((msg) => {
                      const isMine = msg.authorId === socket.socketId;
                      const reactionsList = ['skull', 'blood', 'eye'];
                      const emojis: Record<string, string> = { skull: '💀', blood: '🩸', eye: '👁️' };

                      if (msg.isSystem) {
                        return (
                          <div key={msg.id} className="system-msg-row">
                            // {msg.text} //
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={`msg-row ${isMine ? 'mine' : ''}`}>
                          <span className="msg-avatar-icon">{msg.avatar}</span>
                          <div className="msg-bubble-container">
                            <div className="msg-author-meta">
                              <span>{isMine ? 'YOU' : msg.name}</span> · 
                              <span>{formatTime(msg.ts)}</span>
                            </div>
                            
                            <div className="msg-bubble">
                              {msg.imageUrl && (
                                <div className="msg-image-wrap">
                                  <img src={msg.imageUrl} alt="visions" className="msg-img" />
                                </div>
                              )}
                              {msg.text && <p className="msg-text">{msg.text}</p>}

                              {/* Message hover reactions bar */}
                              <div className="msg-reaction-bar">
                                {reactionsList.map((type) => (
                                  <button
                                    key={type}
                                    className={`react-btn ${msg.reactions?.[type]?.includes(socket.socketId || '') ? 'active' : ''}`}
                                    onClick={() => socket.reactToMessage(msg.id, type)}
                                  >
                                    {emojis[type]}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Render active reaction counts */}
                            {msg.reactions && Object.values(msg.reactions).some(v => v.length > 0) && (
                              <div className="reactions-totals">
                                {reactionsList.map((type) => {
                                  const count = msg.reactions[type]?.length || 0;
                                  if (count === 0) return null;
                                  return (
                                    <span key={type} className="react-total-pill">
                                      {emojis[type]} {count}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {!isMine && (
                            <button
                              onClick={() => socket.reportMessage(msg.id)}
                              className="report-soul-btn"
                              title="Report this soul to admin"
                            >
                              ⚑
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing indicators */}
                <div className="typing-status-bar">
                  {Object.values(socket.typingUsers).length > 0 && (
                    <div className="typing-indicator">
                      <div className="typing-dots"><span /><span /><span /></div>
                      <span>Whispers are gathering in the dark...</span>
                    </div>
                  )}
                </div>

                {/* Chat message composer */}
                <form onSubmit={handleSendMessage} className="chat-composer">
                  <div className="composer-input-row">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Speak into the dark..."
                      className="composer-text-input"
                      maxLength={300}
                    />
                    
                    <div className="image-uploader-btn-wrapper">
                      <button type="button" className="composer-attach-btn">
                        📷 {inputImage ? 'Selected' : 'Image'}
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setInputImage(e.target.files?.[0] || null)}
                      />
                    </div>
                    
                    <button type="submit" className="composer-send-btn">
                      SEND ☠
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. Campus Feed tab */}
            {activeTab === 'feed' && (
              <CampusFeed
                posts={socket.posts}
                identity={socket.identity}
                addPost={socket.addPost}
                votePost={socket.votePost}
                reactPost={socket.reactPost}
                votePoll={socket.votePoll}
                addComment={socket.addComment}
              />
            )}

            {/* 3. Matching Mist tab */}
            {activeTab === 'matching' && (
              <MatchingMist
                matchStatus={socket.matchStatus}
                partner={socket.partner}
                identity={socket.identity}
                joinMatchmaking={socket.joinMatchmaking}
                leaveMatchmaking={socket.leaveMatchmaking}
                skipMatch={socket.skipMatch}
                isVoiceActive={socket.isVoiceActive}
                isVideoActive={socket.isVideoActive}
                toggleVoice={socket.toggleVoice}
                toggleVideo={socket.toggleVideo}
                localStream={socket.localStream}
                remoteStream={socket.remoteStream}
                isPartnerVoiceActive={socket.isPartnerVoiceActive}
                isPartnerVideoActive={socket.isPartnerVideoActive}
                rtcQuality={socket.rtcQuality}
              />
            )}

            {/* 4. Confession Wall tab */}
            {activeTab === 'confessions' && (
              <ConfessionWall
                confessions={socket.confessions}
                identity={socket.identity}
                addConfession={socket.addConfession}
                reactConfession={socket.reactConfession}
              />
            )}

            {/* 5. Meme Wall tab */}
            {activeTab === 'memes' && (
              <MemeWall
                memes={socket.memes}
                identity={socket.identity}
                addMeme={socket.addMeme}
                reactMeme={socket.reactMeme}
              />
            )}

            {/* 6. Campus Marketplace tab */}
            {activeTab === 'marketplace' && (
              <Marketplace
                items={socket.marketplaceItems}
                identity={socket.identity}
                addMarketplaceItem={socket.addMarketplaceItem}
                updateMarketplaceItemStatus={socket.updateMarketplaceItemStatus}
              />
            )}

            {/* 7. Lost & Found tab */}
            {activeTab === 'lostfound' && (
              <LostFound
                items={socket.lostFoundItems}
                identity={socket.identity}
                addLostFoundItem={socket.addLostFoundItem}
                updateLostFoundItemStatus={socket.updateLostFoundItemStatus}
              />
            )}

            {/* 8. Temporary Rooms creator tab */}
            {activeTab === 'temprooms' && (
              <TempRooms
                rooms={socket.tempRooms}
                currentRoom={socket.currentRoom}
                identity={socket.identity}
                switchRoom={socket.switchRoom}
                createTempRoom={socket.createTempRoom}
                isVoiceActive={socket.isVoiceActive}
                isVideoActive={socket.isVideoActive}
                isScreenSharing={socket.isScreenSharing}
                toggleVoice={socket.toggleVoice}
                toggleVideo={socket.toggleVideo}
                toggleScreenShare={socket.toggleScreenShare}
                localStream={socket.localStream}
                remoteStream={socket.remoteStream}
                isPartnerVoiceActive={socket.isPartnerVoiceActive}
                isPartnerVideoActive={socket.isPartnerVideoActive}
                rtcQuality={socket.rtcQuality}
              />
            )}

            {/* 9. Admin panel tab */}
            {activeTab === 'admin' && (
              <AdminDashboard
                isAdmin={socket.isAdmin}
                adminUsers={socket.adminUsers}
                adminBans={socket.adminBans}
                adminError={socket.adminError}
                authenticateAdmin={socket.authenticateAdmin}
                banUser={socket.banUser}
                unbanUser={socket.unbanUser}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
