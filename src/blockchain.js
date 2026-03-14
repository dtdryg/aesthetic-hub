import axios from "axios";

const API = "http://127.0.0.1:4000";

// Get balance
export async function getBalance(wallet) {
  const res = await axios.get(`${API}/balance/${wallet}`);
  return res.data;
}

// Mint coins
export async function mint(wallet, amount) {
  const res = await axios.post(`${API}/mint`, { wallet, amount });
  return res.data;
}

// Transfer coins
export async function transfer(from, to, amount) {
  const res = await axios.post(`${API}/transfer`, { from, to, amount });
  return res.data;
}

// Stake coins
export async function stake(wallet, amount) {
  const res = await axios.post(`${API}/stake`, { wallet, amount });
  return res.data;
}

// Claim POS reward
export async function minePos(wallet) {
  const res = await axios.post(`${API}/mine_pos`, { wallet });
  return res.data;
}
export function swap() {
    console.warn("swap() is NOT implemented yet.");
    return "ok";
}


