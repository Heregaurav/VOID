import React, { useState } from 'react';
import { AdminUser, AdminBan } from '../types';

interface AdminDashboardProps {
  isAdmin: boolean;
  adminUsers: AdminUser[];
  adminBans: AdminBan[];
  adminError: string | null;
  authenticateAdmin: (token: string) => void;
  banUser: (socketId: string, deviceId: string, ipAddress: string, reason: string) => void;
  unbanUser: (ipOrDeviceId: string) => void;
}

export function AdminDashboard({
  isAdmin,
  adminUsers,
  adminBans,
  adminError,
  authenticateAdmin,
  banUser,
  unbanUser
}: AdminDashboardProps) {
  const [token, setToken] = useState('');
  const [banReason, setBanReason] = useState<Record<string, string>>({});

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    authenticateAdmin(token);
  };

  const handleBan = (user: AdminUser) => {
    const reason = banReason[user.id] || 'Violating the laws of the mist.';
    banUser(user.id, user.deviceId, user.ipAddress, reason);
    setBanReason(prev => ({ ...prev, [user.id]: '' }));
  };

  if (!isAdmin) {
    return (
      <div className="admin-login-screen">
        <h2 className="section-title">// RECREATIONAL SURVEILLANCE</h2>
        <p className="section-subtitle">You are attempting to access restricted surveillance logs. Prove your credentials.</p>
        
        <form onSubmit={handleLogin} className="creepy-form login-form">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter administrative token..."
            className="creepy-input login-password"
            required
          />
          {adminError && <div className="admin-error-text">❌ {adminError}</div>}
          <button type="submit" className="flat-btn blood-bg login-submit">
            Access Controls 🛡️
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      <div className="feed-header">
        <h2 className="section-title">// RESTRICTED PORTAL: SURVEILLANCE ROOM</h2>
        <p className="section-subtitle">Exorcise rogue souls, audit IP addresses, and inspect the status of the Void.</p>
      </div>

      <div className="admin-grid-layout">
        <div className="admin-section active-souls-column">
          <h3 className="admin-sec-title">👥 ONLINE SOULS ({adminUsers.length})</h3>
          <div className="admin-list-scroll">
            {adminUsers.length === 0 ? (
              <p className="no-data-text">No active souls logged.</p>
            ) : (
              adminUsers.map((user) => (
                <div key={user.id} className="admin-user-row">
                  <div className="user-info-row">
                    <span className="user-icon">{user.avatar}</span>
                    <div className="user-identity-block">
                      <span className="user-name">{user.name}</span>
                      <span className="user-ids">
                        Socket: <code>{user.id}</code> | Dev: <code>{user.deviceId.slice(0, 10)}...</code>
                      </span>
                      <span className="user-network">
                        IP: <code>{user.ipAddress}</code> | Room: <code>{user.currentRoom}</code>
                      </span>
                    </div>
                  </div>
                  
                  <div className="user-ban-control">
                    <input
                      type="text"
                      value={banReason[user.id] || ''}
                      onChange={(e) => setBanReason({ ...banReason, [user.id]: e.target.value })}
                      placeholder="Reason for exile..."
                      className="creepy-input ban-reason-input"
                    />
                    <button
                      onClick={() => handleBan(user)}
                      className="flat-btn blood-bg small-btn ban-action-btn"
                    >
                      Exile Soul 🩸
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="admin-section active-exiles-column">
          <h3 className="admin-sec-title">🛡️ EXILED SOULS ({adminBans.length})</h3>
          <div className="admin-list-scroll">
            {adminBans.length === 0 ? (
              <p className="no-data-text">The exile list is clean.</p>
            ) : (
              adminBans.map((ban) => (
                <div key={ban.id} className="admin-ban-row">
                  <div className="ban-info-block">
                    <p className="ban-target">
                      <strong>IP:</strong> <code>{ban.ipAddress || 'none'}</code> | 
                      <strong> Device:</strong> <code>{ban.deviceId?.slice(0, 15) || 'none'}...</code>
                    </p>
                    <p className="ban-reason">Reason: <em>"{ban.reason}"</em></p>
                    <span className="ban-date">Exiled: {new Date(ban.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => unbanUser(ban.ipAddress || ban.deviceId || String(ban.id))}
                    className="flat-btn border-fog small-btn unban-action-btn"
                  >
                    Resurrect Soul 🛡️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
