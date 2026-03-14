import React, { useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.bubble.css";
import "./PurpleRoom.css";
import socket from './socket';
import { useAccount } from 'wagmi';

const API = "http://localhost:4000";

// ❌ This JSX must be inside a component
// {/* Example: open DM with selected friend */}
// {selectedPeer && <PurpleRoom peer={selectedPeer} />}

// ✅ DM Component (Renamed to avoid duplicate declaration)
export function PurpleDMRoom({ peer }) {
  const { address } = useAccount();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!address || !peer) return;
    socket.emit('dm:join', { peer });

    const onMsg = (m) => {
      setMsgs((prev) => [...prev, m]);
    };
    socket.on('dm:message', onMsg);

    return () => {
      socket.off('dm:message', onMsg);
      socket.emit('dm:leave', { peer });
    };
  }, [address, peer]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socket.emit('dm:message', { peer, text: t }, (res) => {
      if (res?.ok) setText('');
    });
  };

  return (
    <div style={{
      background: '#160a1f',
      border: '1px solid #3a2852',
      borderRadius: 12,
      width: '100%',
      maxWidth: 720,
      margin: '0 auto',
      padding: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#caa6ff', marginBottom: 8 }}>
        Purple Room — DM with {peer}
      </div>

      <div style={{
        height: 360,
        overflowY: 'auto',
        background: '#120717',
        border: '1px solid #2b1d3a',
        borderRadius: 8,
        padding: 10,
      }}>
        {msgs.map(m => (
          <div key={m.id} style={{
            display: 'flex',
            justifyContent: m.from.toLowerCase() === (address || '').toLowerCase() ? 'flex-end' : 'flex-start',
            marginBottom: 8,
          }}>
            <div style={{
              maxWidth: '70%',
              background: m.from.toLowerCase() === (address || '').toLowerCase() ? '#6f42c1' : '#2d1b3a',
              color: '#fff',
              padding: '8px 10px',
              borderRadius: 10,
              fontSize: 13,
              wordBreak: 'break-word',
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          style={{
            flex: 1,
            background: '#100714',
            color: '#fff',
            border: '1px solid #3a2852',
            borderRadius: 8,
            padding: '10px',
            fontFamily: 'Consolas, monospace',
            fontSize: 13
          }}
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}

// ✅ Main PurpleRoom component
export default function PurpleRoom({ currentUser }) {
  const [showGate, setShowGate] = useState(true);
  const [posts, setPosts] = useState([]);
  const [editorHtml, setEditorHtml] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const quillRef = useRef(null);

  const isOwner = currentUser?.toLowerCase() === "z";

  const loadPosts = async () => {
    const res = await fetch(`${API}/purple-posts`);
    const data = await res.json();
    setPosts(data);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const insertFile = (file, type) => {
    if (!file || !isOwner) return;
    const reader = new FileReader();
    reader.onload = () => {
      const quill = quillRef.current?.getEditor();
      const range = quill.getSelection(true);
      quill.insertEmbed(range ? range.index : 0, type, reader.result, "user");
      quill.setSelection((range ? range.index : 0) + 1);
    };
    reader.readAsDataURL(file);
  };

  const post = async () => {
    if (!isOwner || !editorHtml.trim()) return;
    await fetch(`${API}/purple-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "z", content: editorHtml })
    });
    setEditorHtml("");
    await loadPosts();
  };

  const startRename = (id, currentHtml) => {
    setRenamingId(id);
    setRenameValue(currentHtml);
  };

  const saveRename = async () => {
    if (!renamingId || !isOwner) return;
    await fetch(`${API}/purple-rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin: "z", id: renamingId, new_content: renameValue })
    });
    setRenamingId(null);
    setRenameValue("");
    await loadPosts();
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const removePost = async (id) => {
    if (!isOwner) return;
    await fetch(`${API}/purple-delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin: "z", id })
    });
    await loadPosts();
  };

  return (
    <div className="purple-room-full">
      {showGate && (
        <div className="purple-gate">
          <div className="purple-gate-box">
            <h1>The Purple Room</h1>
            <p>Owner-curated. View only unless you are Z.</p>
            <button onClick={() => setShowGate(false)}>I understand</button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="editor-panel">
          <ReactQuill
            ref={quillRef}
            theme="bubble"
            value={editorHtml}
            onChange={setEditorHtml}
            placeholder="Write anything — text, images, video embeds..."
          />
          <div className="editor-tools">
            <label>📷 Image<input type="file" accept="image/*" onChange={e => insertFile(e.target.files[0], "image")} /></label>
            <label>🎥 Video<input type="file" accept="video/*" onChange={e => insertFile(e.target.files[0], "video")} /></label>
            <button onClick={post}>Post</button>
          </div>
        </div>
      )}

      <div className="purple-posts">
        {posts.map(p => (
          <div key={p.id} className="purple-post">
            {renamingId === p.id ? (
              <div className="rename-card">
                <ReactQuill theme="bubble" value={renameValue} onChange={setRenameValue} />
                <div className="rename-actions">
                  <button onClick={saveRename}>Save</button>
                  <button onClick={cancelRename}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="post-inner" dangerouslySetInnerHTML={{ __html: p.content }} />
            )}

            <div className="post-meta">
              <span>By: {p.username}</span>
              <span> • {new Date(p.ts * 1000).toLocaleString()}</span>
            </div>

            <div className="vote-bar">
              <button disabled>👍 Like</button>
              <button disabled>👎 Dislike</button>

              {isOwner && renamingId !== p.id && (
                <div className="owner-controls">
                  <button onClick={() => startRename(p.id, p.content)}>Rename</button>
                  <button onClick={() => removePost(p.id)} style={{ color: '#ff6b6b' }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
