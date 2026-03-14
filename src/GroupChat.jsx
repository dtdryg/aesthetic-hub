// src/GroupChat.jsx
import React, { useEffect, useRef, useState } from "react";
import socket from "./socket"; // reuse your existing socket instance
import "./GroupChat.css"; // optional small styles

export default function GroupChat({ loggedInUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const boxRef = useRef();

  useEffect(() => {
    // join shared room
    socket.emit("joinRoom", "GroupRoom");

    // receive new messages
    const handleReceive = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("receiveMessage", handleReceive);

    // load recent messages
    socket.emit("loadRoomHistory", "GroupRoom");
    socket.on("roomHistory", (history = []) => {
      setMessages(history);
    });

    // handle typing notifications
    const handleTyping = ({ user }) => {
      if (user !== loggedInUser) {
        setTypingUsers((prev) => {
          if (!prev.includes(user)) return [...prev, user];
          return prev;
        });
        // remove typing indicator after 2 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== user));
        }, 2000);
      }
    };
    socket.on("userTyping", handleTyping);

    return () => {
      socket.off("receiveMessage", handleReceive);
      socket.off("roomHistory");
      socket.off("userTyping", handleTyping);
      socket.emit("leaveRoom", "GroupRoom");
    };
  }, [loggedInUser]);

  useEffect(() => {
    // auto-scroll
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    const payload = {
      roomName: "GroupRoom",
      message: text.trim(),
      user: loggedInUser || "anonymous",
      ts: Date.now(),
    };
    socket.emit("sendMessage", payload);
    setMessages((prev) => [...prev, payload]); // optimistically add
    setText("");
  };

  const onType = () => {
    socket.emit("typingInRoom", { roomName: "GroupRoom", user: loggedInUser });
  };

  return (
    <div className="group-chat">
      <div className="group-header">👥 Group Chat</div>

      <div className="group-box" ref={boxRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`group-msg ${m.user === loggedInUser ? "me" : "them"}`}
          >
            <div className="meta">
              <strong>{m.user}</strong>{" "}
              <span className="ts">
                {new Date(m.ts || Date.now()).toLocaleTimeString()}
              </span>
            </div>
            <div className="txt">{m.message}</div>
          </div>
        ))}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}
      </div>

      <div className="group-composer">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onType();
          }}
          placeholder="Say something to the group..."
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button onClick={send}>Send</button>
      </div>
    </div>
  );
}
