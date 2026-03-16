import Top10Crypto from './Top10Crypto';
import PostChain from './postchain';

import { CFG } from './config';
import { putFile } from './ipfs';
import { ethers } from 'ethers';
import { uploadFile } from './api/upload';
import GroupChat from "./GroupChat";
import { SiweMessage } from 'siwe';
import axios from 'axios';
import React, { useState, useEffect, useMemo, useRef } from "react";
import socket from './socket';
import { useAccount } from 'wagmi';
import './index.css';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Web3Connect from './web3connect.jsx';
import PurpleRoom from './PurpleRoom';
import './Chat.css';
import UserProfile, { VerifiedBadge, OwnerVerifyPanel, PublicProfile } from './UserProfile';
import CustomCaret from "./CustomCaret";
import LoginGate from "./LoginGate";
import BlockchainTest from "./BlockchainTest";
import DEX from "./components/DEX.jsx";
import Chat from './Chat';
import ProfilePage from './ProfilePage';


function useSpinnerCaret() {
  const frames = ["/", "-", "\\", "|"];
  const [frame, setFrame] = React.useState(frames[0]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => {
        const i = frames.indexOf(prev);
        return frames[(i + 1) % frames.length];
      });
    }, 250); // speed of spin
    return () => clearInterval(interval);
  }, []);

  return frame;
}

const CustomCaretInput = ({ caretFrame, value, ...props }) => {
  const [focused, setFocused] = useState(false);
  const spanRef = useRef(null);
  const [caretLeft, setCaretLeft] = useState(0);

  useEffect(() => {
    if (spanRef.current) {
      setCaretLeft(spanRef.current.offsetWidth);
    }
  }, [value]);

  return (
    <div className="input-wrap" style={{ position: "relative", display: "inline-block" }}>
      {/* Invisible span to measure width of text */}
      <span
        ref={spanRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          fontFamily: "inherit",
          fontSize: "inherit",
        }}
      >
        {value}
      </span>

      <input
        {...props}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ fontFamily: "inherit", fontSize: "inherit" }}
      />

      {focused && (
        <span
          className="spin-caret"
          style={{
            position: "absolute",
            top: "50%",
            left: caretLeft + 10,
            transform: "translateY(-50%)",
          }}
        >
          {caretFrame}
        </span>
      )}
    </div>
  );
};


function App() {
  // at top-level of component
  const [isTyping, setIsTyping] = useState(false);
  const typingStopTimer = useRef(null); // for our own debounce when WE'RE the typist
  const [typingMap, setTypingMap] = useState({}); // { [username]: true/false }
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  // controls which login type is active
  const [loginMode, setLoginMode] = useState("web3"); // "web3" | "email" | "username"
  const [view, setView] = useState('chat');
  const [showCaret, setShowCaret] = useState(false);
  const caretFrame = useSpinnerCaret();
  const [showReset, setShowReset] = useState(false);
  const [resetMethod, setResetMethod] = useState('wallet');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileUsername, setProfileUsername] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [friendAddr, setFriendAddr] = useState('');
  const [friendsList, setFriendsList] = useState({ friends: [], pendingIn: [], pendingOut: [] });
  const [selectedPeer, setSelectedPeer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(() => localStorage.getItem('loggedInUser') || null);
  const [videoFile, setVideoFile] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [friendRequestTo, setFriendRequestTo] = useState('');
  const [registerMode, setRegisterMode] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [chatUser, setChatUser] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState('');
  const [typing, setTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [cryptoData, setCryptoData] = useState([]);
  const [cryptoPage, setCryptoPage] = useState(1);
  const [hasMoreCrypto, setHasMoreCrypto] = useState(true);
  const [isLoadingCrypto, setIsLoadingCrypto] = useState(false);
  const [top10, setTop10] = useState([]);
  const [currentUser, setCurrentUser] = useState("");

  const { address } = useAccount();
  useEffect(() => {
    console.log("DEBUG loggedInUser =", loggedInUser);
    console.log("DEBUG view =", view);
  }, [loggedInUser, view]);

  useEffect(() => {
    if (address) {
      socket.emit('auth:hello', { address });
    }
  }, [address]);

  useEffect(() => {
    const onChatMsg = (msg) => setMessages(prev => [...prev, msg]);
    socket.on('chatMessage', onChatMsg);
    return () => socket.off('chatMessage', onChatMsg);
  }, []);

  useEffect(() => {
    const onTypingUpdate = ({ from, isTyping }) => {
      setTypingMap(prev => ({ ...prev, [from]: !!isTyping }));
    };
    socket.on('typing:update', onTypingUpdate);
    return () => socket.off('typing:update', onTypingUpdate);
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadFile(file);
      const url = data.web3Url || (`https://aesthetic-hub-production.up.railway.app${data.web2Url}`);
      setUploadUrl(url);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const onUpdate = (payload) => {
      setFriendsList({
        friends: payload.friends || [],
        pendingIn: payload.pendingIn || [],
        pendingOut: payload.pendingOut || [],
      });
    };
    const onIncoming = ({ from }) => {
      console.log('Incoming friend request from', from);
    };

    socket.on('friends:update', onUpdate);
    socket.on('friends:incoming', onIncoming);

    return () => {
      socket.off('friends:update', onUpdate);
      socket.off('friends:incoming', onIncoming);
    };
  }, [address]);

  const handleSendFriend = () => {
    if (!friendAddr.trim()) return;
    socket.emit('friends:send', { to: friendAddr.trim() }, (res) => {
      if (!res?.ok) {
        alert(res?.error || 'Failed');
      } else {
        setFriendAddr('');
      }
    });
  };

  const handleResetPassword = async () => {
    alert('Reset link sent (stub). Replace with actual call.');
  };

  useEffect(() => {
    if (loggedInUser) {
      socket.emit('hello', { username: loggedInUser });
    }
  }, [loggedInUser]);

  // reflect current tab on the <body> so CSS can react without changing your JSX
  useEffect(() => {
    document.body.setAttribute('data-view', view || '');
  }, [view]);
  useEffect(() => {
    if (loggedInUser) {
      document.body.classList.add("is-logged-in");
    } else {
      document.body.classList.remove("is-logged-in");
    }
  }, [loggedInUser]);

  const startWalletReset = async () => {
    if (!window.ethereum) { alert('MetaMask required'); return; }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    const { data: nonceData } = await axios.get('https://aesthetic-hub-production.up.railway.app/auth/reset/nonce', {
      params: { address }
    });

    const domain = window.location.host;
    const origin = window.location.origin;
    const message = new SiweMessage({
      domain,
      address,
      statement: 'Reset password for MyCryptoApp',
      uri: origin,
      version: '1',
      chainId: 1,
      nonce: nonceData.nonce
    }).prepareMessage();

    const signature = await signer.signMessage(message);

    const { data: verifyData } = await axios.post('https://aesthetic-hub-production.up.railway.app/auth/reset/verify', {
      message,
      signature
    });

    setResetToken(verifyData.token);
    alert('Wallet verified. Enter a new password and press "Confirm Reset".');
  };

  const requestEmailReset = async () => {
    if (!resetEmail) return alert("Enter your email first");
    try {
      await axios.post("https://aesthetic-hub-production.up.railway.app/requestPasswordReset", { email: resetEmail });
      alert("If the email exists, a reset link has been sent.");
    } catch (err) {
      alert(err.response?.data?.message || "Reset request failed");
    }
  };

  const confirmReset = async () => {
    if (!resetToken || !newPassword) return alert("Token and new password required");
    try {
      await axios.post("https://aesthetic-hub-production.up.railway.app/confirmPasswordReset", {
        token: resetToken,
        newPassword
      });
      alert("Password updated. You can log in now.");
      setShowReset(false);
      setResetEmail('');
      setResetToken('');
      setNewPassword('');
    } catch (err) {
      alert(err.response?.data?.message || "Reset failed");
    }
  };

  const resolveAvatarUrl = (val) => {
    if (!val) return '';
    if (val.startsWith('ipfs://')) return val.replace('ipfs://', 'https://ipfs.io/ipfs/');
    if (val.startsWith('http')) return val;
    if (val.startsWith('/')) return `${CFG.API}${val}`;
    return val;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatUser) return;

    socket.emit('private_message', { to: chatUser, text: newMessage });

    try {
      await axios.post('https://aesthetic-hub-production.up.railway.app/sendMessage', {
        from: loggedInUser,
        to: chatUser,
        text: newMessage,
      });
    } catch (e) {
      console.error('persist message failed', e);
    }

    setNewMessage('');
  };

  useEffect(() => {
    const onFR = ({ from }) => {
      alert(`🔔 New friend request from ${from}`);
      fetchNotifications?.();
    };
    socket.on('friend_request', onFR);
    return () => socket.off('friend_request', onFR);
  }, []);

  function usePrevious(value) {
    const ref = useRef(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref.current;
  }

  function PriceTicker({ value }) {
    const prev = usePrevious(value);
    const dir = value > (prev ?? value) ? "up" : value < (prev ?? value) ? "down" : "flat";
    const text = useMemo(() => {
      try { return Number(value).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}); }
      catch { return String(value); }
    }, [value]);

    const [animKey, setAnimKey] = useState(0);
    useEffect(() => { if (prev !== undefined && prev !== value) setAnimKey(k => k + 1); }, [value, prev]);

    return (
      <span className={`pticker ${dir}`} key={animKey}>
        ${text}
      </span>
    );
  }
<DEX />

  function ChangePct({ pct }) {
    const up = pct >= 0;
    const txt = `${up ? "+" : ""}${pct?.toFixed?.(2) ?? "0.00"}%`;
    return <span className={`chg ${up ? "up" : "down"}`}>{txt}</span>;
  }

  useEffect(() => {
    const fetchTop10 = async () => {
      try {
        const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 10,
            page: 1
          }
        });
        setTop10(res.data);
      } catch (err) {
        console.error("Failed to fetch top 10 cryptos", err);
      }
    };

    fetchTop10();
    const interval = setInterval(fetchTop10, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchCryptoData = async () => {
    if (isLoadingCrypto || !hasMoreCrypto) return;
    setIsLoadingCrypto(true);

    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${cryptoPage}`);
      const data = await res.json();

      setCryptoData(prev => [...prev, ...data]);
      setCryptoPage(prev => prev + 1);
      if (data.length < 250) setHasMoreCrypto(false);
    } catch (err) {
      console.error('Failed to fetch crypto data', err);
    } finally {
      setIsLoadingCrypto(false);
    }
  };

  useEffect(() => {
    if (view === 'crypto' && cryptoData.length === 0) {
      fetchCryptoData();
    }
  }, [view]);

  useEffect(() => {
    const handleScroll = () => {
      const bottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
      if (bottom) {
        fetchCryptoData();
      }
    };
{view === 'profile' && profileUsername && (
  <div style={{ background: '#030305', minHeight: '60vh', color: '#fff', padding: 20 }}>
    <button onClick={() => setView('users')} style={{ color: '#9b5de5', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>← Back</button>
    <ProfilePage
      username={profileUsername}
      loggedInUser={loggedInUser}
      onBack={() => setView('users')}
    />
  </div>
)}
    if (view === 'crypto') {
      window.addEventListener('scroll', handleScroll);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, [view, cryptoData, isLoadingCrypto]);

  useEffect(() => {
    if (!loggedInUser) return;

    try { socket.emit('presence:list'); } catch {}

    const onPresence = (list) => setOnlineUsers(list || []);
    socket.on('presence:update', onPresence);

    return () => {
      socket.off('presence:update', onPresence);
    };
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser || !chatUser) return;
    try {
      socket.emit('messages:read', { viewer: loggedInUser, withUser: chatUser });
    } catch {}
  }, [loggedInUser, chatUser, messages]);

  useEffect(() => {
    const onSeen = ({ by }) => {
      // If `by` is the person you were sending to, you can mark your local messages as seen.
    };
    socket.on('messages:seen', onSeen);
    return () => socket.off('messages:seen', onSeen);
  }, [loggedInUser]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit("chatMessage", chatInput.trim());
    setChatInput('');
  };

  useEffect(() => {
    if (view === 'chat' && !chatUser) {
      setChatUser('group');
    }
    if (view !== 'chat') return;

    if (users.length === 0) {
      fetchUsers();
      return;
    }

    if (!chatUser) {
      const others = users.filter(u => u.username !== loggedInUser);
      if (others.length > 0) setChatUser(others[0].username);
    }
  }, [view, users, loggedInUser, chatUser]);

  useEffect(() => {
    if (view !== 'chat') return;
    const el = document.getElementById('messages-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, view]);

  useEffect(() => {
    if (chatUser) {
      loadMessages();
    }
  }, [chatUser]);

  useEffect(() => {
    if (loggedInUser) {
      fetchPosts();
      fetchUsers();
      fetchNotifications();
    }
  }, [loggedInUser]);

  const fetchPosts = async () => {
    const res = await axios.get('https://aesthetic-hub-production.up.railway.app/posts');
    setPosts(res.data.sort((a, b) => b.timestamp - a.timestamp));
  };

  const fetchUsers = async () => {
    const res = await axios.get('https://aesthetic-hub-production.up.railway.app/users');
    setUsers(res.data);
  };

  const fetchNotifications = async () => {
    const res = await axios.get('https://aesthetic-hub-production.up.railway.app/notifications', {
      params: { username: loggedInUser },
    });
    setNotifications(res.data);
  };

  const handleRemoveAvatar = async () => {
    try {
      await axios.post('https://aesthetic-hub-production.up.railway.app/removeAvatar', { username: loggedInUser });
      fetchUsers();
      alert("Avatar removed.");
    } catch (err) {
      console.error("Failed to remove avatar", err);
    }
  };

  useEffect(() => {
    if (!loggedInUser) {
      if (socket.connected) socket.disconnect();
      return;
    }
    if (!socket.connected) socket.connect();
    socket.emit('join', { username: loggedInUser });

    return () => {
    };
  }, [loggedInUser]);

  useEffect(() => {
    const onMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };
    
    const onOnline = (list) => {
      setOnlineUsers(list);
    };

    socket.on('message', onMessage);
    socket.on('onlineUsers', onOnline);

    return () => {
      socket.off('message', onMessage);
      socket.off('onlineUsers', onOnline);
    };
  }, []);

  useEffect(() => {
    const onShow = ({ from }) => {
      if (from === chatUser) setIsTyping(true);
    };
    const onHide = ({ from }) => {
      if (from === chatUser) setIsTyping(false);
    };
    socket.on('typing:show', onShow);
    socket.on('typing:hide', onHide);
    return () => {
      socket.off('typing:show', onShow);
      socket.off('typing:hide', onHide);
    };
  }, [chatUser]);

  const handleWeb2Register = async () => {
  try {
    await axios.post("https://aesthetic-hub-production.up.railway.app/web2register", {
      username,
      email,
      password
    });
    alert("Registered. Please log in now.");
    setRegisterMode(false);
  } catch (err) {
    alert(err.response?.data?.message || "Web2 register failed");
  }
};

const handleWeb2Login = async () => {
  try {
    const res = await axios.post("https://aesthetic-hub-production.up.railway.app/web2login", {
      identifier: username, // can be username OR email
      password
    });
    setLoggedInUser(res.data.username);
localStorage.setItem('loggedInUser', res.data.username);

    setView("feed");
    socket.emit("presence:join", res.data.username);
    alert("Logged in via Web2.");
  } catch (err) {
    alert(err.response?.data?.message || "Web2 login failed");
  }
};


  const handleEmailRegister = async () => {
    try {
      await axios.post("https://aesthetic-hub-production.up.railway.app/registerEmail", { email, password: emailPassword });
      alert("Registered. Please log in now.");
    } catch (err) {
      alert(err.response?.data?.message || "Email registration failed");
    }
  };

  const handleEmailLogin = async () => {
    try {
      const res = await axios.post("https://aesthetic-hub-production.up.railway.app/loginEmail", { email, password: emailPassword });
setLoggedInUser(res.data.username);
localStorage.setItem('loggedInUser', res.data.username);
localStorage.setItem('loggedInUser', res.data.username);
      setView("feed");
      socket.emit('presence:join', res.data.username);
      alert("Logged in via Email.");
    } catch (err) {
      alert(err.response?.data?.message || "Email login failed");
    }
  };


  const handleSIWELogin = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask required");
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // GET NONCE
      const nonceRes = await axios.get('https://aesthetic-hub-production.up.railway.app/siwe/nonce');
      const nonce = nonceRes.data.nonce;

      // use the actual connected chain id (don't hardcode 1)
      const net = await provider.getNetwork();
      const chainId = Number(net.chainId);

      const domain = window.location.host;
      const origin = window.location.origin;
      const message = new SiweMessage({
        domain,
        address,
        statement: 'Sign in with Ethereum to MyCryptoApp',
        uri: origin,
        version: '1',
        chainId,
        nonce
      }).prepareMessage();

      const signature = await signer.signMessage(message);

      const verifyRes = await axios.post('https://aesthetic-hub-production.up.railway.app/siwe/verify', {
        message,
        signature
      });
      const ethAddr = verifyRes.data.address;
      setLoggedInUser(ethAddr);
localStorage.setItem('loggedInUser', ethAddr);
      setView("feed");

      try { socket.emit('presence:join', ethAddr); } catch {}

      alert(`Logged in as ${ethAddr}`);
    } catch (err) {
      console.error("SIWE error:", err);
      const msg = err?.response?.data?.error || err?.message || "SIWE login failed";
      alert(msg);
    }
  };

  const handleUploadAvatar = async () => {
    try {
      if (!avatarFile) return alert("Pick a file first");

      if (CFG.USE_WEB3_STORAGE) {
        const ipfsUri = await putFile(avatarFile, CFG.WEB3_STORAGE_TOKEN);
        await axios.post(`${CFG.API}/setAvatar`, {
          address: loggedInUser,
          avatar: ipfsUri
        });
      } else {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('username', loggedInUser);
        await axios.post(`${CFG.API}/uploadAvatar`, fd);
      }

      fetchUsers();
      alert("Avatar updated.");
    } catch (err) {
      console.error("avatar error", err);
      alert("Upload failed");
    }
  };

  const handleUploadVideo = async () => {
    if (!videoFile) return;
    const fd = new FormData();
    fd.append('video', videoFile);
    fd.append('username', loggedInUser);
    await axios.post('https://aesthetic-hub-production.up.railway.app/upload', fd);
    setVideoFile(null);
    fetchPosts();
  };

  const handleAddComment = async (video) => {
    await axios.post('https://aesthetic-hub-production.up.railway.app/comment', {
      username: loggedInUser,
      video,
      text: commentText,
    });
    setCommentText('');
    fetchPosts();
  };

  const handleDeleteComment = async (video, timestamp) => {
    await axios.post('https://aesthetic-hub-production.up.railway.app/deleteComment', {
      username: loggedInUser,
      video,
      timestamp,
    });
    fetchPosts();
  };

  const handleSendFriendRequest = async () => {
    if (!friendRequestTo.trim()) return;
    await axios.post('https://aesthetic-hub-production.up.railway.app/sendFriendRequest', {
      from: loggedInUser,
      to: friendRequestTo.trim(),
    });
    setFriendRequestTo('');
    alert('Friend request sent!');
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    await axios.post('https://aesthetic-hub-production.up.railway.app/deleteUser', {
      admin: loggedInUser,
      target: deleteUserTarget,
    });
    alert('User deleted');
    setDeleteUserTarget('');
    fetchUsers();
  };

  const loadMessages = async () => {
    const res = await axios.get('https://aesthetic-hub-production.up.railway.app/messages', {
      params: { user1: loggedInUser, user2: chatUser },
    });
    setMessages(res.data);
  };

  const Logo = ({ caretFrme }) => (
  <div className="logo-row">
    <span className="logo-text">
      <span className="cmd-spinner data-frame={caretFrame}></span>
      
      <span className="cmd-spinner data-frame={caretFrame}></span>
    </span>
  </div>
);




  const loginBlock = (
  <div className="login-form" style={{ minWidth: 360 }}>
    <div className="logo-area" style={{ textAlign:'center', marginBottom:20 }}>
  <Logo caretFrame={caretFrame} />
</div>

    {/* Switch buttons */}
    <div className="login-switch">
      <button
        className={loginMode === "web3" ? "active" : ""}
        onClick={() => setLoginMode("web3")}
      >
        Web3
      </button>
      <button
        className={loginMode === "web2" ? "active" : ""}
        onClick={() => setLoginMode("web2")}
      >
        Web2
      </button>
         </div>

    {/* Panel area */}
    <div className="login-panels shattered">
      {/* WEB3 */}
      {loginMode === "web3" && (
        <div className="login-card">
          <div className="login-title">Connect Wallet</div>
          <ConnectButton />
          <button className="siwe-btn" onClick={handleSIWELogin} style={{ marginTop: 10 }}>
            Sign-In with Ethereum
          </button>
          <div className="login-sub">No passwords. Your wallet <i>is</i> your login.</div>
        </div>
      )}

      {loginMode === "web2" && (
  <div className="login-card">
    <div className="login-title">Web2 {registerMode ? "Register" : "Login"}</div>

    {/* Username field */}
    
    <CustomCaretInput
      placeholder="Username"
      value={username}
      onChange={e => setUsername(e.target.value)}
      caretFrame={caretFrame}
    />

    {/* Show Email only in Register mode */}
    {registerMode && (
      <input
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ marginTop: 6 }}
      />
    )}

    {/* Password */}
    <CustomCaretInput
      type="password"
      placeholder="Password"
      value={password}
      onChange={e => setPassword(e.target.value)}
      style={{ marginTop: 6 }}
      caretFrame={caretFrame}
    />

    {/* Switch between Login/Register */}
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      {!registerMode ? (
        <>
          <button onClick={handleWeb2Login}>Login</button>
          <button onClick={() => setRegisterMode(true)}>Register</button>
        </>
      ) : (
        <>
          <button onClick={handleWeb2Register}>Submit</button>
          <button onClick={() => setRegisterMode(false)}>Cancel</button>
        </>
      )}
    </div>
  </div>
)}

      

      
    </div>
  </div>
);



// Reset Modal JSX, defined once so we can render it anywhere
const resetModal = showReset && (
  <div className="reset-modal" style={{
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.7)',
    zIndex: 9999,
  }}>
    <div style={{
      width: 360,
      background: '#0b0b0b',
      border: '1px solid #222',
      borderRadius: 12,
      padding: 16,
      position: 'relative',
      zIndex: 10000,
    }}>
      <h3>Reset Password</h3>
      {resetMethod === 'email' ? (
        <>
          <input
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ width: '100%', marginBottom: 10 }}
          />
          <button onClick={requestEmailReset}>Send Reset Email</button>
          <input
            value={resetToken}
            onChange={e => setResetToken(e.target.value)}
            placeholder="paste token"
            style={{ width: '100%', margin: '10px 0' }}
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="new password"
            style={{ width: '100%', marginBottom: 10 }}
          />
          <button onClick={confirmReset}>Confirm Reset</button>
        </>
      ) : (
        <p>Wallet reset flow here…</p>
      )}
      <button onClick={() => setShowReset(false)} style={{ marginTop: 10 }}>Close</button>
    </div>
  </div>
);

 return (
  <div className="container">
      {/* ⬅️ this is the fake rainbow caret */}
    
      {/* FULLSCREEN LOGIN GATE */}
      {!loggedInUser && (
        <div id="login-gate">
          {loginBlock}
        </div>
      )}
      {/* ✅ Reset modal shows up even if not logged in */}
      {resetModal}

      
<div className="logo-area">
  <Logo caretFrame={caretFrame} />
</div>

      <div style={{ display: 'flex', gap: '10px', margin: '10px' }}>
        <div className="top-tabs">
          <button className={`tab ${view==='feed' ? 'active' : ''}`} onClick={() => setView('feed')}>Feed</button>
          <button className={`tab ${view==='users' ? 'active' : ''}`} onClick={() => setView('users')}>Users</button>
          <button className={`tab ${view==='chat' ? 'active' : ''}`} onClick={() => setView('chat')}>Chat</button>
          <button className={`tab ${view==='crypto' ? 'active' : ''}`} onClick={() => setView('crypto')}>Crypto</button>
          <button className={`tab ${view==='purple-room' ? 'active' : ''}`} onClick={() => setView('purple-room')}>The Purple Room</button>
          <button className={`tab ${view==='campfire' ? 'active' : ''}`} onClick={() => setView('campfire')}>The Campfire</button>
          <button
            className={`tab aesth ${view==='aesth' ? 'active' : ''}`}
            onClick={() => setView('aesth')}
          >
            $AESTH
          </button>
        </div>
      </div>
      <button 
        className={`tab ${view==='dex' ? 'active' : ''}`} 
        onClick={() => setView('dex')}
      >
        DEX
      </button>
      {view === 'dex' && (
  <DEX />
)}


      {view === 'campfire' && (
        <Campfire />
      )}

      {view === 'purple-room' && (
        <PurpleRoom currentUser={loggedInUser} />
      )}

      {selectedPeer && <PurpleRoom peer={selectedPeer} />}

      <div className="panel">
        <h5>Your Friends</h5>
        {friendsList.friends.length === 0 && (<div style={{opacity:.6, fontSize:12}}>No friends yet</div>)}
        {friendsList.friends.map(f => (
          <div key={f} className="row" style={{ justifyContent:'space-between' }}>
            <span style={{ fontSize:12 }}>{f}</span>
            <button onClick={()=>setSelectedPeer(f)}>Open DM</button>
          </div>
        ))}
      </div>

      <div className="panel">
        <h5>Pending Requests</h5>
        {friendsList.pendingIn.length === 0 && <div style={{opacity:.6, fontSize:12}}>None</div>}
        {friendsList.pendingIn.map((from) => (
          <div key={from} className="row" style={{ justifyContent:'space-between' }}>
            <span style={{ fontSize:12 }}>{from}</span>
            <div className="row">
              <button onClick={()=>{
                socket.emit('friends:respond', { from, accept: true }, (r)=>{ if(!r?.ok) alert('fail'); });
              }}>Accept</button>
              <button onClick={()=>{
                socket.emit('friends:respond', { from, accept: false }, (r)=>{ if(!r?.ok) alert('fail'); });
              }}>Decline</button>
            </div>
          </div>
        ))}
      </div>

      {view === 'feed' && (
        <>
          <div className="feed-layout">
            <div className="left-panel">
              <div>
                <h3>Upload Video</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <input type="file" className="upload-input" onChange={e => setVideoFile(e.target.files[0])} />
                  <button onClick={handleUploadVideo}>Upload</button>
                </div>
              </div>
              <div>
                <h3>Reset Password</h3>
                <input
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <button onClick={handleResetPassword}>Reset</button>
              </div>
              <div>
                <h3>Send Friend Request</h3>
                <div className="input-wrap">
 <CustomCaretInput
    placeholder="Username"
    value={username}
    onChange={e => setUsername(e.target.value)}
    caretFrame={caretFrame}
  />
</div>

                <button onClick={handleSendFriendRequest}>Send</button>
              </div>
          </div>

          <div className="crypto-panel neo">
            <div className="cp-header">
              <span>Top 10 Crypto</span>
              <h4>
                <span className="live-badge">LIVE</span>
              </h4>
            </div>

            {top10.map((coin) => (
              <div key={coin.id} className="coin">
                <div className="left">
                  <img src={coin.image} alt={coin.name} />
                  <div className="names">
                    <strong>{coin.name}</strong>
                  </div>
              </div>
              <div className="right">
                <PriceTicker value={coin.current_price} />
              </div>
            </div>
          ))}
        </div>

            <div className="posts-area">
              {loggedInUser === 'admin' && (
                <div style={{ padding: '10px' }}>
                  <h3>Delete User</h3>
                  <input
                    placeholder="Target Username"
                    value={deleteUserTarget}
                    onChange={e => setDeleteUserTarget(e.target.value)}
                  />
                  <button onClick={handleDeleteUser}>Delete User</button>
                  <PostChain />
                </div>
              )}

              {posts.map((post, idx) => (
                <div key={idx} className="post">
                  <p><strong>{post.username}</strong></p>
                  <video controls className="video-player">
                    <source src={`https://aesthetic-hub-production.up.railway.app${post.video}`} type="video/mp4" />
                  </video>
                  {post.comments.map((c, i) => (
                    <div key={i}>
                      <p>{c.username}: {c.text}</p>
                      {c.username === loggedInUser && (
                        <button onClick={() => handleDeleteComment(post.video, c.timestamp)}>
                          Delete Comment
                        </button>
                      )}
                    </div>
                  ))}
                  <input
                    placeholder="Comment..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                  />
                  <button onClick={() => handleAddComment(post.video)}>Comment</button>
                </div>
              ))}
          </div>
          <UserProfile
  loggedInUser={loggedInUser}
  isOwner={loggedInUser === 'kareem'}
  onLogout={() => {
    setLoggedInUser(null);
    localStorage.removeItem('loggedInUser');
  }}
  onUsersUpdate={fetchUsers}
/>

            <div className="panel-stack">
              <div className="panel">
                <h5>Upload Image / Video</h5>
                <div className="row">
                  <input type="file" accept="image/*,video/*" onChange={handleUpload} />
                </div>
                {uploading && <div style={{ marginTop: 8, fontSize: 12, opacity: .8 }}>Uploading…</div>}
                {uploadUrl && (
                  <div style={{ marginTop: 8, fontSize: 12, wordBreak: 'break-all' }}>
                    Uploaded: {uploadUrl}
                  </div>
                )}
              </div>

              <div className="panel">
                <h5>Reset Password</h5>
                <button onClick={handleResetPassword}>Send Reset</button>
              </div>
<button
  onClick={async () => {
    const email = prompt("Enter your registered email:");
    if (!email) return;

    const res = await fetch("https://aesthetic-hub-production.up.railway.app/requestPasswordReset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    alert(data.message); // "Reset email sent"
  }}
>
  Forgot Password?
</button>

              <div className="panel">
                <h5>Send Friend Request</h5>
                <div className="row">
                  <input
                    type="text"
                    placeholder="Wallet / Username"
                    value={friendAddr}
                    onChange={(e)=>setFriendAddr(e.target.value)}
                  />
                  <button onClick={handleSendFriend}>Send</button>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20, borderTop: '1px solid #333', paddingTop: 12 }}>
            <h3>Realtime Chat</h3>
            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #222',
              padding: 8,
              marginBottom: 8
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 4 }}>{m}</div>
              ))}
            </div>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type message..."
              style={{ width: '70%', marginRight: 8 }}
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </>
      )}

      {view === 'aesth' && (
        <div style={{ color:'#fff', padding:'20px', minHeight:'60vh', background:'#000' }}>
          <h2>$AESTH</h2>
          <p>Coming soon.</p>
<BlockchainTest />
        </div>
      )}

      {view === 'users' && (
        <div style={{ padding: '10px' }}>
          <h3>Users</h3>
          <ul style={{ listStyle: 'none', padding: '0' }}>
            {users.map((u, i) => (
              <li key={i} style={{ marginBottom: '10px' }}>
                {u.avatar && (
                  <img
                    src={resolveAvatarUrl(u.avatar)}
                    alt="Avatar"
                    style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '10px', verticalAlign: 'middle' }}
                  />
                )}

                <span>
                  {u.username}
                  {onlineUsers.includes(u.username) ? (
                    <span style={{ color: 'green', marginLeft: '5px' }}>● Online</span>
                  ) : (
                    <span style={{ color: 'gray', marginLeft: '5px' }}>● Offline</span>
                  )}
                </span>
                {loggedInUser !== u.username && (
  <button
    style={{ marginLeft: '10px' }}
    onClick={() => {
      setChatUser(u.username);
      setView('chat');
    }}
  >
    Chat
  </button>
)}
{(
  <button
    style={{ marginLeft: '10px' }}
    onClick={() => {
      setProfileUsername(u.username);
      setView('profile');
    }}
  >
    Profile
  </button>
)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === 'crypto' && (
        <div style={{
          padding: '10px',
          maxWidth: '700px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <h3>Live Cryptocurrency Prices</h3>

          {cryptoData.map((coin, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: '#111',
              border: '1px solid #333',
              borderRadius: '6px',
              padding: '8px',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={coin.image} alt={coin.name} width="24" height="24" />
                <strong>{coin.name} ({coin.symbol.toUpperCase()})</strong>
              </div>
              <span>${coin.current_price.toLocaleString()}</span>
            </div>
          ))}

          {isLoadingCrypto && <p>Loading more...</p>}
          {!hasMoreCrypto && <p style={{ color: 'gray' }}>All cryptocurrencies loaded.</p>}
        </div>
      )}

     

{view === 'chat' && (
  <Chat
    loggedInUser={loggedInUser}
    users={users}
    onlineUsers={onlineUsers}
    resolveAvatarUrl={resolveAvatarUrl}
  />
)}

      
    </div>
  );
}

export default App;