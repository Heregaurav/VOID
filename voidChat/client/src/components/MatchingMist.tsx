import React, { useEffect, useRef } from 'react';
import { Partner, Identity } from '../types';

interface MatchingMistProps {
  matchStatus: 'idle' | 'searching' | 'paired';
  partner: Partner | null;
  identity: Identity | null;
  joinMatchmaking: () => void;
  leaveMatchmaking: () => void;
  skipMatch: () => void;

  // Media
  isVoiceActive: boolean;
  isVideoActive: boolean;
  toggleVoice: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isPartnerVoiceActive: boolean;
  isPartnerVideoActive: boolean;
  rtcQuality: { rtt: number; packetLoss: number };
}

export function MatchingMist({
  matchStatus,
  partner,
  identity,
  joinMatchmaking,
  leaveMatchmaking,
  skipMatch,
  isVoiceActive,
  isVideoActive,
  toggleVoice,
  toggleVideo,
  localStream,
  remoteStream,
  isPartnerVoiceActive,
  isPartnerVideoActive,
  rtcQuality
}: MatchingMistProps) {
  const localVidRef = useRef<HTMLVideoElement | null>(null);
  const remoteVidRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVidRef.current && localStream) {
      localVidRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVidRef.current && remoteStream) {
      remoteVidRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="matching-mist-container">
      {matchStatus === 'idle' && (
        <div className="matching-idle-screen">
          <div className="limbo-silhouette" />
          <h2 className="section-title">// THE MATCHING MIST</h2>
          <p className="section-subtitle">Step into the fog. Connect anonymously with a random soul on campus.</p>
          <button onClick={joinMatchmaking} className="flat-btn blood-bg start-match-btn">
            Step Into The Fog 🔮
          </button>
        </div>
      )}

      {matchStatus === 'searching' && (
        <div className="matching-searching-screen">
          <div className="foggy-mist-overlay" />
          <div className="pulsing-heartbeat-logo">☠</div>
          <h2 className="searching-title">WANDERING IN THE MIST...</h2>
          <p className="searching-subtitle">Searching for another lost soul. Speak into the darkness.</p>
          <button onClick={leaveMatchmaking} className="flat-btn border-fog leave-match-btn">
            Flee the Mist 🚪
          </button>
        </div>
      )}

      {matchStatus === 'paired' && partner && (
        <div className="matching-paired-screen">
          <div className="matched-header">
            <div className="soul-title">
              Paired with: <span className="soul-name">{partner.avatar} {partner.name}</span>
            </div>
            <div className="matched-header-actions">
              <button onClick={skipMatch} className="flat-btn blood-bg skip-soul-btn">
                Skip Soul ⚡
              </button>
            </div>
          </div>

          <div className="paired-media-grid">
            <div className="video-box local">
              <span className="video-label">YOUR PROFILE</span>
              {localStream && isVideoActive ? (
                <video ref={localVidRef} autoPlay playsInline muted className="webrtc-video" />
              ) : (
                <div className="video-placeholder">
                  <span className="phantom-logo">{identity?.avatar || '💀'}</span>
                  <p>Muted / No Camera</p>
                </div>
              )}
            </div>

            <div className="video-box remote">
              <span className="video-label">PARTNER PROFILE</span>
              {remoteStream && isPartnerVideoActive ? (
                <video ref={remoteVidRef} autoPlay playsInline className="webrtc-video" />
              ) : (
                <div className="video-placeholder">
                  <span className="phantom-logo">{partner.avatar}</span>
                  <p>{isPartnerVoiceActive ? 'Voice Connection Active' : 'No Incoming Video'}</p>
                </div>
              )}
            </div>
          </div>

          {/* WebRTC Connection Statistics */}
          {localStream && (
            <div className="rtc-quality-stats">
              <span>Connection RTT: {Math.round(rtcQuality.rtt)}ms</span> | 
              <span> Loss: {Math.round(rtcQuality.packetLoss)}%</span>
            </div>
          )}

          <div className="paired-controls">
            <button
              onClick={toggleVoice}
              className={`flat-btn ${isVoiceActive ? 'blood-bg' : 'border-fog'}`}
            >
              {isVoiceActive ? '🎙️ Mic Active' : '🔇 Mic Off'}
            </button>
            <button
              onClick={toggleVideo}
              className={`flat-btn ${isVideoActive ? 'blood-bg' : 'border-fog'}`}
            >
              {isVideoActive ? '📷 Cam Active' : '📷 Cam Off'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
