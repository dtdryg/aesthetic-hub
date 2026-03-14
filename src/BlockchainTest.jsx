import React, { useState } from "react";
import { getBalance, mint, transfer, stake, minePos } from "./blockchain";


export default function BlockchainTest() {
  const [wallet, setWallet] = useState("karim");
  const [target, setTarget] = useState("ayaaz");
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState(0);
  const [log, setLog] = useState("");

  async function handleBalance() {
    const res = await getBalance(wallet);
    setBalance(res);
    setLog(JSON.stringify(res, null, 2));
  }

  async function handleMint() {
    const res = await mint(wallet, parseFloat(amount));
    setLog(JSON.stringify(res, null, 2));
  }

  async function handleTransfer() {
    const res = await transfer(wallet, target, parseFloat(amount));
    setLog(JSON.stringify(res, null, 2));
  }

  async function handleStake() {
    const res = await stake(wallet, parseFloat(amount));
    setLog(JSON.stringify(res, null, 2));
  }

  async function handleMinePos() {
    const res = await minePos(wallet);
    setLog(JSON.stringify(res, null, 2));
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Blockchain Test</h1>

      <input
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
        placeholder="Your wallet"
      />
      <input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Target wallet"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
      />

      <div>
        <button onClick={handleBalance}>Get Balance</button>
        <button onClick={handleMint}>Mint</button>
        <button onClick={handleTransfer}>Transfer</button>
        <button onClick={handleStake}>Stake</button>
        <button onClick={handleMinePos}>Mine POS</button>
      </div>

      <pre>{log}</pre>
      {balance && <h2>Balance: {balance.balance}</h2>}
    </div>
  );
}
