// src/socket.js
import { io } from "socket.io-client";

// Use WS transport to avoid long-poll fallbacks
const socket = io("http://localhost:4000", {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: false, // we connect after login
});

export default socket;
