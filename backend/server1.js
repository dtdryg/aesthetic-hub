import express from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { SiweMessage } from "siwe";
import cors from "cors";
import fs from "fs";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ------------------- SUPABASE -------------------
const supabase = createClient(
  "https://djzmbtivllakyzgkwcze.supabase.co",
  process.env.SUPABASE_KEY // put your anon key in backend/.env as SUPABASE_KEY
);

// ------------------- CONFIG -------------------
const app = express();
const PORT = 4000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

// ------------------- SOCKET USER TRACKING -------------------
const userToSockets = new Map();
const socketToUser = new Map();

function broadcastOnlineUsers() {
  const online = Array.from(userToSockets.keys());
  io.emit("onlineUsers", online);
}

// ------------------- FILE PATHS -------------------
if (!fs.existsSync(path.join(__dirname, "uploads"))) fs.mkdirSync(path.join(__dirname, "uploads"));
if (!fs.existsSync(path.join(__dirname, "avatars"))) fs.mkdirSync(path.join(__dirname, "avatars"));

// ------------------- MULTER -------------------
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, uuidv4() + ext.toLowerCase());
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "avatars")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${(req.body.username || "user")}-${Date.now()}${ext.toLowerCase()}`);
    },
  }),
});

// ------------------- MAILER -------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ------------------- AUTH -------------------
app.post("/web2register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  try {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existing) return res.status(400).json({ message: "Username or email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const { error } = await supabase.from("users").insert({ username, email, password: hashed });
    if (error) throw error;

    res.json({ message: "Registered successfully", username });
  } catch (err) {
    console.error("web2register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/web2login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ message: "Identifier and password required" });

  try {
    const { data: user } = await supabase
      .from("users")
      .select("username, email, password")
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .single();

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    res.json({ message: "Login successful", username: user.username });
  } catch (err) {
    console.error("web2login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ------------------- USERS -------------------
app.get("/users", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("username, email, avatar");
  if (error) return res.status(500).json({ message: "Failed to fetch users" });
  res.json(data);
});

// ------------------- POSTS -------------------
app.post("/upload", uploadVideo.single("video"), async (req, res) => {
  const { username } = req.body || {};
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  const { error } = await supabase.from("posts").insert({
    username,
    video: `/uploads/${req.file.filename}`,
    timestamp: Date.now(),
    comments: [],
  });

  if (error) return res.status(500).json({ message: "Upload failed" });
  res.json({ message: "Video uploaded" });
});

app.get("/posts", async (req, res) => {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("timestamp", { ascending: false });
  if (error) return res.status(500).json({ message: "Failed to fetch posts" });
  res.json(data);
});

app.post("/comment", async (req, res) => {
  const { username, video, text } = req.body || {};

  const { data: post } = await supabase
    .from("posts")
    .select("comments")
    .eq("video", video)
    .single();

  if (!post) return res.status(400).json({ message: "Post not found" });

  const comments = [...(post.comments || []), { username, text, timestamp: Date.now() }];
  const { error } = await supabase.from("posts").update({ comments }).eq("video", video);
  if (error) return res.status(500).json({ message: "Comment failed" });
  res.json({ message: "Comment added" });
});

app.post("/deleteComment", async (req, res) => {
  const { username, video, timestamp } = req.body || {};

  const { data: post } = await supabase
    .from("posts")
    .select("comments")
    .eq("video", video)
    .single();

  if (!post) return res.status(400).json({ message: "Post not found" });

  const comments = (post.comments || []).filter(
    c => !(c.timestamp === timestamp && c.username === username)
  );
  await supabase.from("posts").update({ comments }).eq("video", video);
  res.json({ message: "Comment deleted" });
});

// ------------------- AVATARS -------------------
app.post("/uploadAvatar", uploadAvatar.single("avatar"), async (req, res) => {
  const { username } = req.body || {};
  if (!req.file) return res.status(400).json({ message: "Upload failed" });

  const { error } = await supabase
    .from("users")
    .update({ avatar: `/avatars/${req.file.filename}` })
    .eq("username", username);

  if (error) return res.status(500).json({ message: "Avatar update failed" });
  res.json({ message: "Avatar uploaded" });
});

app.post("/removeAvatar", async (req, res) => {
  const { username } = req.body || {};
  await supabase.from("users").update({ avatar: "" }).eq("username", username);
  res.json({ message: "Avatar removed" });
});

// ------------------- PURPLE ROOM -------------------
app.get("/purple/posts", async (req, res) => {
  const { data, error } = await supabase
    .from("purple_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ message: "Failed" });
  res.json(data);
});

app.post("/purple/posts", async (req, res) => {
  const { username, title, blocks } = req.body || {};
  if (username !== "z") return res.status(403).json({ message: "Only owner can post" });

  const { data, error } = await supabase
    .from("purple_posts")
    .insert({ title, blocks, author: username, endorsements: 0 })
    .select()
    .single();

  if (error) return res.status(500).json({ message: "Post failed" });
  res.json({ message: "Post added", post: data });
});

app.post("/purple/endorse/:id", async (req, res) => {
  const { id } = req.params;
  const { data: post } = await supabase
    .from("purple_posts")
    .select("endorsements")
    .eq("id", id)
    .single();

  if (!post) return res.status(404).json({ message: "Not found" });

  const { error } = await supabase
    .from("purple_posts")
    .update({ endorsements: post.endorsements + 1 })
    .eq("id", id);

  if (error) return res.status(500).json({ message: "Endorse failed" });
  res.json({ message: "Endorsed", endorsements: post.endorsements + 1 });
});

// ------------------- MESSAGES -------------------
app.post("/sendMessage", async (req, res) => {
  const { from, to, text } = req.body || {};
  const msg = { from, to, text, timestamp: Date.now() };

  const { error } = await supabase.from("messages").insert(msg);
  if (error) return res.status(500).json({ message: "Message failed" });

  const targets = userToSockets.get(to);
  if (targets) targets.forEach(sid => io.to(sid).emit("message", msg));
  const senderSockets = userToSockets.get(from);
  if (senderSockets) senderSockets.forEach(sid => io.to(sid).emit("message", msg));

  res.json({ message: "Message sent" });
});

app.get("/messages", async (req, res) => {
  const { user1, user2 } = req.query || {};
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(from.eq.${user1},to.eq.${user2}),and(from.eq.${user2},to.eq.${user1})`)
    .order("timestamp", { ascending: true });

  if (error) return res.status(500).json({ message: "Failed to fetch messages" });
  res.json(data);
});

// ------------------- NOTIFICATIONS -------------------
app.get("/notifications", async (req, res) => {
  const { username } = req.query || {};
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("username", username)
    .order("created_at", { ascending: false });
  res.json(data || []);
});

// ------------------- PASSWORD RESET -------------------
app.post("/requestPasswordReset", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  try {
    const { data: user } = await supabase
      .from("users")
      .select("username")
      .eq("email", email)
      .single();

    if (!user) return res.status(400).json({ message: "Email not registered" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from("password_reset_tokens").insert({ email, token, expires_at: expiresAt });

    await transporter.sendMail({
      from: `"Aesthetic Hub" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Password Reset",
      text: `Your reset token: ${token}\n\nPaste this in the app to set a new password.`,
    });

    res.json({ message: "Reset email sent" });
  } catch (err) {
    console.error("EMAIL ERROR:", err);
    res.status(500).json({ message: "Email send failed" });
  }
});

app.post("/confirmPasswordReset", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: "Token and new password required" });

  try {
    const { data: row } = await supabase
      .from("password_reset_tokens")
      .select("email, expires_at")
      .eq("token", token)
      .single();

    if (!row) return res.status(400).json({ message: "Invalid or expired token" });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from("password_reset_tokens").delete().eq("token", token);
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from("users").update({ password: hashed }).eq("email", row.email);
    await supabase.from("password_reset_tokens").delete().eq("token", token);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("confirmPasswordReset error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ------------------- FRIENDS -------------------
app.get("/api/friends", async (req, res) => {
  const me = req.query.me;
  if (!me) return res.status(400).json({ error: "me required" });

  const { data } = await supabase
    .from("friends")
    .select("*")
    .or(`user1.eq.${me},user2.eq.${me}`);

  const friends = (data || [])
    .filter(f => f.status === "accepted")
    .map(f => f.user1 === me ? f.user2 : f.user1);

  const pendingIn = (data || [])
    .filter(f => f.status === "pending" && f.user2 === me)
    .map(f => f.user1);

  const pendingOut = (data || [])
    .filter(f => f.status === "pending" && f.user1 === me)
    .map(f => f.user2);

  res.json({ ok: true, friends, pendingIn, pendingOut });
});

// ------------------- SIWE -------------------
const siweNonces = new Map();

app.get("/siwe/nonce", (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  siweNonces.set(nonce, Date.now());
  res.json({ nonce });
});

app.post("/siwe/verify", async (req, res) => {
  const { message, signature } = req.body;
  try {
    const siwe = new SiweMessage(message);
    const { data: fields } = await siwe.verify({ signature });
    if (!siweNonces.has(fields.nonce))
      return res.status(400).json({ error: "Invalid nonce" });
    siweNonces.delete(fields.nonce);
    res.json({ address: fields.address });
  } catch (err) {
    res.status(400).json({ error: "Verification failed" });
  }
});

// ------------------- STATIC FILES -------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/avatars", express.static(path.join(__dirname, "avatars")));
app.post("/updateProfile", async (req, res) => {
  const { username, bio, display_name } = req.body;
  if (!username) return res.status(400).json({ message: "Username required" });
  const { error } = await supabase
    .from("users")
    .update({ bio, display_name })
    .eq("username", username);
  if (error) return res.status(500).json({ message: "Update failed" });
  res.json({ message: "Profile updated" });
});

// Owner verifies a user
app.post("/verifyUser", async (req, res) => {
  const { admin, target } = req.body;
  // Replace 'kareem' with YOUR username
  if (admin !== 'kareem') return res.status(403).json({ message: "Not authorized" });
  const { error } = await supabase
    .from("users")
    .update({ verified: true })
    .eq("username", target);
  if (error) return res.status(500).json({ message: "Verify failed" });
  res.json({ message: "User verified" });
});

// Send email verification code
app.post("/sendVerifyEmail", async (req, res) => {
  const { username, code } = req.body;
  try {
    const { data: user } = await supabase
      .from("users")
      .select("email")
      .eq("username", username)
      .single();
    if (!user?.email) return res.status(400).json({ message: "No email on file" });
    await transporter.sendMail({
      from: `"Aesthetic Hub" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "Verify your email",
      text: `Your verification code: ${code}\n\nEnter this in the app to verify your email.`,
    });
    res.json({ message: "Code sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Email send failed" });
  }
});

// Confirm email verified
app.post("/verifyEmail", async (req, res) => {
  const { username } = req.body;
  const { error } = await supabase
    .from("users")
    .update({ email_verified: true })
    .eq("username", username);
  if (error) return res.status(500).json({ message: "Failed" });
  res.json({ message: "Email verified" });
});

// ------------------- SOCKET.IO -------------------
io.on("connection", (socket) => {
  socket.on("join", ({ username }) => {
    if (!username) return;
    socketToUser.set(socket.id, username);
    if (!userToSockets.has(username)) userToSockets.set(username, new Set());
    userToSockets.get(username).add(socket.id);
    broadcastOnlineUsers();
  });

  socket.on("typing:start", ({ to }) => {
    const from = socketToUser.get(socket.id);
    if (!from || !to) return;
    const targets = userToSockets.get(to);
    if (!targets) return;
    targets.forEach(sid => io.to(sid).emit("typing:show", { from }));
  });

  socket.on("typing:stop", ({ to }) => {
    const from = socketToUser.get(socket.id);
    if (!from || !to) return;
    const targets = userToSockets.get(to);
    if (!targets) return;
    targets.forEach(sid => io.to(sid).emit("typing:hide", { from }));
  });

  socket.on("presence:list", () => {
    socket.emit("onlineUsers", Array.from(userToSockets.keys()));
  });

  socket.on("presence:join", (username) => {
    if (!username) return;
    socketToUser.set(socket.id, username);
    if (!userToSockets.has(username)) userToSockets.set(username, new Set());
    userToSockets.get(username).add(socket.id);
    broadcastOnlineUsers();
  });

  socket.on("private_message", ({ to, text }) => {
    const from = socketToUser.get(socket.id);
    if (!from || !to || !text?.trim()) return;
    const msg = { from, to, text, timestamp: Date.now() };
    const targets = userToSockets.get(to);
    if (targets) targets.forEach(sid => io.to(sid).emit("private_message", msg));
    socket.emit("private_message", msg);
  });

  socket.on("chatMessage", (text) => {
    const from = socketToUser.get(socket.id);
    if (!from || !text?.trim()) return;
    const msg = { from, text, timestamp: Date.now() };
    io.emit("chatMessage", msg);
  });

  socket.on("joinRoom", (roomName) => { try { socket.join(roomName); } catch(e) {} });
  socket.on("leaveRoom", (roomName) => { try { socket.leave(roomName); } catch(e) {} });
  socket.on("sendMessage", ({ roomName, message, user, ts }) => {
    if (!roomName) return;
    io.to(roomName).emit("receiveMessage", { user, message, ts });
  });

  socket.on("auth:hello", ({ address }) => {
    try {
      const addr = String(address || "").toLowerCase().trim();
      if (!addr) return;
      socket.data.address = addr;
      socket.join(`user:${addr}`);
    } catch {}
  });

  socket.on("friends:send", ({ to }, cb) => {
    const from = socket.data.address;
    if (!from || !to) return cb && cb({ ok: false, error: "bad-addr" });
    supabase.from("friends").insert({ user1: from, user2: to, status: "pending" }).then(() => {
      io.to(`user:${to}`).emit("friends:incoming", { from });
      cb && cb({ ok: true });
    });
  });

  socket.on("friends:respond", ({ from, accept }, cb) => {
    const to = socket.data.address;
    if (!to || !from) return cb && cb({ ok: false, error: "bad-addr" });
    if (accept) {
      supabase.from("friends").update({ status: "accepted" })
        .eq("user1", from).eq("user2", to).then(() => {
          cb && cb({ ok: true });
        });
    } else {
      supabase.from("friends").delete()
        .eq("user1", from).eq("user2", to).then(() => {
          cb && cb({ ok: true });
        });
    }
  });

  socket.on("messages:read", ({ viewer, withUser }) => {
    if (!viewer || !withUser) return;
    const targets = userToSockets.get(withUser);
    if (targets) targets.forEach(sid => io.to(sid).emit("messages:seen", { by: viewer }));
  });

  // ── WebRTC Signaling ──
  socket.on("webrtc:offer", ({ to, offer, mode, from }) => {
    const targets = userToSockets.get(to);
    if (targets) targets.forEach(sid => io.to(sid).emit("webrtc:offer", { offer, mode, from }));
  });

  socket.on("webrtc:answer", ({ to, answer }) => {
    const targets = userToSockets.get(to);
    if (targets) targets.forEach(sid => io.to(sid).emit("webrtc:answer", { answer }));
  });

  socket.on("webrtc:ice", ({ to, candidate }) => {
    const targets = userToSockets.get(to);
    if (targets) targets.forEach(sid => io.to(sid).emit("webrtc:ice", { candidate }));
  });

  socket.on("webrtc:call-end", ({ to }) => {
    const targets = userToSockets.get(to);
    if (targets) targets.forEach(sid => io.to(sid).emit("webrtc:call-end"));
  });

  socket.on("disconnect", () => {
    const user = socketToUser.get(socket.id);
    if (user) {
      socketToUser.delete(socket.id);
      const set = userToSockets.get(user);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userToSockets.delete(user);
      }
      broadcastOnlineUsers();
    }
  });
});

// ------------------- START -------------------
server.listen(PORT, () => {
  console.log(`🔥 API + Socket.IO running on http://localhost:${PORT}`);
});
