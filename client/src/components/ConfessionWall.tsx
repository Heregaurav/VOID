import React, { useState } from 'react';
import { Confession, Identity } from '../types';

interface ConfessionWallProps {
  confessions: Confession[];
  identity: Identity | null;
  addConfession: (text: string) => Promise<void>;
  reactConfession: (id: string, type: string) => Promise<void>;
}

export function ConfessionWall({ confessions, identity, addConfession, reactConfession }: ConfessionWallProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addConfession(text);
    setText('');
  };

  return (
    <div className="confession-wall-container">
      <div className="feed-header">
        <h2 className="section-title">// CONFESSION WALL: THE SILENT CHAMBER</h2>
        <p className="section-subtitle">Exorcise your secrets into the brickwork. They will remain carved in the dark forever.</p>
      </div>

      <form onSubmit={handleSubmit} className="creepy-form confession-submit-box">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I have to confess that..."
          maxLength={250}
          className="creepy-input confession-textarea"
          required
        />
        <div className="confession-submit-bar">
          <span className="info-txt">// Max 250 characters</span>
          <button type="submit" className="flat-btn blood-bg">
            Carve Into Brick 🩸
          </button>
        </div>
      </form>

      <div className="confessions-grid">
        {confessions.length === 0 ? (
          <div className="empty-wall-message">
            <span className="empty-skull">👁️</span>
            <p>No secrets have been whispered here yet.</p>
          </div>
        ) : (
          confessions.map((conf) => (
            <div key={conf.id} className="confession-brick">
              <p className="confession-text">"{conf.text}"</p>
              
              <div className="confession-actions">
                <span className="brick-ts">// {new Date(conf.createdAt).toLocaleDateString()}</span>
                <div className="brick-reactions">
                  {['skull', 'blood', 'eye'].map((type) => {
                    const emojis: Record<string, string> = { skull: '💀', blood: '🩸', eye: '👁️' };
                    const reactList = conf.reactions?.[type] || [];
                    const active = reactList.includes(identity?.deviceId || '');

                    return (
                      <button
                        key={type}
                        className={`reaction-badge small ${active ? 'user-reacted' : ''}`}
                        onClick={() => reactConfession(conf.id, type)}
                      >
                        <span>{emojis[type]}</span>
                        <span>{reactList.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
