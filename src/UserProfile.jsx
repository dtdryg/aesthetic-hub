/**
 * UserProfile.jsx
 * - Top left profile icon dropdown
 * - Email verification status
 * - Forgot password
 * - Profile page with avatar upload + color generator
 * - Owner verified badge (black glowing ⚡)
 * - View other users' profiles
 * 
 * Usage in App.jsx:
 *   import UserProfile, { VerifiedBadge, PublicProfile, OwnerVerifyPanel } from './UserProfile';
 *
 *   Replace your existing user-box div with:
 *   <UserProfile
 *     loggedInUser={loggedInUser}
 *     isOwner={loggedInUser === 'YOUR_USERNAME'}
 *     onLogout={() => setLoggedInUser(null)}
 *     onUsersUpdate={fetchUsers}
 *   />
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './UserProfile.css';

const API = 'https://aesthetic-hub-production.up.railway.app';

// ── Verified Badge ────────────────────────────────────────────
export function VerifiedBadge({ size = 16 }) {
  return (
    <span className="verified-badge" title="Verified by owner" style={{ '--sz': `${size}px` }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <polygon
          points="12,2 15,8 22,9 17,14 18,21 12,18 6,21 7,14 2,9 9,8"
          fill="#0a0a0a"
          stroke="#c77dff"
          strokeWidth="1.5"
        />
        <text x="12" y="16" textAnchor="middle" fontSize="9" fill="#fff">⚡</text>
      </svg>
    </span>
  );
}

// ── Avatar Generator ──────────────────────────────────────────
function generateAvatar(username, color1, color2) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((username?.[0] || '?').toUpperCase(), 64, 66);
  return canvas.toDataURL('image/png');
}

// ── Main Component ────────────────────────────────────────────
export default function UserProfile({ loggedInUser, isOwner, onLogout, onUsersUpdate }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('menu');
  const [userData, setUserData] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [color1, setColor1] = useState('#9b5de5');
  const [color2, setColor2] = useState('#1a0a2f');
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('');
  const dropRef = useRef(null);

  useEffect(() => {
    if (loggedInUser) fetchUserData();
  }, [loggedInUser]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      const user = res.data.find(u => u.username === loggedInUser);
      if (user) {
        setUserData(user);
        setBio(user.bio || '');
        setDisplayName(user.display_name || user.username);
      }
    } catch (e) { console.error(e); }
  };

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleGenerateAvatar = async () => {
    const dataUrl = generateAvatar(loggedInUser, color1, color2);
    setAvatarPreview(dataUrl);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    setAvatarFile(new File([blob], 'generated-avatar.png', { type: 'image/png' }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('username', loggedInUser);
        await axios.post(`${API}/uploadAvatar`, fd);
      }
      await axios.post(`${API}/updateProfile`, {
        username: loggedInUser,
        bio,
        display_name: displayName,
      });
      await fetchUserData();
      onUsersUpdate?.();
      setView('menu');
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleForgotPassword = async () => {
    try {
      await axios.post(`${API}/requestPasswordReset`, { email: forgotEmail });
      setForgotSent(true);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed');
    }
  };

  const handleSendVerify = async () => {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setVerifyCode(code);
      await axios.post(`${API}/sendVerifyEmail`, { username: loggedInUser, code });
      setVerifyStatus('sent');
    } catch (e) {
      alert('Failed to send verification email');
    }
  };

  const handleConfirmVerify = async () => {
    if (verifyInput.trim() === verifyCode) {
      try {
        await axios.post(`${API}/verifyEmail`, { username: loggedInUser });
        await fetchUserData();
        setVerifyStatus('done');
      } catch (e) { alert('Failed'); }
    } else {
      alert('Wrong code. Try again.');
    }
  };

  const resolveAvatar = (val) => {
    if (!val) return null;
    if (val.startsWith('data:')) return val;
    if (val.startsWith('ipfs://')) return val.replace('ipfs://', 'https://ipfs.io/ipfs/');
    if (val.startsWith('http')) return val;
    if (val.startsWith('/')) return `${API}${val}`;
    return val;
  };

  const avatarSrc = avatarPreview || resolveAvatar(userData?.avatar);

  if (!loggedInUser) return null;

  return (
    <div className="up-wrap" ref={dropRef}>
      <button className="up-trigger" onClick={() => { setOpen(o => !o); setView('menu'); }}>
        {avatarSrc ? (
          <img src={avatarSrc} alt="you" className="up-trigger-img" />
        ) : (
          <span className="up-trigger-initials">
            {loggedInUser?.[0]?.toUpperCase() || '?'}
          </span>
        )}
        {userData?.verified && <VerifiedBadge size={11} />}
        <span className="up-online-dot" />
      </button>

      {open && (
        <div className="up-dropdown">

          {view === 'menu' && (
            <>
              <div className="up-header">
                <div className="up-header-avatar-wrap">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="you" className="up-header-img" />
                  ) : (
                    <div className="up-header-initials">
                      {loggedInUser?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="up-header-text">
                  <div className="up-header-name">
                    {userData?.display_name || loggedInUser}
                    {userData?.verified && <VerifiedBadge size={13} />}
                  </div>
                  <div className="up-header-username">@{loggedInUser}</div>
                  <div className={`up-email-status ${userData?.email_verified ? 'ev' : 'euv'}`}>
                    {userData?.email_verified ? '✓ Email verified' : '⚠ Email not verified'}
                  </div>
                </div>
              </div>

              <div className="up-divider" />
              <button className="up-item" onClick={() => setView('profile')}>✏️ &nbsp;Edit Profile</button>
              {!userData?.email_verified && (
                <button className="up-item up-item--warn" onClick={() => setView('verify')}>📧 &nbsp;Verify Email</button>
              )}
              <button className="up-item" onClick={() => setView('forgot')}>🔑 &nbsp;Forgot Password</button>
              <div className="up-divider" />
              <button className="up-item up-item--danger" onClick={() => { setOpen(false); onLogout(); }}>↩ &nbsp;Logout</button>
            </>
          )}

          {view === 'profile' && (
            <div className="up-panel">
              <div className="up-panel-title"> Edit Profile</div>
              <div className="up-avatar-preview">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="preview" className="up-avatar-preview-img" />
                ) : (
                  <div className="up-avatar-preview-blank">{loggedInUser?.[0]?.toUpperCase()}</div>
                )}
              </div>
              <div className="up-section-label">Upload Image</div>
              <input type="file" accept="image/*" onChange={handleAvatarFile} className="up-file-input" />
              <div className="up-section-label">Or Generate Avatar</div>
              <div className="up-color-row">
                <label className="up-color-item">
                  <span>Color 1</span>
                  <input type="color" value={color1} onChange={e => setColor1(e.target.value)} />
                </label>
                <label className="up-color-item">
                  <span>Color 2</span>
                  <input type="color" value={color2} onChange={e => setColor2(e.target.value)} />
                </label>
                <button className="up-btn-secondary" onClick={handleGenerateAvatar}>Generate</button>
              </div>
              <div className="up-section-label">Display Name</div>
              <input className="up-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name" />
              <div className="up-section-label">Bio</div>
              <textarea className="up-input up-textarea" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people about yourself..." rows={3} />
              <div className="up-actions">
                <button className="up-btn-primary" onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button className="up-btn-secondary" onClick={() => setView('menu')}>Cancel</button>
              </div>
            </div>
          )}

          {view === 'forgot' && (
            <div className="up-panel">
              <div className="up-panel-title"> Reset Password</div>
              {!forgotSent ? (
                <>
                  <p className="up-panel-sub">Enter your email and we'll send a reset link.</p>
                  <input className="up-input" placeholder="your@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                  <div className="up-actions">
                    <button className="up-btn-primary" onClick={handleForgotPassword}>Send Reset</button>
                    <button className="up-btn-secondary" onClick={() => setView('menu')}>Back</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="up-panel-sub up-success">✓ Reset email sent! Check your inbox.</p>
                  <button className="up-btn-secondary" onClick={() => setView('menu')}>Back</button>
                </>
              )}
            </div>
          )}

          {view === 'verify' && (
            <div className="up-panel">
              <div className="up-panel-title"> Verify Email</div>
              {verifyStatus === 'done' ? (
                <p className="up-panel-sub up-success">✓ Email verified! You're good.</p>
              ) : verifyStatus === 'sent' ? (
                <>
                  <p className="up-panel-sub">Enter the 6-digit code sent to your email.</p>
                  <input className="up-input" placeholder="000000" value={verifyInput} onChange={e => setVerifyInput(e.target.value)} maxLength={6} />
                  <div className="up-actions">
                    <button className="up-btn-primary" onClick={handleConfirmVerify}>Confirm</button>
                    <button className="up-btn-secondary" onClick={() => setView('menu')}>Back</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="up-panel-sub">We'll send a 6-digit code to your registered email.</p>
                  <div className="up-actions">
                    <button className="up-btn-primary" onClick={handleSendVerify}>Send Code</button>
                    <button className="up-btn-secondary" onClick={() => setView('menu')}>Back</button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Owner Verify Panel ────────────────────────────────────────
export function OwnerVerifyPanel({ users, onVerify }) {
  const [search, setSearch] = useState('');
  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="owner-panel">
      <div className="owner-panel-title">⚡ Verify Users</div>
      <input className="up-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="owner-list">
        {filtered.map(u => (
          <div key={u.username} className="owner-row">
            <span className="owner-row-name">{u.username} {u.verified && <VerifiedBadge size={13} />}</span>
            {!u.verified
              ? <button className="owner-verify-btn" onClick={() => onVerify(u.username)}>Verify ⚡</button>
              : <span className="owner-verified-label">✓ Verified</span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Public Profile Card ───────────────────────────────────────
export function PublicProfile({ user, resolveAvatarUrl, isOwner, onVerify }) {
  if (!user) return null;
  const avatarSrc = resolveAvatarUrl?.(user.avatar);
  return (
    <div className="pub-profile">
      <div className="pub-banner" style={{
        background: `linear-gradient(135deg, ${user.color1 || '#1a0a2f'}, ${user.color2 || '#050510'})`
      }} />
      <div className="pub-body">
        <div className="pub-avatar-wrap">
          {avatarSrc
            ? <img src={avatarSrc} alt={user.username} className="pub-avatar" />
            : <div className="pub-avatar pub-avatar--gen" style={{ background: `linear-gradient(135deg, ${user.color1 || '#9b5de5'}, ${user.color2 || '#1a0a2f'})` }}>
                {user.username?.[0]?.toUpperCase()}
              </div>
          }
        </div>
        <div className="pub-info">
          <div className="pub-name">
            {user.display_name || user.username}
            {user.verified && <VerifiedBadge size={16} />}
          </div>
          <div className="pub-username">@{user.username}</div>
          {user.bio && <div className="pub-bio">{user.bio}</div>}
          {user.email_verified && <div className="pub-ev">✓ Email Verified</div>}
        </div>
        {isOwner && !user.verified && (
          <button className="owner-verify-btn" onClick={() => onVerify?.(user.username)}>Verify ⚡</button>
        )}
      </div>
    </div>
  );
}
