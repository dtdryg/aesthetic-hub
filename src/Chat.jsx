/**
 * Chat.jsx — Aesthetic Hub
 * Full rebuild: text DMs, group chat, WebRTC voice + video.
 * Zero paywalls. Zero subscriptions. Peer-to-peer via WebRTC + Socket.io signaling.
 *
 * Drop-in usage in App.jsx:
 *   import Chat from './Chat';
 *   {view === 'chat' && <Chat loggedInUser={loggedInUser} users={users} onlineUsers={onlineUsers} resolveAvatarUrl={resolveAvatarUrl} />}
 *
 * Socket.io events this component emits/listens to (add to your server.js):
 *   typing:start / typing:stop
 *   private_message
 *   chatMessage  (group)
 *   webrtc:offer / webrtc:answer / webrtc:ice / webrtc:call-end
 */

import React, {
  useState, useEffect, useRef, useCallback
} from 'react';
import axios from 'axios';
import socket from './socket';
import './Chat.css';

/* ─── ICE config — uses free public STUN + optional TURN ──────────────── */
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // If you get a free Metered.ca TURN key, add it here:
    // { urls: 'turn:relay.metered.ca:80', username: 'YOUR_USER', credential: 'YOUR_KEY' }
  ],
};

/* ─── tiny helpers ─────────────────────────────────────────────────────── */
const ts = (t) =>
  new Date(t || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Chat({ loggedInUser, users = [], onlineUsers = [], resolveAvatarUrl }) {
  /* ── sidebar / room selection ── */
  const [chatUser, setChatUser] = useState('group');

  /* ── messages ── */
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  /* ── typing ── */
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef(null);

  /* ── call state ── */
  const [callState, setCallState] = useState('idle'); // idle | calling | ringing | in-call
  const [callMode, setCallMode] = useState('video');  // video | voice
  const [callPeer, setCallPeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  /* ── WebRTC refs ── */
  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenTrackRef = useRef(null);

  /* ══════════════════════════════════════════════════════════════════════
     MESSAGES
  ══════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (chatUser && chatUser !== 'group') loadMessages();
    else setMessages([]);
  }, [chatUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await axios.get('https://aesthetic-hub-production.up.railway.app/messages', {
        params: { user1: loggedInUser, user2: chatUser },
      });
      setMessages(res.data);
    } catch (e) { console.error(e); }
  };

  /* incoming private messages */
  useEffect(() => {
    const onPrivate = (msg) => {
      if (
        (msg.from === chatUser && msg.to === loggedInUser) ||
        (msg.from === loggedInUser && msg.to === chatUser)
      ) {
        setMessages(prev => [...prev, msg]);
      }
    };
    const onGroup = (msg) => {
      if (chatUser === 'group') setMessages(prev => [...prev, msg]);
    };
    socket.on('private_message', onPrivate);
    socket.on('chatMessage', onGroup);
    return () => {
      socket.off('private_message', onPrivate);
      socket.off('chatMessage', onGroup);
    };
  }, [chatUser, loggedInUser]);

  /* typing indicators */
  useEffect(() => {
    const show = ({ from }) => { if (from === chatUser) setIsTyping(true); };
    const hide = ({ from }) => { if (from === chatUser) setIsTyping(false); };
    socket.on('typing:show', show);
    socket.on('typing:hide', hide);
    return () => { socket.off('typing:show', show); socket.off('typing:hide', hide); };
  }, [chatUser]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;
    if (chatUser === 'group') {
      socket.emit('chatMessage', text);
    } else {
      socket.emit('private_message', { to: chatUser, text });
      try {
        await axios.post('https://aesthetic-hub-production.up.railway.app/sendMessage', {
          from: loggedInUser, to: chatUser, text,
        });
      } catch (e) { console.error(e); }
    }
    setNewMessage('');
    socket.emit('typing:stop', { to: chatUser });
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (chatUser && chatUser !== 'group') {
      socket.emit('typing:start', { to: chatUser });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => socket.emit('typing:stop', { to: chatUser }), 1200);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     WebRTC — SIGNALING via socket.io
  ══════════════════════════════════════════════════════════════════════ */
  const createPeer = useCallback((initiator, stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('webrtc:ice', { to: callPeer || chatUser, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall();
      }
    };

    peerRef.current = pc;
    return pc;
  }, [callPeer, chatUser]);

  /* Initiate a call */
  const startCall = async (mode) => {
    if (chatUser === 'group') return; // group calls TODO
    setCallMode(mode);
    setCallPeer(chatUser);
    setCallState('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video',
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeer(true, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', {
        to: chatUser,
        offer,
        mode,
        from: loggedInUser,
      });
    } catch (err) {
      console.error('getUserMedia error', err);
      alert('Could not access camera/mic. Check permissions.');
      setCallState('idle');
    }
  };

  /* Answer incoming call */
  const answerCall = async (offerData) => {
    setCallMode(offerData.mode);
    setCallPeer(offerData.from);
    setCallState('in-call');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: offerData.mode === 'video',
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeer(false, stream);
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', { to: offerData.from, answer });
    } catch (err) {
      console.error('answer error', err);
      setCallState('idle');
    }
  };

  const declineCall = (from) => {
    socket.emit('webrtc:call-end', { to: from });
    setCallState('idle');
    setCallPeer(null);
  };

  /* End call */
  const endCall = useCallback(() => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (callPeer) socket.emit('webrtc:call-end', { to: callPeer });
    setCallState('idle');
    setCallPeer(null);
    setLocalStream(null);
    setMuted(false);
    setCamOff(false);
    setScreenSharing(false);
  }, [callPeer]);

  /* Socket signaling listeners */
  useEffect(() => {
    const onOffer = (data) => {
      setCallPeer(data.from);
      setCallState('ringing');
      /* store offer for when user clicks answer */
      socket._pendingOffer = data;
    };

    const onAnswer = async ({ answer }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState('in-call');
      }
    };

    const onIce = async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) { console.error('ICE error', e); }
    };

    const onCallEnd = () => {
      if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      setCallState('idle');
      setCallPeer(null);
      setLocalStream(null);
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice', onIce);
    socket.on('webrtc:call-end', onCallEnd);

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice', onIce);
      socket.off('webrtc:call-end', onCallEnd);
    };
  }, []);

  /* Controls */
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = camOff; });
    setCamOff(c => !c);
  };

  const toggleScreen = async () => {
    if (!peerRef.current) return;
    if (!screenSharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screen.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;
        const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
        screenTrack.onended = () => { toggleScreen(); };
        setScreenSharing(true);
      } catch (e) { console.error(e); }
    } else {
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender && camTrack) sender.replaceTrack(camTrack);
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      setScreenSharing(false);
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  const otherUsers = users.filter(u => u.username !== loggedInUser);
  const activePeerData = users.find(u => u.username === chatUser);

  return (
    <div className="ch-root">

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="ch-sidebar">
        <div className="ch-sidebar-header">
          <span className="ch-sidebar-title">Messages</span>
          <span className="ch-online-count">{onlineUsers.length} online</span>
        </div>

        {/* Group chat tile */}
        <div
          className={`ch-tile ${chatUser === 'group' ? 'active' : ''}`}
          onClick={() => setChatUser('group')}
        >
          <div className="ch-tile-avatar ch-tile-avatar--group">👥</div>
          <div className="ch-tile-info">
            <span className="ch-tile-name">Global Chat</span>
            <span className="ch-tile-sub">Everyone's here</span>
          </div>
          <div className="ch-tile-dot ch-tile-dot--live" />
        </div>

        <div className="ch-divider"><span>Direct Messages</span></div>

        {otherUsers.length === 0 ? (
          <div className="ch-empty-list">No users yet.</div>
        ) : (
          otherUsers.map(u => {
            const isOnline = onlineUsers.includes(u.username);
            return (
              <div
                key={u.username}
                className={`ch-tile ${chatUser === u.username ? 'active' : ''}`}
                onClick={() => setChatUser(u.username)}
              >
                <div className="ch-tile-avatar-wrap">
                  {u.avatar ? (
                    <img src={resolveAvatarUrl(u.avatar)} alt={u.username} className="ch-tile-avatar-img" />
                  ) : (
                    <div className="ch-tile-avatar ch-tile-avatar--default">
                      {u.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className={`ch-presence-dot ${isOnline ? 'online' : 'offline'}`} />
                </div>
                <div className="ch-tile-info">
                  <span className="ch-tile-name">{u.username}</span>
                  <span className="ch-tile-sub">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            );
          })
        )}
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────── */}
      <main className="ch-main">

        {/* ── CALL OVERLAY: RINGING ── */}
        {callState === 'ringing' && (
          <div className="ch-call-overlay">
            <div className="ch-call-modal">
              <div className="ch-call-ring-anim" />
              <p className="ch-call-who">📞 Incoming {socket._pendingOffer?.mode} call</p>
              <p className="ch-call-from">{callPeer}</p>
              <div className="ch-call-actions">
                <button className="ch-btn-answer" onClick={() => answerCall(socket._pendingOffer)}>
                  Answer
                </button>
                <button className="ch-btn-decline" onClick={() => declineCall(callPeer)}>
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CALL OVERLAY: CALLING ── */}
        {callState === 'calling' && (
          <div className="ch-call-overlay">
            <div className="ch-call-modal">
              <div className="ch-call-ring-anim pulse" />
              <p className="ch-call-who">Calling {callPeer}…</p>
              <button className="ch-btn-decline" onClick={endCall}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── ACTIVE CALL UI ── */}
        {callState === 'in-call' && (
          <div className="ch-call-active">
            <div className="ch-video-grid">
              {callMode === 'video' && (
                <>
                  <video ref={remoteVideoRef} autoPlay playsInline className="ch-video-remote" />
                  <video ref={localVideoRef} autoPlay playsInline muted className="ch-video-local" />
                </>
              )}
              {callMode === 'voice' && (
                <>
                  <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                  <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
                  <div className="ch-voice-ui">
                    <div className="ch-voice-avatar">
                      {callPeer?.[0]?.toUpperCase()}
                    </div>
                    <p className="ch-voice-name">{callPeer}</p>
                    <p className="ch-voice-status">Voice call in progress…</p>
                    <div className="ch-voice-wave">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="ch-voice-bar" style={{ animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="ch-call-controls">
              <button
                className={`ch-ctrl-btn ${muted ? 'active-red' : ''}`}
                onClick={toggleMute}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? '🔇' : '🎤'}
              </button>
              {callMode === 'video' && (
                <>
                  <button
                    className={`ch-ctrl-btn ${camOff ? 'active-red' : ''}`}
                    onClick={toggleCam}
                    title={camOff ? 'Enable Camera' : 'Disable Camera'}
                  >
                    {camOff ? '📷' : '📹'}
                  </button>
                  <button
                    className={`ch-ctrl-btn ${screenSharing ? 'active-purple' : ''}`}
                    onClick={toggleScreen}
                    title="Share Screen"
                  >
                    🖥
                  </button>
                </>
              )}
              <button className="ch-ctrl-btn ch-ctrl-end" onClick={endCall} title="End Call">
                📵
              </button>
            </div>
          </div>
        )}

        {/* ── CHAT HEADER ── */}
        <div className="ch-header">
          {chatUser === 'group' ? (
            <div className="ch-header-info">
              <span className="ch-header-name">Global Chat</span>
              <span className="ch-header-sub">{onlineUsers.length} users online</span>
            </div>
          ) : (
            <div className="ch-header-info">
              {activePeerData?.avatar && (
                <img
                  src={resolveAvatarUrl(activePeerData.avatar)}
                  alt={chatUser}
                  className="ch-header-avatar"
                />
              )}
              <div>
                <span className="ch-header-name">{chatUser}</span>
                <span className="ch-header-sub">
                  {onlineUsers.includes(chatUser) ? '● Online' : '● Offline'}
                </span>
              </div>
            </div>
          )}

          {/* call buttons — only in DMs */}
          {chatUser !== 'group' && callState === 'idle' && (
            <div className="ch-header-actions">
              <button
                className="ch-call-btn ch-call-btn--voice"
                onClick={() => startCall('voice')}
                title="Voice Call"
              >
                <span>📞</span> Voice
              </button>
              <button
                className="ch-call-btn ch-call-btn--video"
                onClick={() => startCall('video')}
                title="Video Call"
              >
                <span>📹</span> Video
              </button>
            </div>
          )}
        </div>

        {/* ── MESSAGES ── */}
        <div className="ch-messages">
          {messages.length === 0 && (
            <div className="ch-messages-empty">
              {chatUser === 'group'
                ? 'Send a message to the group.'
                : `Start a conversation with ${chatUser}.`}
            </div>
          )}
          {messages.map((m, i) => {
            const isMe = m.from === loggedInUser || m.username === loggedInUser;
            const sender = m.from || m.username || '?';
            return (
              <div key={i} className={`ch-bubble-row ${isMe ? 'me' : 'them'}`}>
                {!isMe && (
                  <div className="ch-bubble-avatar">
                    {sender[0]?.toUpperCase()}
                  </div>
                )}
                <div className="ch-bubble-wrap">
                  {!isMe && <span className="ch-bubble-sender">{sender}</span>}
                  <div className={`ch-bubble ${isMe ? 'ch-bubble--me' : 'ch-bubble--them'}`}>
                    {m.text}
                  </div>
                  <span className="ch-bubble-ts">{ts(m.timestamp)}</span>
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="ch-typing">
              <span /><span /><span />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── COMPOSER ── */}
        <div className="ch-composer">
          <textarea
            className="ch-composer-input"
            placeholder={chatUser ? `Message ${chatUser === 'group' ? 'everyone' : chatUser}…` : 'Select a chat'}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            rows={1}
            disabled={!chatUser}
          />
          <button
            className="ch-composer-send"
            onClick={handleSend}
            disabled={!newMessage.trim() || !chatUser}
          >
            ↑
          </button>
        </div>

      </main>
    </div>
  );
}
