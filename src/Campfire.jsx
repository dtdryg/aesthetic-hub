import React, { useEffect, useRef, useState } from 'react';
import './campfire.css';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';

const API = 'http://localhost:4000';

export default function Campfire() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // ---------- Screen flow ----------
  const [step, setStep] = useState('choose'); // start directly at choose

  // ---------- Info toggles ----------
  const [showStakingInfo, setShowStakingInfo] = useState(false);
  const [showNetworkInfo, setShowNetworkInfo] = useState(false);

  // ---------- Fullscreen ----------
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---------- Mining state ----------
  const [mineActive, setMineActive] = useState(false);
  const [minedBlocks, setMinedBlocks] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [challenge, setChallenge] = useState('');
  const [ttl, setTtl] = useState(0);
  const chalExpiry = useRef(0);
  const mining = useRef(false);

  // ---------- Wallet balances ----------
  const [balance, setBalance] = useState(0);
  const [staked, setStaked] = useState(0);
  const balTimer = useRef(null);

  // ---------- PoS ----------
  const posLoop = useRef(null);
  const [posRunning, setPosRunning] = useState(false);

  // ---------- Helpers ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const fetchJSON = async (url, opts) => (await fetch(url, opts)).json();

  // ---------- Login ----------
  useEffect(() => {
    if (!isConnected) return;
    (async () => {
      try {
        const signature = await signMessageAsync({
          message: 'Sign this message to verify your identity for Aesthetic Hub.'
        });
        await fetch(`${API}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, signature })
        });

        await fetchBalance();
        startBalanceAutoRefresh();
      } catch (e) {
        console.error('Wallet login failed', e);
      }
    })();
    return stopBalanceAutoRefresh;
  }, [isConnected]);

  // ---------- Balance ----------
  const fetchBalance = async () => {
    if (!address) return;
    try {
      const data = await fetchJSON(`${API}/balance/${address}`);
      setBalance(data.balance ?? 0);
      setStaked(data.staked ?? 0);
    } catch (e) {
      console.error('balance error', e);
    }
  };

  const startBalanceAutoRefresh = () => {
    stopBalanceAutoRefresh();
    balTimer.current = setInterval(fetchBalance, 5000);
  };
  const stopBalanceAutoRefresh = () => {
    if (balTimer.current) clearInterval(balTimer.current);
    balTimer.current = null;
  };

  // ---------- PoS staking ----------
  const stakeAmount = async (amount) => {
    if (!address) return;
    try {
      await fetch(`${API}/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, amount })
      });
      await fetchBalance();
    } catch (e) {
      console.error('stake error', e);
    }
  };

  const unstakeAll = async () => {
    if (!address) return;
    try {
      await fetch(`${API}/unstake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address })
      });
      await fetchBalance();
    } catch (e) {
      console.error('unstake error', e);
    }
  };

  const startPOS = () => {
    if (posLoop.current) return;
    setPosRunning(true);
    posLoop.current = setInterval(async () => {
      try {
        await fetch(`${API}/mine_pos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: address })
        });
        fetchBalance();
      } catch {
        // ignore 429s
      }
    }, 60000);
  };

  const stopPOS = () => {
    setPosRunning(false);
    if (posLoop.current) clearInterval(posLoop.current);
    posLoop.current = null;
  };

  useEffect(() => () => stopPOS(), []);

  // ---------- Get mining challenge ----------
  const fetchChallenge = async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API}/mine_pow_challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address })
      });
      if (!res.ok) return;
      const data = await res.json();
      setChallenge(data.challenge);
      setDifficulty(data.difficulty);
      setTtl(data.ttl);
      chalExpiry.current = Date.now() + data.ttl * 1000;
    } catch (e) {
      console.error('challenge error', e);
    }
  };

  // ---------- Fetch challenge on mining entry ----------
  useEffect(() => {
    if (isConnected && step === 'mine' && mineActive) fetchChallenge();
  }, [isConnected, step, mineActive]);

  // ---------- PoW mining loop ----------
  useEffect(() => {
    if (!isConnected || step !== 'mine' || !mineActive || mining.current) return;
    mining.current = true;

    const mine = async () => {
      while (mining.current && mineActive && step === 'mine') {
        if (!challenge || Date.now() > chalExpiry.current) {
          await fetchChallenge();
          await sleep(100);
          continue;
        }

        const nonce = Math.random().toString(36).slice(2);
        const enc = new TextEncoder().encode(challenge + nonce);
        const digest = await crypto.subtle.digest('SHA-256', enc);
        const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex.startsWith('0'.repeat(difficulty))) {
          try {
            const res = await fetch(`${API}/mine_pow`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json',
              },
              body: JSON.stringify({ wallet: address, nonce })
            });
            if (res.ok) {
              setMinedBlocks(prev => prev + 1);
              fetchBalance();
            }
            await fetchChallenge();
          } catch {
            await sleep(300);
          }
        } else {
          await sleep(1);
        }
      }
    };

    mine();
    return () => { mining.current = false; };
  }, [isConnected, step, mineActive, challenge, difficulty]);

  // ---------- Fullscreen ----------
  const enterFullscreen = () => {
    setIsFullscreen(true);
    const elem = document.getElementById('campfire-container');
    if (elem?.requestFullscreen) elem.requestFullscreen();
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    if (document.exitFullscreen) document.exitFullscreen();
  };

  // ---------- UI ----------
  return (
   <div id="campfire-container" className={`campfire-wrapper ${isFullscreen ? 'fullscreen' : ''}`}>
  {/* Fullscreen Background Video */}
  <video autoPlay loop muted playsInline className="campfire-bg-video">
    <source src="/assets/campfire-bg.mp4" type="video/mp4" />
  </video>
      

      {/* Overlay UI */}
      <div className="campfire-overlay">
        <h1 className="campfire-title-plain">🔥 The Campfire Room</h1>

        {/* CHOOSE SCREEN */}
        {step === 'choose' && (
          <div className="campfire-choose">
            <h2 className="choose-title">How do you want to earn $AESTH?</h2>
            <div className="choose-row">
              <button type="button" className="choose-card" onClick={() => setStep('mine')}>
                🔨 Mine $AESTH
                <span className="choose-sub">CPU-light; mobile + low-end PC friendly</span>
              </button>
              <button type="button" className="choose-card" onClick={() => setStep('stake')}>
                🪙 Stake $AESTH
                <span className="choose-sub">Lock tokens to earn yield (APR)</span>
              </button>
            </div>
          </div>
        )}

        {/* MINING SCREEN */}
        {step === 'mine' && (
          <>
            {!isConnected ? (
              <div className="pre-screen">
                <h2>Connect Wallet to Start Mining</h2>
                <ConnectButton />
                <button className="back-link" onClick={() => setStep('choose')}>← Back</button>
              </div>
            ) : (
              <>
                {!isFullscreen && (
                  <div className="pre-screen">
                    <p>🔥 {address}</p>
                    <p>
                      Balance: <strong>{balance?.toFixed?.(6) ?? 0}</strong> $AESTH • Staked:{' '}
                      <strong>{staked?.toFixed?.(6) ?? 0}</strong> $AESTH
                    </p>
                    <p>Mined blocks (this session): <strong>{minedBlocks}</strong></p>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {!mineActive && <button onClick={() => setMineActive(true)}>Start Mining</button>}
                      {mineActive && <button onClick={() => setMineActive(false)}>Stop Mining</button>}
                      <button onClick={enterFullscreen}>Enter Fullscreen</button>
                    </div>
                  </div>
                )}

                {isFullscreen && (
                  <button
                    onClick={exitFullscreen}
                    style={{
                      position: 'absolute', top: '20px', right: '20px',
                      padding: '10px', background: '#222', color: '#fff',
                      border: '1px solid #fff', borderRadius: '5px',
                      cursor: 'pointer', zIndex: 10000
                    }}
                  >
                    Exit Fullscreen
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* STAKING SCREEN */}
        {step === 'stake' && (
          <div className="stake-screen">
            <h2 className="choose-title">Stake your $AESTH</h2>
            {!isConnected ? (
              <div className="pre-screen">
                <h3>Connect Wallet</h3>
                <ConnectButton />
              </div>
            ) : (
              <>
                <p className="stake-note">
                  Choose an amount and stake. You’ll earn yield over time. Unstake anytime (subject to rules).
                </p>
                <div className="stake-grid">
                  <div className="stake-card">
                    <div className="label">Quick Stake</div>
                    <div className="stake-row">
                      <button className="stake-btn" onClick={() => stakeAmount(1)}>Stake 1</button>
                      <button className="stake-btn" onClick={() => stakeAmount(5)}>Stake 5</button>
                      <button className="stake-btn" onClick={() => stakeAmount(10)}>Stake 10</button>
                    </div>
                    <div className="stake-row" style={{ marginTop: 10 }}>
                      <button className="stake-btn ghost" onClick={unstakeAll}>Unstake All</button>
                    </div>
                  </div>
                  <div className="stake-card">
                    <div className="label">Your Stats</div>
                    <div className="kv"><span>Balance</span><b>{balance.toFixed(6)} $AESTH</b></div>
                    <div className="kv"><span>Staked</span><b>{staked.toFixed(6)} $AESTH</b></div>
                    <div className="kv"><span>APR</span><b>Server-defined</b></div>
                  </div>
                </div>
              </>
            )}
            <div className="footer-actions">
              <button className="back-link" onClick={() => setStep('choose')}>← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
