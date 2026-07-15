import React, { useState } from 'react';
import { LostFoundItem, Identity } from '../types';

interface LostFoundProps {
  items: LostFoundItem[];
  identity: Identity | null;
  addLostFoundItem: (type: 'lost' | 'found', itemName: string, description: string, location: string, contactInfo: string, file?: File | null) => Promise<void>;
  updateLostFoundItemStatus: (id: string, status: 'active' | 'resolved') => Promise<void>;
}

export function LostFound({ items, identity, addLostFoundItem, updateLostFoundItemStatus }: LostFoundProps) {
  const [type, setType] = useState<'lost' | 'found'>('lost');
  const [itemName, setItemName] = useState('');
  const [desc, setDesc] = useState('');
  const [loc, setLoc] = useState('');
  const [contact, setContact] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !desc.trim() || !loc.trim() || !contact.trim()) return;
    addLostFoundItem(type, itemName, desc, loc, contact, file);
    setItemName('');
    setDesc('');
    setLoc('');
    setContact('');
    setFile(null);
    setShowForm(false);
  };

  return (
    <div className="lost-found-container">
      <div className="feed-header flex-header">
        <div>
          <h2 className="section-title">// LOST & FOUND: LIMINAL ARTIFACTS</h2>
          <p className="section-subtitle">Items lost or recovered from the liminal corridors of campus.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flat-btn border-blood toggle-form-btn"
        >
          {showForm ? 'Close Portal' : '🔍 File Report'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="creepy-form lostfound-form">
          <div className="form-group">
            <label className="creepy-label">// REPORT TYPE</label>
            <div className="radio-group-horizontal">
              <label className={`radio-label ${type === 'lost' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="lf_type"
                  checked={type === 'lost'}
                  onChange={() => setType('lost')}
                />
                LOST AN ITEM
              </label>
              <label className={`radio-label ${type === 'found' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="lf_type"
                  checked={type === 'found'}
                  onChange={() => setType('found')}
                />
                FOUND AN ITEM
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="creepy-label">// ITEM NAME</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Keys with black skull keychain..."
              className="creepy-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="creepy-label">// DESCRIPTION</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Unique markings, status..."
              className="creepy-input"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label className="creepy-label">// LOCATION (LAST SEEN OR FOUND PLACE)</label>
              <input
                type="text"
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                placeholder="e.g. Library basement room 4B..."
                className="creepy-input"
                required
              />
            </div>
            <div className="form-group half">
              <label className="creepy-label">// CONTACT ALTERNATE DETAILS</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Signal: @soul99..."
                className="creepy-input"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="creepy-label">// PHOTO PROOF (OPTIONAL)</label>
            <div className="file-input-wrapper">
              <button type="button" className="flat-btn border-fog">
                📷 {file ? file.name.slice(0, 20) : 'Upload Snapshot'}
              </button>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <button type="submit" className="flat-btn blood-bg submit-listing-btn">
            Publish Report ☠
          </button>
        </form>
      )}

      <div className="lostfound-list">
        {items.length === 0 ? (
          <div className="empty-wall-message">
            <span className="empty-skull">🔍</span>
            <p>No reports filed in this corridor.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`lf-card ${item.type} ${item.status}`}>
              <div className="lf-header">
                <span className={`lf-tag ${item.type}`}>{item.type.toUpperCase()}</span>
                <span className="lf-status-tag">{item.status.toUpperCase()}</span>
              </div>
              <div className="lf-body-split">
                {item.imageUrl && (
                  <div className="lf-img-wrap">
                    <img src={item.imageUrl} alt={item.itemName} className="lf-img" />
                  </div>
                )}
                <div className="lf-details">
                  <h3 className="lf-title">{item.itemName}</h3>
                  <p className="lf-desc">{item.description}</p>
                  <p className="lf-loc">📍 <strong>Last Location:</strong> {item.location}</p>
                  <p className="lf-contact">📧 <strong>Whisper Contact:</strong> <code>{item.contactInfo}</code></p>
                  <span className="lf-meta">Reported by {item.authorName}</span>
                </div>
              </div>

              {identity && identity.deviceId === item.authorId && item.status === 'active' && (
                <button
                  onClick={() => updateLostFoundItemStatus(item.id, 'resolved')}
                  className="flat-btn border-blood small-btn lf-resolve-btn"
                >
                  Mark as Resolved 🛡️
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
