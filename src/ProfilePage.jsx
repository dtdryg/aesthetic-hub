/**
 * ProfilePage.jsx
 * Full customizable user profile — music, backgrounds, animations, playlist, everything.
 * 
 * Usage in App.jsx:
 *   import ProfilePage from './ProfilePage';
 *   {view === 'profile' && <ProfilePage username={profileUsername} loggedInUser={loggedInUser} onBack={() => setView('users')} />}
 * 
 * To visit someone's profile from Users tab:
 *   onClick={() => { setProfileUsername(u.username); setView('profile'); }}
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ProfilePage.css';

const API = 'https://aesthetic-hub-production.up.railway.app';

const FONTS = ['DM Mono', 'Syne', 'Space Mono', 'Courier New', 'Georgia', 'Impact'];
const ANIMS = ['none', 'gradient-shift', 'pulse-glow', 'scanlines', 'noise'];
const BG_TYPES = ['gradient', 'image', 'video', 'color'];

export default function ProfilePage({ username, loggedInUser, onBack, onStartCall }) {
  const [profile, setProfile] = useState(null);
  const [isOwn, setIsOwn] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef(null);
  const [songPlaying, setSongPlaying] = useState(false);

  // edit state
  const [editBio, setEditBio] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAccent, setEditAccent] = useState('#7c3aed');
  const [editColor1, setEditColor1] = useState('#1a0a2f');
  const [editColor2, setEditColor2] = useState('#050510');
  const [editFont, setEditFont] = useState('DM Mono');
  const [editBgType, setEditBgType] = useState('gradient');
  const [editBg, setEditBg] = useState('');
  const [editSong, setEditSong] = useState('');
  const [editBannerAnim, setEditBannerAnim] = useState('none');
  const [editPlaylist, setEditPlaylist] = useState([]);
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [newTrackName, setNewTrackName] = useState('');

  useEffect(() => {
    if (username) fetchProfile();
    setIsOwn(username === loggedInUser);
  }, [username, loggedInUser]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      const user = res.data.find(u => u.username === username);
      if (user) {
        setProfile(user);
        setEditBio(user.bio || '');
        setEditDisplayName(user.display_name || user.username);
        setEditAccent(user.profile_accent || '#7c3aed');
        setEditColor1(user.color1 || '#1a0a2f');
        setEditColor2(user.color2 || '#050510');
        setEditFont(user.profile_font || 'DM Mono');
        setEditBgType(user.profile_bg_type || 'gradient');
        setEditBg(user.profile_bg || '');
        setEditSong(user.profile_song || '');
        setEditBannerAnim(user.profile_banner_anim || 'none');
        setEditPlaylist(user.profile_playlist || []);

        // autoplay profile song
        if (user.profile_song && audioRef.current) {
          audioRef.current.src = user.profile_song;
          audioRef.current.volume = 0.4;
          audioRef.current.play().then(() => setSongPlaying(true)).catch(() => {});
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/updateProfile`, {
        username: loggedInUser,
        bio: editBio,
        display_name: editDisplayName,
        profile_accent: editAccent,
        color1: editColor1,
        color2: editColor2,
        profile_font: editFont,
        profile_bg_type: editBgType,
        profile_bg: editBg,
        profile_song: editSong,
        profile_banner_anim: editBannerAnim,
        profile_playlist: editPlaylist,
      });
      await fetchProfile();
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const addTrack = () => {
    if (!newTrackUrl.trim()) return;
    setEditPlaylist(prev => [...prev, { name: newTrackName || newTrackUrl, url: newTrackUrl }]);
    setNewTrackUrl('');
    setNewTrackName('');
  };

  const removeTrack = (i) => setEditPlaylist(prev => prev.filter((_, idx) => idx !== i));

  const toggleSong = () => {
    if (!audioRef.current) return;
    if (songPlaying) {
      audioRef.current.pause();
      setSongPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setSongPlaying(true);
    }
  };

  const getBackground = () => {
    if (!profile) return {};
    const bgType = editing ? editBgType : profile.profile_bg_type;
    const bg = editing ? editBg : profile.profile_bg;
    const c1 = editing ? editColor1 : (profile.color1 || '#1a0a2f');
    const c2 = editing ? editColor2 : (profile.color2 || '#050510');

    if (bgType === 'color') return { backgroundColor: bg || '#030305' };
    if (bgType === 'image' && bg) return { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (bgType === 'gradient') return { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 60%, #030305 100%)` };
    return { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` };
  };

  const accent = editing ? editAccent : (profile?.profile_accent || '#7c3aed');
  const font = editing ? editFont : (profile?.profile_font || 'DM Mono');

  if (!profile) return <div className="pp-loading">Loading profile…</div>;

  return (
    <div className="pp-root" style={{ ...getBackground(), fontFamily: font }}>

      {/* hidden audio */}
      <audio ref={audioRef} loop />

      {/* background video */}
      {!editing && profile.profile_bg_type === 'video' && profile.profile_bg && (
        <video className="pp-bg-video" src={profile.profile_bg} autoPlay loop muted playsInline />
      )}

      {/* animation overlay */}
      {profile.profile_banner_anim !== 'none' && (
        <div className={`pp-anim-overlay pp-anim-${profile.profile_banner_anim}`} />
      )}

      {/* top bar */}
      <div className="pp-topbar">
        <button className="pp-back" onClick={onBack} style={{ color: accent }}>← Back</button>
        <div className="pp-topbar-right">
          {profile.profile_song && (
            <button className="pp-song-btn" onClick={toggleSong} style={{ borderColor: accent, color: accent }}>
              {songPlaying ? '⏸ Pause' : '▶ Play'} song
            </button>
          )}
          {isOwn && (
            <button className="pp-edit-btn" onClick={() => setEditing(e => !e)} style={{ background: accent }}>
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          )}
        </div>
      </div>

      <div className="pp-body">

        {/* LEFT — profile card */}
        <div className="pp-card" style={{ borderColor: `${accent}33` }}>
          {/* avatar */}
          <div className="pp-avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar.startsWith('/') ? `${API}${profile.avatar}` : profile.avatar}
                alt={username} className="pp-avatar" style={{ borderColor: accent }} />
            ) : (
              <div className="pp-avatar pp-avatar--gen"
                style={{ background: `linear-gradient(135deg, ${profile.color1 || '#9b5de5'}, ${profile.color2 || '#1a0a2f'})`, borderColor: accent }}>
                {username[0]?.toUpperCase()}
              </div>
            )}
            {profile.verified && (
              <span className="pp-verified" style={{ filter: `drop-shadow(0 0 6px ${accent})` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <polygon points="12,2 15,8 22,9 17,14 18,21 12,18 6,21 7,14 2,9 9,8" fill="#0a0a0a" stroke={accent} strokeWidth="1.5"/>
                  <text x="12" y="16" textAnchor="middle" fontSize="9" fill="#fff">⚡</text>
                </svg>
              </span>
            )}
          </div>

          <div className="pp-name" style={{ color: accent }}>{profile.display_name || username}</div>
          <div className="pp-username">@{username}</div>

          {profile.bio && <div className="pp-bio">{profile.bio}</div>}

          {/* song indicator */}
          {profile.profile_song && (
            <div className="pp-now-playing" style={{ borderColor: `${accent}44`, color: accent }}>
              <div className="pp-now-playing-bars">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`pp-bar ${songPlaying ? 'playing' : ''}`}
                    style={{ background: accent, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span>{songPlaying ? 'Now Playing' : 'Profile Song'}</span>
            </div>
          )}

          {/* call buttons — only for others */}
          {!isOwn && onStartCall && (
            <div className="pp-actions">
              <button className="pp-action-btn" onClick={() => onStartCall('voice')}
                style={{ borderColor: `${accent}44`, color: accent }}>Voice</button>
              <button className="pp-action-btn pp-action-btn--primary" onClick={() => onStartCall('video')}
                style={{ background: accent }}>Video</button>
            </div>
          )}
        </div>

        {/* RIGHT — main content */}
        <div className="pp-content">

          {/* EDIT MODE */}
          {editing && isOwn && (
            <div className="pp-editor" style={{ borderColor: `${accent}33` }}>
              <div className="pp-editor-title" style={{ color: accent }}>Customize Your Profile</div>

              <div className="pp-editor-grid">
                <div className="pp-editor-section">
                  <div className="pp-editor-label">Display Name</div>
                  <input className="pp-input" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder="Display name" />
                </div>

                <div className="pp-editor-section">
                  <div className="pp-editor-label">Bio</div>
                  <textarea className="pp-input pp-textarea" value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell people about yourself..." rows={3} />
                </div>

                <div className="pp-editor-section">
                  <div className="pp-editor-label">Accent Color</div>
                  <div className="pp-color-row">
                    <input type="color" value={editAccent} onChange={e => setEditAccent(e.target.value)} className="pp-color-input" />
                    <span className="pp-color-val">{editAccent}</span>
                  </div>
                </div>

                <div className="pp-editor-section">
                  <div className="pp-editor-label">Background Type</div>
                  <div className="pp-btn-group">
                    {BG_TYPES.map(t => (
                      <button key={t} className={`pp-toggle-btn ${editBgType === t ? 'active' : ''}`}
                        onClick={() => setEditBgType(t)}
                        style={editBgType === t ? { background: accent, borderColor: accent } : {}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {editBgType === 'gradient' && (
                  <div className="pp-editor-section">
                    <div className="pp-editor-label">Gradient Colors</div>
                    <div className="pp-color-row">
                      <input type="color" value={editColor1} onChange={e => setEditColor1(e.target.value)} className="pp-color-input" />
                      <input type="color" value={editColor2} onChange={e => setEditColor2(e.target.value)} className="pp-color-input" />
                    </div>
                  </div>
                )}

                {(editBgType === 'image' || editBgType === 'video') && (
                  <div className="pp-editor-section">
                    <div className="pp-editor-label">Background URL ({editBgType})</div>
                    <input className="pp-input" value={editBg} onChange={e => setEditBg(e.target.value)} placeholder={`Paste ${editBgType} URL...`} />
                  </div>
                )}

                {editBgType === 'color' && (
                  <div className="pp-editor-section">
                    <div className="pp-editor-label">Background Color</div>
                    <input type="color" value={editBg || '#030305'} onChange={e => setEditBg(e.target.value)} className="pp-color-input" />
                  </div>
                )}

                <div className="pp-editor-section">
                  <div className="pp-editor-label">Animation Overlay</div>
                  <div className="pp-btn-group">
                    {ANIMS.map(a => (
                      <button key={a} className={`pp-toggle-btn ${editBannerAnim === a ? 'active' : ''}`}
                        onClick={() => setEditBannerAnim(a)}
                        style={editBannerAnim === a ? { background: accent, borderColor: accent } : {}}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pp-editor-section">
                  <div className="pp-editor-label">Font</div>
                  <div className="pp-btn-group">
                    {FONTS.map(f => (
                      <button key={f} className={`pp-toggle-btn ${editFont === f ? 'active' : ''}`}
                        onClick={() => setEditFont(f)}
                        style={{ fontFamily: f, ...(editFont === f ? { background: accent, borderColor: accent } : {}) }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pp-editor-section">
                  <div className="pp-editor-label">Profile Song URL (mp3/ogg/etc)</div>
                  <input className="pp-input" value={editSong} onChange={e => setEditSong(e.target.value)} placeholder="https://example.com/song.mp3" />
                </div>
              </div>

              {/* playlist editor */}
              <div className="pp-editor-section" style={{ marginTop: 16 }}>
                <div className="pp-editor-label">Public Playlist</div>
                <div className="pp-playlist-add">
                  <input className="pp-input" value={newTrackName} onChange={e => setNewTrackName(e.target.value)} placeholder="Track name" style={{ flex: 1 }} />
                  <input className="pp-input" value={newTrackUrl} onChange={e => setNewTrackUrl(e.target.value)} placeholder="URL (YouTube, SoundCloud, mp3...)" style={{ flex: 2 }} />
                  <button className="pp-add-btn" onClick={addTrack} style={{ background: accent }}>Add</button>
                </div>
                <div className="pp-playlist-list">
                  {editPlaylist.map((t, i) => (
                    <div key={i} className="pp-playlist-item">
                      <span>{t.name}</span>
                      <button className="pp-remove-btn" onClick={() => removeTrack(i)}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <button className="pp-save-btn" onClick={handleSave} disabled={saving}
                style={{ background: accent }}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          )}

          {/* PUBLIC PLAYLIST */}
          {profile.profile_playlist?.length > 0 && (
            <div className="pp-section" style={{ borderColor: `${accent}33` }}>
              <div className="pp-section-title" style={{ color: accent }}>Playlist</div>
              <div className="pp-playlist">
                {profile.profile_playlist.map((track, i) => (
                  <a key={i} href={track.url} target="_blank" rel="noopener noreferrer"
                    className="pp-track" style={{ borderColor: `${accent}22` }}>
                    <div className="pp-track-icon" style={{ color: accent }}>▶</div>
                    <div className="pp-track-name">{track.name}</div>
                    <div className="pp-track-link">open ↗</div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
