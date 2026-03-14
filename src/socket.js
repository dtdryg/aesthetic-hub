// src/socket.js
import { io } from "socket.io-client";

// Use WS transport to avoid long-poll fallbacks
const socket = io("https://aesthetic-hub-production.up.railway.app", {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: false, // we connect after login
});

export default socket;
