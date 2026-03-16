import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import socket from './socket';
import './Chat.css';

const API = 'https://aesthetic-hub-production.up.railway.app';



const ts = (t) =>
  new Date(t || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Chat({ loggedInUser, users = [], onlineUsers = [], resolveAvatarUrl }) {
  const [chatUser, setChatUser] = useState('group');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef(null);

  // call state
  const [callState, setCallState] = useState('idle');
  const [callMode, setCallMode] = useState('video');
  const [callPeer, setCallPeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  // refs — never stale
  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const callPeerRef = useRef(null); // FIX: ref so createPeer always has latest peer
  const pendingOfferRef = useRef(null); // FIX: store offer in ref not socket
const [iceServers, setIceServers] = useState([
  { urls: 'stun:stun.l.google.com:19302' },
]);

useEffect(() => {
  fetch(`${API}/turn-credentials`)
    .then(r => r.json())
    .then(servers => setIceServers(servers))
    .catch(console.error);
}, []);
  // keep callPeerRef in sync
  useEffect(() => { callPeerRef.current = callPeer; }, [callPeer]);

  /* ── MESSAGES ── */
  useEffect(() => {
    if (chatUser && chatUser !== 'group') loadMessages();
    else setMessages([]);
  }, [chatUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await axios.get(`${API}/messages`, {
        params: { user1: loggedInUser, user2: chatUser },
      });
      setMessages(res.data);
    } catch (e) { console.error(e); }
  };

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

  useEffect(() => {
    const show = ({ from }) => { if (from === chatUser) setIsTyping(true); };
    const hide = ({ from }) => { if (from === chatUser) setIsTyping(false); };
    socket.on('typing:show', show);
    socket.on('typing:hide', hide);
    return () => { socket.off('typing:show', show); socket.off('typing:hide', hide); };
  }, [chatUser]);

  // FIX: add message to local state immediately so it shows without re-fetch
  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;
    setNewMessage('');
    socket.emit('typing:stop', { to: chatUser });

    if (chatUser === 'group') {
      socket.emit('chatMessage', text);
    } else {
      const msg = { from: loggedInUser, to: chatUser, text, timestamp: Date.now() };
      setMessages(prev => [...prev, msg]); // show instantly
      socket.emit('private_message', { to: chatUser, text });
      try {
        await axios.post(`${API}/sendMessage`, { from: loggedInUser, to: chatUser, text });
      } catch (e) { console.error(e); }
    }
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

  /* ── WebRTC ── */

  // FIX: take targetPeer as arg instead of reading from state (which may be stale)
  const createPeer = useCallback((stream, targetPeer) => {
    const pc = new RTCPeerConnection({ iceServers });

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const peer = targetPeer || callPeerRef.current;
        socket.emit('webrtc:ice', { to: peer, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall();
      }
    };

    pc.onnegotiationneeded = async () => {
      pc.getSenders().forEach(sender => {
        if (!sender.track) return;
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = sender.track.kind === 'video' ? 8000000 : 510000;
        sender.setParameters(params).catch(console.error);
      });
    };
    peerRef.current = pc;
    return pc;
  }, []);

  const startCall = async (mode) => {
    if (chatUser === 'group') return;
    const target = chatUser;
    setCallMode(mode);
    setCallPeer(target);
    callPeerRef.current = target;
    setCallState('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: 2,
  },
  video: mode === 'video' ? {
    width: { ideal: 3840 },
    height: { ideal: 2160 },
    frameRate: { ideal: 60 },
    facingMode: 'user',
  } : false,
});
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeer(stream, target); // FIX: pass target directly

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', { to: target, offer, mode, from: loggedInUser });
    } catch (err) {
      console.error('getUserMedia error', err);
      alert('Could not access camera/mic. Check permissions.');
      setCallState('idle');
    }
  };

  // FIX: answerCall now properly creates peer before setting remote description
  const answerCall = async (offerData) => {
    const from = offerData.from;
    setCallMode(offerData.mode);
    setCallPeer(from);
    callPeerRef.current = from;
    setCallState('in-call');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    sampleSize: 16,
    channelCount: 2,
  },
  video: offerData.mode === 'video' ? {
    width: { ideal: 3840 },
    height: { ideal: 2160 },
    frameRate: { ideal: 60 },
    facingMode: 'user',
  } : false,
});
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeer(stream, from); // FIX: pass from directly

      // FIX: set remote description AFTER peer is created
      await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', { to: from, answer });
    } catch (err) {
      console.error('answer error', err);
      setCallState('idle');
    }
  };

  const declineCall = (from) => {
    socket.emit('webrtc:call-end', { to: from });
    setCallState('idle');
    setCallPeer(null);
    callPeerRef.current = null;
  };

  const endCall = useCallback(() => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    const peer = callPeerRef.current;
    if (peer) socket.emit('webrtc:call-end', { to: peer });
    setCallState('idle');
    setCallPeer(null);
    callPeerRef.current = null;
    setLocalStream(null);
    setMuted(false);
    setCamOff(false);
    setScreenSharing(false);
  }, []);

  useEffect(() => {
    const onOffer = (data) => {
      pendingOfferRef.current = data; // FIX: store in ref not socket
      setCallPeer(data.from);
      callPeerRef.current = data.from;
      setCallState('ringing');
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
      callPeerRef.current = null;
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
        screenTrack.onended = () => toggleScreen();
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

  const otherUsers = users.filter(u => u.username !== loggedInUser);
  const activePeerData = users.find(u => u.username === chatUser);

  return (
    <div className="ch-root">
      <aside className="ch-sidebar">
        <div className="ch-sidebar-header">
          <span className="ch-sidebar-title">Messages</span>
          <span className="ch-online-count">{onlineUsers.length} online</span>
        </div>

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

      <main className="ch-main">
        {/* RINGING */}
        {callState === 'ringing' && (
          <div className="ch-call-overlay">
            <div className="ch-call-modal">
              <div className="ch-call-ring-anim" />
              <p className="ch-call-who">Incoming {pendingOfferRef.current?.mode} call</p>
              <p className="ch-call-from">{callPeer}</p>
              <div className="ch-call-actions">
                <button className="ch-btn-answer" onClick={() => answerCall(pendingOfferRef.current)}>Answer</button>
                <button className="ch-btn-decline" onClick={() => declineCall(callPeer)}>Decline</button>
              </div>
            </div>
          </div>
        )}

        {/* CALLING */}
        {callState === 'calling' && (
          <div className="ch-call-overlay">
            <div className="ch-call-modal">
              <div className="ch-call-ring-anim pulse" />
              <p className="ch-call-who">Calling {callPeer}…</p>
              <button className="ch-btn-decline" onClick={endCall}>Cancel</button>
            </div>
          </div>
        )}

        {/* IN CALL */}
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
                    <div className="ch-voice-avatar">{callPeer?.[0]?.toUpperCase()}</div>
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
              <button className={`ch-ctrl-btn ${muted ? 'active-red' : ''}`} onClick={toggleMute}>
                {muted ? '🔇' : '🎤'}
              </button>
              {callMode === 'video' && (
                <>
                  <button className={`ch-ctrl-btn ${camOff ? 'active-red' : ''}`} onClick={toggleCam}>
                    {camOff ? '📷' : '📹'}
                  </button>
                  <button className={`ch-ctrl-btn ${screenSharing ? 'active-purple' : ''}`} onClick={toggleScreen}>
                    🖥
                  </button>
                </>
              )}
              <button className="ch-ctrl-btn ch-ctrl-end" onClick={endCall}>📵</button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="ch-header">
          {chatUser === 'group' ? (
            <div className="ch-header-info">
              <span className="ch-header-name">Global Chat</span>
              <span className="ch-header-sub">{onlineUsers.length} users online</span>
            </div>
          ) : (
            <div className="ch-header-info">
              {activePeerData?.avatar && (
                <img src={resolveAvatarUrl(activePeerData.avatar)} alt={chatUser} className="ch-header-avatar" />
              )}
              <div>
                <span className="ch-header-name">{chatUser}</span>
                <span className="ch-header-sub">{onlineUsers.includes(chatUser) ? '● Online' : '● Offline'}</span>
              </div>
            </div>
          )}
          {chatUser !== 'group' && callState === 'idle' && (
            <div className="ch-header-actions">
              <button className="ch-call-btn ch-call-btn--voice" onClick={() => startCall('voice')}>
                <span>📞</span> Voice
              </button>
              <button className="ch-call-btn ch-call-btn--video" onClick={() => startCall('video')}>
                <span>📹</span> Video
              </button>
            </div>
          )}
        </div>

        {/* MESSAGES */}
        <div className="ch-messages">
          {messages.length === 0 && (
            <div className="ch-messages-empty">
              {chatUser === 'group' ? 'Send a message to the group.' : `Start a conversation with ${chatUser}.`}
            </div>
          )}
          {messages.map((m, i) => {
            const isMe = m.from === loggedInUser || m.username === loggedInUser;
            const sender = m.from || m.username || '?';
            return (
              <div key={i} className={`ch-bubble-row ${isMe ? 'me' : 'them'}`}>
                {!isMe && <div className="ch-bubble-avatar">{sender[0]?.toUpperCase()}</div>}
                <div className="ch-bubble-wrap">
                  {!isMe && <span className="ch-bubble-sender">{sender}</span>}
                  <div className={`ch-bubble ${isMe ? 'ch-bubble--me' : 'ch-bubble--them'}`}>{m.text}</div>
                  <span className="ch-bubble-ts">{ts(m.timestamp)}</span>
                </div>
              </div>
            );
          })}
          {isTyping && <div className="ch-typing"><span /><span /><span /></div>}
          <div ref={messagesEndRef} />
        </div>

        {/* COMPOSER */}
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
