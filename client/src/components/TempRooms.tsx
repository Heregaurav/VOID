import React, { useState, useEffect, useRef } from 'react';
import { TempRoom, Identity } from '../types';

interface TempRoomsProps {
  rooms: TempRoom[];
  currentRoom: string;
  identity: Identity | null;
  switchRoom: (roomName: string) => void;
  createTempRoom: (name: string, type: 'text' | 'voice' | 'video', durationMinutes: number) => void;
  
  // Media states
  isVoiceActive: boolean;
  isVideoActive: boolean;
  isScreenSharing: boolean;
  toggleVoice: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isPartnerVoiceActive: boolean;
  isPartnerVideoActive: boolean;
  rtcQuality: { rtt: number; packetLoss: number };
}

export function TempRooms({
  rooms,
  currentRoom,
  identity,
  switchRoom,
  createTempRoom,
  isVoiceActive,
  isVideoActive,
  isScreenSharing,
  toggleVoice,
  toggleVideo,
  toggleScreenShare,
  localStream,
  remoteStream,
  isPartnerVoiceActive,
  isPartnerVideoActive,
  rtcQuality
}: TempRoomsProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'video'>('text');
  const [duration, setDuration] = useState(15);
  const [showAddForm, setShowAddForm] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Sync streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Picture in Picture triggers
  const handleTriggerPiP = async () => {
    if (remoteVideoRef.current) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await remoteVideoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.error('PiP error:', err);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createTempRoom(name, type, duration);
    setName('');
    setShowAddForm(false);
  };

  // Filter valid temp rooms
  const activeRooms = rooms.filter(r => r.expiresAt > Date.now());

  // Determine current active room type
  const activeRoomData = rooms.find(r => r.id === currentRoom);
  const isMediaRoom = activeRoomData && (activeRoomData.type === 'voice' || activeRoomData.type === 'video');

  return (
    <div className="temp-rooms-container">
      <div className="feed-header flex-header">
        <div>
          <h2 className="section-title">// TEMPORARY ROOMS: MATERIALIZED VOIDS</h2>
          <p className="section-subtitle">Create temporary realms for real-time text, voice, or video whispers. Rooms dissolve when time expires.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flat-btn border-blood toggle-form-btn"
        >
          {showAddForm ? 'Close Portal' : '🔮 Materialize Room'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="creepy-form temp-room-form">
          <div className="form-row">
            <div className="form-group half">
              <label className="creepy-label">// REALM NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Study Dungeon, Silent Corner..."
                maxLength={25}
                className="creepy-input"
                required
              />
            </div>
            <div className="form-group quarter">
              <label className="creepy-label">// REALM TYPE</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="creepy-input creepy-select"
              >
                <option value="text">TEXT ONLY</option>
                <option value="voice">VOICE CHAT</option>
                <option value="video">VIDEO STREAM</option>
              </select>
            </div>
            <div className="form-group quarter">
              <label className="creepy-label">// LIFESPAN (MINUTES)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={5}
                max={120}
                className="creepy-input"
                required
              />
            </div>
          </div>
          <button type="submit" className="flat-btn blood-bg submit-listing-btn">
            Materialize ☠
          </button>
        </form>
      )}

      {/* Media interface if currently in a media room */}
      {isMediaRoom && (
        <div className="webrtc-call-panel temp-room-call">
          <h3 className="media-panel-title">
            🎙️ {activeRoomData.name.toUpperCase()} ({activeRoomData.type.toUpperCase()})
          </h3>
          
          <div className="videos-layout">
            <div className="video-box local">
              <span className="video-label">YOU (ANONYMOUS)</span>
              {localStream && (isVideoActive || isScreenSharing) ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="webrtc-video" />
              ) : (
                <div className="video-placeholder">
                  <span className="phantom-logo">{identity?.avatar || '💀'}</span>
                  <p>Muted / No Camera</p>
                </div>
              )}
            </div>

            <div className="video-box remote">
              <span className="video-label">OTHERS IN ROOM</span>
              {remoteStream && (isPartnerVideoActive) ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="webrtc-video" />
              ) : (
                <div className="video-placeholder">
                  <span className="phantom-logo">👥</span>
                  <p>No Incoming video stream</p>
                </div>
              )}
            </div>
          </div>

          {/* RTT / Quality Metrics */}
          {localStream && (
            <div className="rtc-quality-stats">
              <span>Latency (RTT): {Math.round(rtcQuality.rtt)}ms</span> | 
              <span> Loss: {Math.round(rtcQuality.packetLoss)}%</span>
            </div>
          )}

          <div className="webrtc-controls">
            <button
              onClick={toggleVoice}
              className={`flat-btn ${isVoiceActive ? 'blood-bg' : 'border-fog'}`}
            >
              {isVoiceActive ? '🎙️ Mic Active' : '🔇 Mic Off'}
            </button>
            
            {activeRoomData.type === 'video' && (
              <>
                <button
                  onClick={toggleVideo}
                  className={`flat-btn ${isVideoActive ? 'blood-bg' : 'border-fog'}`}
                >
                  {isVideoActive ? '📷 Cam Active' : '📷 Cam Off'}
                </button>
                <button
                  onClick={toggleScreenShare}
                  className={`flat-btn ${isScreenSharing ? 'blood-bg' : 'border-fog'}`}
                >
                  {isScreenSharing ? '💻 Screen Active' : '💻 Share Screen'}
                </button>
              </>
            )}

            {remoteStream && isPartnerVideoActive && (
              <button onClick={handleTriggerPiP} className="flat-btn border-fog">
                📺 Picture-in-Picture
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rooms-materialized-grid">
        <div className="rooms-column">
          <h3 className="column-title">// STABLE REALMS</h3>
          <div
            className={`room-strip-button ${currentRoom === 'lobby' ? 'active' : ''}`}
            onClick={() => switchRoom('lobby')}
          >
            <span className="r-icon">🩸</span>
            <div className="r-details">
              <span className="r-name">LOBBY</span>
              <span className="r-meta">Default entry point · Text room</span>
            </div>
          </div>
          <div
            className={`room-strip-button ${currentRoom === 'graveyard' ? 'active' : ''}`}
            onClick={() => switchRoom('graveyard')}
          >
            <span className="r-icon">🪦</span>
            <div className="r-details">
              <span className="r-name">GRAVEYARD</span>
              <span className="r-meta">Quiet whispering realm · Text room</span>
            </div>
          </div>
          <div
            className={`room-strip-button ${currentRoom === 'purgatory' ? 'active' : ''}`}
            onClick={() => switchRoom('purgatory')}
          >
            <span className="r-icon">🕸️</span>
            <div className="r-details">
              <span className="r-name">PURGATORY</span>
              <span className="r-meta">Holding cell of thoughts · Text room</span>
            </div>
          </div>
          <div
            className={`room-strip-button ${currentRoom === 'abyss' ? 'active' : ''}`}
            onClick={() => switchRoom('abyss')}
          >
            <span className="r-icon">🌑</span>
            <div className="r-details">
              <span className="r-name">THE ABYSS</span>
              <span className="r-meta">No return, absolute darkness · Text room</span>
            </div>
          </div>
        </div>

        <div className="rooms-column">
          <h3 className="column-title">// MATERIALIZED TEMP REALMS</h3>
          {activeRooms.length === 0 ? (
            <div className="empty-rooms-label">No materialized rooms exist yet.</div>
          ) : (
            activeRooms.map((room) => {
              const remaining = Math.max(0, Math.round((room.expiresAt - Date.now()) / 1000 / 60));
              return (
                <div
                  key={room.id}
                  className={`room-strip-button ${currentRoom === room.id ? 'active' : ''}`}
                  onClick={() => switchRoom(room.id)}
                >
                  <span className="r-icon">
                    {room.type === 'text' ? '💬' : room.type === 'voice' ? '🎙️' : '📹'}
                  </span>
                  <div className="r-details">
                    <span className="r-name">{room.name.toUpperCase()}</span>
                    <span className="r-meta">
                      Type: {room.type.toUpperCase()} · Lifespan: {remaining}m left
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
