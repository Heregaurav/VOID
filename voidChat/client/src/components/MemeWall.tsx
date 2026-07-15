import React, { useState } from 'react';
import { Meme, Identity } from '../types';

interface MemeWallProps {
  memes: Meme[];
  identity: Identity | null;
  addMeme: (title: string, file: File) => Promise<void>;
  reactMeme: (id: string, type: string) => Promise<void>;
}

export function MemeWall({ memes, identity, addMeme, reactMeme }: MemeWallProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) return;
    addMeme(title, file);
    setTitle('');
    setFile(null);
  };

  return (
    <div className="meme-wall-container">
      <div className="feed-header">
        <h2 className="section-title">// MEME WALL: LAUGHTER IN THE FOG</h2>
        <p className="section-subtitle">A collection of dark humor shared from the recesses of campus life.</p>
      </div>

      <form onSubmit={handleSubmit} className="creepy-form meme-submit-box">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meme title / caption..."
          maxLength={80}
          className="creepy-input meme-input-title"
          required
        />
        <div className="meme-submit-controls">
          <div className="file-input-wrapper">
            <button type="button" className="flat-btn border-fog">
              📷 {file ? file.name.slice(0, 18) : 'Select Image'}
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <button type="submit" className="flat-btn blood-bg">
            Upload Vision 💀
          </button>
        </div>
      </form>

      <div className="memes-list-grid">
        {memes.length === 0 ? (
          <div className="empty-wall-message">
            <span className="empty-skull">🕸️</span>
            <p>No visions have manifested here yet.</p>
          </div>
        ) : (
          memes.map((meme) => (
            <div key={meme.id} className="meme-polaroid">
              <div className="meme-img-wrap">
                <img src={meme.imageUrl} alt="Meme" className="meme-img" />
              </div>
              <div className="meme-footer">
                <p className="meme-caption">{meme.title}</p>
                <div className="meme-reactions">
                  {['skull', 'blood', 'eye'].map((type) => {
                    const emojis: Record<string, string> = { skull: '💀', blood: '🩸', eye: '👁️' };
                    const reactList = meme.reactions?.[type] || [];
                    const active = reactList.includes(identity?.deviceId || '');

                    return (
                      <button
                        key={type}
                        className={`reaction-badge small ${active ? 'user-reacted' : ''}`}
                        onClick={() => reactMeme(meme.id, type)}
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
