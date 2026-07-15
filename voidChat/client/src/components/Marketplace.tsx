import React, { useState } from 'react';
import { MarketplaceItem, Identity } from '../types';

interface MarketplaceProps {
  items: MarketplaceItem[];
  identity: Identity | null;
  addMarketplaceItem: (title: string, description: string, price: number, file: File, contactInfo: string) => Promise<void>;
  updateMarketplaceItemStatus: (id: string, status: 'active' | 'sold') => Promise<void>;
}

export function Marketplace({ items, identity, addMarketplaceItem, updateMarketplaceItemStatus }: MarketplaceProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [contact, setContact] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim() || !price || !file || !contact.trim()) return;
    addMarketplaceItem(title, desc, Number(price), file, contact);
    setTitle('');
    setDesc('');
    setPrice('');
    setFile(null);
    setContact('');
    setShowAddForm(false);
  };

  return (
    <div className="marketplace-container">
      <div className="feed-header flex-header">
        <div>
          <h2 className="section-title">// CAMPUS MARKETPLACE: HAUNTED TRADES</h2>
          <p className="section-subtitle">List textbooks, nodes, or artifacts. Maintain anonymity with alternate contacts.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flat-btn border-blood toggle-form-btn"
        >
          {showAddForm ? 'Close Portal' : '🕯️ Post Trade'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="creepy-form marketplace-form">
          <div className="form-group">
            <label className="creepy-label">// ARTIFACT TITLE</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Organic Chemistry Book (Mint Condition)..."
              className="creepy-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="creepy-label">// DESCRIPTION OF POSSESSION</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Provide specifications or conditions..."
              className="creepy-input"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label className="creepy-label">// TRIBUTE PRICE ($)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Tribute required..."
                className="creepy-input"
                required
              />
            </div>
            <div className="form-group half">
              <label className="creepy-label">// CONTACT WHISPER (e.g. Signal / Discord / Telegram)</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="discord: lostsoul#000..."
                className="creepy-input"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="creepy-label">// VISUAL SNAPSHOT</label>
            <div className="file-input-wrapper">
              <button type="button" className="flat-btn border-fog">
                📷 {file ? file.name.slice(0, 20) : 'Upload Image'}
              </button>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
          </div>

          <button type="submit" className="flat-btn blood-bg submit-listing-btn">
            Materialize Listing ☠
          </button>
        </form>
      )}

      <div className="marketplace-grid">
        {items.length === 0 ? (
          <div className="empty-wall-message">
            <span className="empty-skull">🕯️</span>
            <p>No listings exist in this realm yet.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`market-card ${item.status}`}>
              <div className="market-img-wrap">
                <img src={item.imageUrl} alt={item.title} className="market-img" />
                {item.status === 'sold' && <div className="sold-stamp">EXCHANGED</div>}
              </div>
              <div className="market-body">
                <div className="market-header-row">
                  <h3 className="market-title">{item.title}</h3>
                  <span className="market-price">${item.price}</span>
                </div>
                <p className="market-desc">{item.description}</p>
                <div className="market-footer">
                  <span className="market-seller">Listed by {item.authorName}</span>
                  <span className="market-contact">Contact: <code>{item.contactInfo}</code></span>
                </div>

                {identity && identity.deviceId === item.authorId && item.status === 'active' && (
                  <button
                    onClick={() => updateMarketplaceItemStatus(item.id, 'sold')}
                    className="flat-btn border-blood small-btn mark-sold-btn"
                  >
                    Mark as Exchanged 🩸
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
