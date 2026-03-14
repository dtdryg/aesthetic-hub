import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { polygonMumbai } from 'wagmi/chains';
import { useState } from 'react';
import { ethers } from 'ethers';

const config = getDefaultConfig({
  appName: 'My Web3 App',
  chains: [polygonMumbai],
  projectId: 'aesthetic-hub', // We’ll fix this in a second
});

const queryClient = new QueryClient();

export const Web3Provider = ({ children }) => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>{children}</RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default function Web3Connect({ setLoggedInUser }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        return alert("MetaMask not found.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const message = "Sign this message to verify your identity for Aesthetic Hub.";

      const signature = await signer.signMessage(message);

      // Save to backend
      const response = await fetch("https://aesthetic-hub-production.up.railway.app/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature })
      });

      if (response.ok) {
        setWalletAddress(address);
        setLoggedInUser(address);
        setIsConnected(true);
      } else {
        alert("Backend rejected login.");
      }

    } catch (err) {
      console.error(err);
      alert("Failed to connect wallet.");
    }
  }

  return (
    <div>
      {isConnected ? (
        <p>Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
    </div>
  );
}