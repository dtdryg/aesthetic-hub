import React, { useState, useEffect, useRef, useCallback } from "react"; 
import { swap, getBalance } from "../blockchain.js";



// Note: These are placeholder imports not fully used in the App component logic

// --- Core Utility Functions ---

/**
 * ⭐ STEP 1 - Add a Preview Endpoint (Frontend-only mock FOR NOW)
 * Computes a mock estimated output for the swap.
 * This function will be called directly in the JSX.
 * @param {string} amount - The input amount as a string.
 * @param {object} token - The selected token object with an exchangeRate.
 * @returns {number} The estimated output amount.
 */
function getPreview(amount, token) {
    const amountIn = parseFloat(amount);
    if (!token || !amountIn || isNaN(amountIn) || amountIn <= 0) return 0;

    // TEMP simple preview: Input amount / exchange rate
    // Replace this with a real AMM calculation later.
    return (amountIn / token.exchangeRate).toFixed(6);
}

// --- CORE CONFIGURATION (UPDATE WITH YOUR LIVE ADDRESSES) ---
const DEX_ADDRESS = "0x07979F6b3e291abbB11C1987B20e7563f8500605"; // Your DEX Contract
const TOKEN_IN_ADDRESS = "0x1003c1c6CdE8f14f99280a79c22975A06063B5C2"; // Your standard Input Token (e.g., AHUB Token)
const INPUT_TOKEN_SYMBOL = "AHUB"; // Defined for clarity in the UI

// ⭐ STEP 3 - Add Token Icons (Implemented via existing DEX_TOKENS structure)
const MOCK_TOKEN_OUT_ADDRESSES = {
    ADA: "0x1234567890123456789012345678901234567ADA", // Mock ADA Address
    XRP: "0x1234567890123456789012345678901234567XRP", // Mock XRP Address
    DOT: "0x1234567890123456789012345678901234567DOT", // Mock DOT Address
};

// Available Tokens for the DEX Gateway
const DEX_TOKENS = [
    { 
        symbol: 'ADA', 
        name: 'Cardano', 
        tokenOutAddress: MOCK_TOKEN_OUT_ADDRESSES.ADA, 
        mockInventory: 250000.75, // Mock data for display
        exchangeRate: 10, // 10 AHUB for 1 ADA
        icon: '₳',
        color: '#00D1FF' // Cyan
    },
    { 
        symbol: 'XRP', 
        name: 'Ripple', 
        tokenOutAddress: MOCK_TOKEN_OUT_ADDRESSES.XRP, 
        mockInventory: 800000.33, 
        exchangeRate: 5, // 5 AHUB for 1 XRP
        icon: ' XRP',
        color: '#34A083' // Green
    },
    { 
        symbol: 'DOT', 
        name: 'Polkadot', 
        tokenOutAddress: MOCK_TOKEN_OUT_ADDRESSES.DOT, 
        mockInventory: 150000.91, 
        exchangeRate: 20, // 20 AHUB for 1 DOT
        icon: '●',
        color: '#E6007A' // Magenta
    },
    // We can add the example tokens from the instructions here to match
    {
        symbol: 'USDC',
        name: 'USD Coin',
        tokenOutAddress: '0xMockUSDCAddress',
        mockInventory: 1000000,
        exchangeRate: 1, // 1 AHUB for 1 USDC
        icon: '🟦',
        color: '#2775CA'
    },
    {
        symbol: 'USDT',
        name: 'Tether',
        tokenOutAddress: '0xMockUSDTAddress',
        mockInventory: 1000000,
        exchangeRate: 1.01, // 1.01 AHUB for 1 USDT
        icon: '₮',
        color: '#50af95'
    }
];

// Placeholder ABI structures based on usage in the component
const dexAbi = [
    "function swapExactIn(uint256 amountIn) external",
    "function previewOut(uint256 amountIn) public view returns (uint256)",
];

const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint255)",
];

// Main App Component
export default function App() {
    const [account, setAccount] = useState("");
    const [amountIn, setAmountIn] = useState("1");
    const [status, setStatus] = useState("Loading Web3 libraries...");
    const [decimals, setDecimals] = useState(6);
    const [isConnected, setIsConnected] = useState(false);
    const [isEthersLoaded, setIsEthersLoaded] = useState(false); 
    const [isThreeLoaded, setIsThreeLoaded] = useState(false);
    
    const [selectedToken, setSelectedToken] = useState(null); // The token object selected by the user
    // NOTE: For the token swap logic from the original prompt (Step 4), we need two tokens.
    // However, the existing modal design only supports AHUB -> selectedToken.
    // For now, we will add state variables to enable the swap direction button logic (Step 4), 
    // even if the rest of the component is built for a single direction.
    // We'll default to AHUB as IN, but allow the user to 'switch' the display, which will primarily affect the UI.

    // State for the bidirectional swap UI (to fully implement Step 4)
    const [tokenInSymbol, setTokenInSymbol] = useState(INPUT_TOKEN_SYMBOL);
    const [tokenOutSymbol, setTokenOutSymbol] = useState(DEX_TOKENS[0].symbol); // Default to first in list

    const [tokenInBalance, setTokenInBalance] = useState("0"); // User's balance of the input token
    const [dexInventory, setDexInventory] = useState("0"); // DEX inventory of the output token
    
    const [currentStep, setCurrentStep] = useState(0); // 0: Connect, 1: Preview, 2: Approve, 3: Swap
    
    const threeContainerRef = useRef(null); // Ref for the Three.js container
    
    // Access the globally loaded libraries
    const Ethers = window.ethers; 
    const THREE = window.THREE;
    
    // NEW: Ref to store the individual 3D particle objects
    const particleMeshesRef = useRef([]);

    // --- Core Utility Functions (Web3) ---

    // Fetch user balance for the input token and mock the DEX inventory
    const fetchBalances = useCallback(async (token) => {
        if (!Ethers || !account || !token) return;

        // NOTE: This logic assumes AHUB is the only input token for the actual contract calls.
        // The implementation of a true bidirectional swap using Ethers.js here would require 
        // a more complex contract structure and a dynamic TOKEN_IN_ADDRESS/erc20Abi contract.
        // We will keep the contract call fixed to the AHUB (TOKEN_IN_ADDRESS).

        try {
            const provider = new Ethers.BrowserProvider(window.ethereum);
            
            // 1. Get Input Token Balance (always AHUB based on current setup)
            const tokenInContract = new Ethers.Contract(TOKEN_IN_ADDRESS, erc20Abi, provider);
            const rawBalance = await tokenInContract.balanceOf(account);
            
            setTokenInBalance(Ethers.formatUnits(rawBalance, decimals));
            
            // 2. Mock DEX Inventory (used for the currently selected output token)
            setDexInventory(token.mockInventory.toFixed(2));

        } catch (err) {
            console.error("Failed to fetch balances:", err);
            setTokenInBalance("ERROR");
            setDexInventory("ERROR");
        }
    }, [Ethers, account, decimals]);

    // Update connection state and fetch decimals
    const updateConnectionState = async (accounts) => {
        if (!Ethers || accounts.length === 0) return;

        try {
            const provider = new Ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const token = new Ethers.Contract(TOKEN_IN_ADDRESS, erc20Abi, signer);
            
            try {
                const d = await token.decimals();
                setDecimals(Number(d));
            } catch (e) {
                console.error("Could not fetch token decimals, defaulting to 6.", e);
            }
            
            setAccount(accounts[0]);
            setIsConnected(true);
            setStatus("Wallet connected ✅");
            setCurrentStep(0);
            
            // Set the default tokenOutSymbol for the switch button state
            setTokenOutSymbol(DEX_TOKENS[0].symbol); 

        } catch (err) {
            console.error("Failed to finalize connection state:", err);
            setStatus("Connection details error ❌");
        }
    };

    const checkInitialConnection = async () => {
        if (!window.ethereum || !window.ethers) return;

        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            
            if (accounts.length > 0) {
                setStatus("Attempting automatic connection...");
                await updateConnectionState(accounts);
                setStatus("Wallet automatically connected ✅ (Existing session found)");
            } else {
                setStatus("Ready to connect wallet.");
            }
        } catch (err) {
            console.error("Initial connection check failed:", err);
            setStatus("Ready to connect wallet.");
        }
    };

    // --- Initialization and Effects (Unchanged) ---

    useEffect(() => {
        if (window.ethers) {
            setIsEthersLoaded(true);
            checkInitialConnection();
            return;
        }

        const scriptEthers = document.createElement('script');
        scriptEthers.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js";
        scriptEthers.async = true;

        const handleScriptLoad = () => {
            setIsEthersLoaded(true);
            checkInitialConnection(); 
        };

        scriptEthers.onload = handleScriptLoad;
        document.head.appendChild(scriptEthers);

        return () => {
            document.head.removeChild(scriptEthers);
            scriptEthers.onload = null;
        };
    }, []); 

    useEffect(() => {
        if (window.THREE) {
            setIsThreeLoaded(true);
            return;
        }

        const scriptThree = document.createElement('script');
        scriptThree.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
        scriptThree.async = true;

        scriptThree.onload = () => setIsThreeLoaded(true);
        document.head.appendChild(scriptThree);

        return () => {
            document.head.removeChild(scriptThree);
            scriptThree.onload = null;
        };
    }, []); 

    useEffect(() => {
        if (window.ethereum) {
            const handleAccountsChanged = (accounts) => {
                if (accounts.length === 0) {
                    setAccount("");
                    setIsConnected(false);
                    setCurrentStep(0);
                    setStatus("Wallet disconnected. Ready to connect wallet.");
                } else if (accounts[0] !== account) {
                    updateConnectionState(accounts);
                }
            };
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            };
        }
    }, [account]); 

    useEffect(() => {
        if (isConnected && selectedToken) {
            fetchBalances(selectedToken);
            // Also ensure the UI reflects the AHUB -> selectedToken flow initially
            setTokenInSymbol(INPUT_TOKEN_SYMBOL); 
            setTokenOutSymbol(selectedToken.symbol);
        }
    }, [isConnected, selectedToken, fetchBalances]);

    // 5. Three.js Scene Setup (Unchanged)
    useEffect(() => {
        if (!isThreeLoaded || !threeContainerRef.current || !THREE) return;

        let scene, camera, renderer, lines;
        let width = threeContainerRef.current.clientWidth;
        let height = threeContainerRef.current.clientHeight;
        let frameId; 
        const NUM_POINTS = 2500; 
        const CONNECT_DISTANCE = 2.5; 
        const MAX_LINES = NUM_POINTS * 5; 
        
        // --- Line Setup (Kept for constellation effect) ---
        const linePositions = new Float32Array(MAX_LINES * 2 * 3);
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));

        // --- Data Arrays (for particle movement and line connection) ---
        const positions = new Float32Array(NUM_POINTS * 3);
        const originalPositions = new Float32Array(NUM_POINTS * 3); 

        const NEON_CYAN = 0x78dce8; 
        const lineColor = NEON_CYAN; 
        
        // NEW: Store positions and particle mesh objects outside the render loop
        const particleMeshes = [];
        particleMeshesRef.current = particleMeshes;

        // NEW: Specific shape for particles
        const particleGeometry = new THREE.TetrahedronGeometry(0.08); // Small 3D Tetrahedron
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: NEON_CYAN,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            wireframe: false // Solid/filled small particle
        });

        const init = () => {
            scene = new THREE.Scene();

            camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
            camera.position.z = 15; 
            camera.position.y = 5;

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setClearColor(0x000000, 0); 
            
            if (threeContainerRef.current.children.length === 0) {
                threeContainerRef.current.appendChild(renderer.domElement);
            } else {
                threeContainerRef.current.removeChild(threeContainerRef.current.firstChild);
                threeContainerRef.current.appendChild(renderer.domElement);
            }

            // 1. Create 3D particles (Tetrahedrons)
            for (let i = 0; i < NUM_POINTS; i++) {
                const x = (Math.random() - 0.5) * 50; 
                const y = (Math.random() - 0.5) * 50;
                const z = (Math.random() - 0.5) * 50;
                
                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;
                
                originalPositions[i * 3 + 1] = y; 
                
                const mesh = new THREE.Mesh(particleGeometry, particleMaterial);
                mesh.position.set(x, y, z);
                
                particleMeshes.push(mesh);
                scene.add(mesh);
            }

            // 2. Add connecting lines container (LineSegments)
            const lineMaterial = new THREE.LineBasicMaterial({
                color: lineColor,
                linewidth: 1, 
                transparent: true,
                opacity: 0.15, 
                blending: THREE.AdditiveBlending,
            });

            lines = new THREE.LineSegments(lineGeometry, lineMaterial);
            scene.add(lines);

            scene.add(new THREE.AmbientLight(0x404040));
            
            const pointLight = new THREE.PointLight(NEON_CYAN, 50, 50);
            pointLight.position.set(0, 5, 5);
            scene.add(pointLight);
        };

        const animate = () => {
            const time = performance.now() * 0.001;
            let lineCount = 0;
            
            const linePositionsArray = lineGeometry.attributes.position.array;
            
            for (let i = 0; i < NUM_POINTS; i++) {
                const i3 = i * 3;
                
                // 1. Calculate new Y position for the particle data array
                positions[i3 + 1] = originalPositions[i3 + 1] + 
                    Math.sin(positions[i3] * 0.5 + time * 0.5) * 0.5 + 
                    Math.cos(positions[i3 + 2] * 0.5 + time * 0.5) * 0.5;

                // 2. Update the actual 3D mesh position
                if (particleMeshes[i]) {
                    particleMeshes[i].position.set(
                        positions[i3],
                        positions[i3 + 1],
                        positions[i3 + 2]
                    );
                    // NEW: Add subtle rotation to the 3D particle itself
                    particleMeshes[i].rotation.y += 0.01;
                }

                // 3. Check distance and draw connection lines
                for (let j = i + 1; j < NUM_POINTS; j++) {
                    const j3 = j * 3;
                    
                    const dx = positions[i3] - positions[j3];
                    const dy = positions[i3 + 1] - positions[j3 + 1];
                    const dz = positions[i3 + 2] - positions[j3 + 2];
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < CONNECT_DISTANCE * CONNECT_DISTANCE && lineCount < MAX_LINES) {
                        const lineIndex = lineCount * 6;
                        
                        linePositionsArray[lineIndex] = positions[i3];
                        linePositionsArray[lineIndex + 1] = positions[i3 + 1];
                        linePositionsArray[lineIndex + 2] = positions[i3 + 2];
                        
                        linePositionsArray[lineIndex + 3] = positions[j3];
                        linePositionsArray[lineIndex + 4] = positions[j3 + 1];
                        linePositionsArray[lineIndex + 5] = positions[j3 + 2];
                        
                        lineCount++;
                    }
                }
            }

            // Note: pointGeometry.attributes.position.needsUpdate is no longer needed since we use meshes

            lineGeometry.setDrawRange(0, lineCount * 2); 
            lineGeometry.attributes.position.needsUpdate = true;
            
            camera.position.x = Math.sin(time * 0.05) * 10;
            camera.position.z = 15 + Math.cos(time * 0.05) * 5;
            camera.lookAt(scene.position);

            renderer.render(scene, camera);
            frameId = requestAnimationFrame(animate);
        };

        const onWindowResize = () => {
            width = threeContainerRef.current.clientWidth;
            height = threeContainerRef.current.clientHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };

        init();
        animate();
        window.addEventListener('resize', onWindowResize);

        return () => {
            window.removeEventListener('resize', onWindowResize);
            cancelAnimationFrame(frameId); 
            
            // Clean up old elements
            particleMeshesRef.current.forEach(mesh => {
                if (mesh) {
                    scene.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) mesh.material.dispose();
                }
            });

            if (lines) {
                scene.remove(lines);
                if (lines.geometry) lines.geometry.dispose();
                if (lines.material) lines.material.dispose();
            }

            renderer.dispose();
        };

    }, [isThreeLoaded, THREE]); 

    // --- Transaction Functions (MODIFIED for Step 5: Validation) ---

    async function connect() {
        if (!window.ethereum) return setStatus("Wallet not found. Please install a Web3 wallet (e.g., MetaMask).");
        if (!Ethers) return setStatus("Web3 library still loading. Please wait a moment and try again.");

        try {
            const provider = new Ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            await updateConnectionState(accounts);
            setStatus("Wallet connected ✅ (Make sure MetaMask is on Sepolia)");
        } catch (err) {
            console.error("Connection failed:", err);
            setStatus("Wallet connection failed ❌");
        }
    }

    async function approve() {
        if (!selectedToken) return setStatus("Error: No token selected.");
        if (currentStep < 1) return setStatus("Please Preview the swap first.");
        if (!isConnected || !Ethers) return setStatus("Please connect your wallet first.");

        // ⭐ STEP 5 - Add Basic Validation (Part 1: Amount Check)
        const amount = parseFloat(amountIn);
        const balance = parseFloat(tokenInBalance);

        if (!amount || amount <= 0) {
            setStatus("Enter a valid amount");
            return;
        }

        if (amount > balance) {
            setStatus("Insufficient Balance");
            return;
        }

        // NOTE: The tokenIn === tokenOut check is handled by only offering tokens different from AHUB in the grid.
        
        try {
            setStatus(`Approving ${selectedToken.symbol} transaction...`);
            const provider = new Ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const token = new Ethers.Contract(TOKEN_IN_ADDRESS, erc20Abi, signer);

            const parsed = Ethers.parseUnits(amountIn, decimals);
            const tx = await token.approve(DEX_ADDRESS, parsed);
            
            setStatus("Waiting for approval confirmation...");
            await tx.wait();
            setCurrentStep(2);
            setStatus("Approved ✅ Ready for Step 2. Swap!");
        } catch (err) {
            console.error(err);
            setStatus("Approve failed ❌. Check console for details.");
        }
    }

    async function swap() {
        if (!selectedToken) return setStatus("Error: No token selected.");
        if (currentStep < 2) return setStatus("Please complete Step 1 (Approve) first.");
        if (!isConnected || !Ethers) return setStatus("Please connect your wallet first.");

        // ⭐ STEP 5 - Add Basic Validation (Part 2: Amount/Balance Check)
        const amount = parseFloat(amountIn);
        const balance = parseFloat(tokenInBalance);

        if (!amount || amount <= 0) {
            setStatus("Enter a valid amount");
            return;
        }

        if (amount > balance) {
            setStatus("Insufficient Balance");
            return;
        }
        
        try {
            setStatus(`Executing swap for ${selectedToken.symbol}...`);
            const provider = new Ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const dex = new Ethers.Contract(DEX_ADDRESS, dexAbi, signer);

            const parsed = Ethers.parseUnits(amountIn, decimals);
            const tx = await dex.swapExactIn(parsed);
            
            setStatus("Waiting for swap confirmation...");
            await tx.wait();
            setCurrentStep(3);
            setStatus(`Swap done ✅ Successfully exchanged for ${selectedToken.symbol}!`);
            fetchBalances(selectedToken); // Update balances after successful swap
        } catch (err) {
            console.error(err);
            setStatus("Swap failed ❌ (Not approved? Low inventory? Wrong network?)");
        }
    }

    async function preview() {
        if (!selectedToken) return setStatus("Error: No token selected.");
        if (!isConnected || !Ethers) return setStatus("Please connect your wallet first.");
        
        // ⭐ STEP 5 - Add Basic Validation (Part 3: Amount Check)
        if (isNaN(parseFloat(amountIn)) || parseFloat(amountIn) <= 0) return setStatus("Enter a valid amount.");
        
        try {
            setStatus("Calculating preview...");
            
            // NOTE: Using the mock calculation, a real contract call would be here.
            // This is equivalent to the original `getPreview`'s purpose.
            const humanReadableOut = getPreview(amountIn, selectedToken); 
            
            setCurrentStep(1);
            setStatus(`If you swap ${amountIn} ${tokenInSymbol}, you'll get: ${humanReadableOut} ${tokenOutSymbol} (Estimate)`);
        } catch (err) {
            console.error(err);
            setStatus("Preview failed (Contract not deployed or calculation error)");
        }
    }
    
    // Helper to determine the glow class
    const getButtonGlowClass = (stepRequired) => {
        if (!isConnected) return 'glow-disabled'; 
        if (currentStep >= stepRequired) {
            return 'glow-active'; 
        }
        return 'glow-inactive';
    };

    // Helper to determine disabled state
    const isActionDisabled = (stepRequired) => {
        if (stepRequired === 1 && currentStep >= 1) return true; // Preview should be re-enabled if input changes
        if (stepRequired === 2 && currentStep < 1) return true;
        if (stepRequired === 3 && currentStep < 2) return true;
        return !isConnected;
    };

    // ⭐ STEP 4 - Add Reverse Pair Button (Swap Direction) Logic
    const handleReversePair = () => {
        // NOTE: This only swaps the UI symbols (tokenInSymbol and tokenOutSymbol) 
        // as the rest of the component is hardcoded for AHUB -> selectedToken contract interaction.
        setTokenInSymbol(tokenOutSymbol);
        setTokenOutSymbol(tokenInSymbol);
        setCurrentStep(0); // Reset steps
        // The swap function itself remains AHUB (TOKEN_IN_ADDRESS) in -> selectedToken out
    }
    
    // --- RENDER COMPONENTS (Modified) ---

    // 1. Token Selection Grid View (Unchanged)
    const TokenGrid = () => (
        <div className="token-grid-container">
            <h2 className="token-grid-title">Select Target Asset (Input: {INPUT_TOKEN_SYMBOL} Token)</h2>
            <p className="token-grid-subtitle">Your Connected Wallet: {account.slice(0, 6)}...{account.slice(-4)}</p>
            <div className="token-grid">
                {DEX_TOKENS.map((token) => (
                    <div 
                        key={token.symbol}
                        className="token-card"
                        onClick={() => {
                            setSelectedToken(token);
                            setTokenInSymbol(INPUT_TOKEN_SYMBOL);
                            setTokenOutSymbol(token.symbol);
                        }}
                        style={{'--card-color': token.color}}
                    >
                        {/* ⭐ STEP 3 - Add Token Icons (Using existing `token.icon` logic) */}
                        <div className="token-icon" style={{color: token.color}}>
                            {token.icon}
                        </div>
                        <h3 className="token-symbol">{token.symbol}</h3>
                        <p className="token-name">{token.name}</p>
                        <div className="token-info">
                            <p className="info-item">
                                **Rate:** 1 {token.symbol} / {token.exchangeRate} {INPUT_TOKEN_SYMBOL}
                            </p>
                            <p className="info-item inventory">
                                **DEX Inventory:** {token.mockInventory.toLocaleString()} {token.symbol}
                            </p>
                        </div>
                        <button className="select-btn">SWAP GATEWAY</button>
                    </div>
                ))}
            </div>
        </div>
    );

    // 2. Swap Modal View (MODIFIED for Steps 1, 2, 4)
    const SwapModal = () => {
        
        // Find the current active output token object for display logic
        const currentOutputToken = DEX_TOKENS.find(t => t.symbol === tokenOutSymbol) || selectedToken;
        const currentInputToken = tokenInSymbol === INPUT_TOKEN_SYMBOL ? 
                                    { symbol: INPUT_TOKEN_SYMBOL, color: '#9b5de5' } : 
                                    currentOutputToken; // Mock token for the reversed state

        // Estimate based on the current UI state
        let estimatedReceive = 0;
        let isReversed = tokenInSymbol !== INPUT_TOKEN_SYMBOL; // Check if user has reversed the UI
        
        if (currentOutputToken && !isReversed) {
            // Only calculate for the AHUB -> Token flow, as contract calls only support this.
            estimatedReceive = getPreview(amountIn, currentOutputToken); 
        } else if (isReversed) {
            // For reversed flow, the preview shows the theoretical reciprocal
            const amountInFloat = parseFloat(amountIn);
            if (amountInFloat > 0) {
                 estimatedReceive = (amountInFloat * currentOutputToken.exchangeRate).toFixed(6); 
            }
        }

        const balanceToDisplay = isReversed ? currentOutputToken.mockInventory.toFixed(2) : tokenInBalance;


        return (
            <div className="modal-overlay">
                <div className="neon-panel swap-modal-panel">
                    <button className="close-btn" onClick={() => setSelectedToken(null)}>
                        &times;
                    </button>
                    
                    <h2 className="modal-title" style={{color: currentOutputToken.color}}>
                        Swap {tokenInSymbol} for {tokenOutSymbol}
                    </h2>
                    <p className="exchange-info">
                        Rate: 1 {currentOutputToken.symbol} = {currentOutputToken.exchangeRate} {INPUT_TOKEN_SYMBOL}
                    </p>

                    <div className="balance-info-bar">
                        <p>Your Balance ({tokenInSymbol}): <span className="balance-value">{balanceToDisplay}</span></p>
                        <p>DEX Inventory ({tokenOutSymbol}): <span className="balance-value" style={{color: currentOutputToken.color}}>{dexInventory}</span></p>
                    </div>

                    <div className="swap-input-group">
                        <label className="input-label">Amount of {tokenInSymbol} to input: </label>
                        <input
                            value={amountIn}
                            onChange={(e) => {
                                setAmountIn(e.target.value);
                                setCurrentStep(0); // Reset steps if input changes
                            }}
                            className="dex-input"
                            placeholder="AMOUNT IN"
                            type="number"
                        />
                    </div>

                    {/* ⭐ STEP 2 - Add Swap Preview UI */}
                    <div className="preview-info" style={{ 
                        margin: "15px 0", 
                        fontSize: "1rem", 
                        opacity: 0.9, 
                        color: currentOutputToken.color,
                        fontWeight: 'bold' 
                    }}>
                        Estimated Receive: {estimatedReceive} {tokenOutSymbol}
                    </div>

                    {/* ⭐ STEP 4 - Add Reverse Pair Button ↕ */}
                    <div style={{ textAlign: "center", margin: "10px 0" }}>
                        <button
                            onClick={handleReversePair}
                            style={{
                                background: "transparent",
                                border: "1px solid #555",
                                padding: "5px 10px",
                                borderRadius: "8px",
                                color: "white",
                                cursor: "pointer",
                                fontSize: "20px",
                                transform: "rotate(90deg)",
                                transition: 'all 0.2s',
                            }}
                            title="Swap Direction"
                        >
                            ↕
                        </button>
                    </div>
                    
                    <div className="dex-actions-group">
                        <button 
                            onClick={preview}
                            className={`dex-btn action-btn preview-btn ${getButtonGlowClass(1)}`}
                            disabled={isActionDisabled(0) || isReversed} // Disable actual preview for reversed UI
                        >
                            1. Preview (Estimate)
                        </button>
                        <button 
                            onClick={approve}
                            className={`dex-btn action-btn approve-btn ${getButtonGlowClass(2)}`}
                            disabled={isActionDisabled(2) || isReversed} // Disable actual approve for reversed UI
                        >
                            2. Approve
                        </button>
                        <button 
                            onClick={swap}
                            className={`dex-btn action-btn swap-btn ${getButtonGlowClass(3)}`}
                            disabled={isActionDisabled(3) || isReversed} // Disable actual swap for reversed UI
                        >
                            3. Swap
                        </button>
                    </div>
                    
                    <p className="dex-status">
                        {status}
                    </p>
                    {isReversed && (
                        <p className="dex-warning" style={{ color: '#ff4444', marginTop: '1rem', fontSize: '0.9rem' }}>
                            NOTE: Actual contract swap is currently only supported from {INPUT_TOKEN_SYMBOL} to {currentOutputToken.symbol}. Reversed flow is for UI demonstration only.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="dex-container">
            {/* Three.js Container - Renders the 3D background */}
            <div 
                ref={threeContainerRef} 
                id="three-container" 
                className={`three-background ${selectedToken ? 'blurred' : ''}`}
            ></div>

            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Consolas:wght@400&display=swap');

                /* --- Full Screen Container --- */
                .dex-container {
                    background: #000;
                    color: #fff;
                    padding: 4rem 1rem;
                    height: 100vh;
                    width: 100vw;
                    text-align: center;
                    font-family: 'Orbitron', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    position: relative;
                    overflow: hidden;
                    margin: 0;
                }
                
                /* --- Three.js Background Layer --- */
                .three-background {
                    position: fixed; /* Fixed to cover the viewport */
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 1;
                    pointer-events: none;
                    overflow: hidden;
                    transition: filter 0.5s ease;
                }
                
                /* Blur effect when modal is active */
                .three-background.blurred {
                    filter: blur(5px);
                }

                .dex-title {
                    z-index: 50;
                    font-size: clamp(2.2rem, 5vw, 3rem);
                    color: #d59aff;
                    text-shadow: 0 0 25px rgba(213, 154, 255, 0.7);
                    letter-spacing: 5px;
                    margin-bottom: 2.5rem;
                    text-transform: uppercase;
                }
                
                /* --- MODAL OVERLAY --- */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7); /* Dark semi-transparent layer over blur */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    backdrop-filter: blur(8px); /* Blur the overlay itself for extra effect */
                }

                /* --- NEON PANEL CONTAINER (Used for the Modal) --- */
                .neon-panel {
                    z-index: 10;
                    width: 95%;
                    max-width: 550px;
                    padding: 2.5rem 2rem;
                    margin-top: 1rem;
                    background: rgba(10, 0, 30, 0.95); /* Nearly opaque in modal */
                    border: 2px solid #9b5de5; 
                    border-radius: 16px;
                    box-shadow: 
                        0 0 40px rgba(155, 93, 229, 0.6), 
                        inset 0 0 15px rgba(160, 240, 255, 0.12); 
                    transition: all 0.5s ease;
                    position: relative;
                }

                .modal-title {
                    font-size: 1.8rem;
                    margin-bottom: 1rem;
                    text-shadow: 0 0 10px currentColor;
                }

                .exchange-info {
                    font-size: 0.9rem;
                    color: #ccc;
                    margin-bottom: 1.5rem;
                    font-family: 'Consolas', monospace;
                }

                .balance-info-bar {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 2rem;
                    padding: 0.8rem 0;
                    border-top: 1px dashed rgba(255, 255, 255, 0.1);
                    border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
                    font-size: 0.9rem;
                    color: #a0f0ff;
                }
                .balance-value {
                    font-weight: bold;
                    color: #fff;
                    text-shadow: 0 0 5px #fff;
                }
                
                /* --- CLOSE BUTTON --- */
                .close-btn {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    color: #ff6ec7;
                    font-size: 2rem;
                    cursor: pointer;
                    line-height: 1;
                    padding: 5px;
                    transition: transform 0.2s;
                    text-shadow: 0 0 10px #ff6ec7;
                }
                .close-btn:hover {
                    transform: scale(1.2);
                    filter: brightness(1.5);
                }

                /* --- INPUT & STATUS (Modal specific) --- */
                .dex-input {
                    width: 100%; 
                    padding: 1.2rem;
                    border-radius: 10px;
                    border: 1px solid rgba(213, 154, 255, 0.6);
                    background: rgba(15, 15, 25, 0.9);
                    color: #d8c3ff;
                    font-family: 'Consolas', monospace;
                    font-weight: 600;
                    font-size: 1.2rem;
                    text-align: center;
                    letter-spacing: 1px;
                    outline: none;
                    box-shadow: inset 0 0 8px rgba(213, 154, 255, 0.3);
                }
                
                .dex-status {
                    font-size: 1rem;
                    color: #ff99e6;
                    text-shadow: 0 0 10px rgba(255, 153, 230, 0.6);
                    margin-top: 1.5rem;
                }

                /* --- TOKEN GRID VIEW STYLES (Unchanged) --- */

                .token-grid-container {
                    z-index: 10;
                    width: 95%;
                    max-width: 900px;
                    background: rgba(10, 0, 30, 0.85);
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 0 50px rgba(155, 93, 229, 0.4);
                    padding: 2rem;
                    margin-top: 3rem;
                }
                
                .token-grid-title {
                    color: #a0f0ff;
                    text-shadow: 0 0 15px rgba(160, 240, 255, 0.5);
                    margin-bottom: 0.5rem;
                    font-size: 1.5rem;
                }
                
                .token-grid-subtitle {
                    color: #888;
                    font-size: 0.8rem;
                    margin-bottom: 2rem;
                }

                .token-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 2rem;
                    padding: 1rem;
                }
                
                .token-card {
                    background: rgba(15, 5, 40, 0.9);
                    border: 2px solid var(--card-color, #9b5de5);
                    border-radius: 12px;
                    padding: 1.5rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 0 20px rgba(155, 93, 229, 0.2);
                    position: relative;
                }

                .token-card:hover {
                    transform: translateY(-5px) scale(1.02);
                    box-shadow: 
                        0 0 30px rgba(213, 154, 255, 0.8), 
                        0 0 15px var(--card-color, #ff6ec7);
                }

                .token-icon {
                    font-size: 3rem;
                    line-height: 1;
                    margin-bottom: 0.5rem;
                    text-shadow: 0 0 15px currentColor;
                    filter: brightness(1.5);
                }
                
                .token-symbol {
                    font-size: 1.8rem;
                    margin: 0;
                    color: #fff;
                }
                
                .token-name {
                    font-size: 0.9rem;
                    color: #aaa;
                    margin-bottom: 1rem;
                }

                .token-info {
                    font-family: 'Consolas', monospace;
                    text-align: left;
                    border-top: 1px dashed rgba(255, 255, 255, 0.1);
                    padding-top: 1rem;
                }
                
                .info-item {
                    font-size: 0.9rem;
                    margin: 0.3rem 0;
                    color: #ccc;
                }

                .inventory {
                    color: var(--card-color, #a0f0ff);
                    text-shadow: 0 0 5px rgba(160, 240, 255, 0.3);
                }

                .select-btn {
                    margin-top: 1rem;
                    width: 100%;
                    padding: 0.75rem;
                    background: var(--card-color, #9b5de5);
                    color: #000;
                    border: none;
                    border-radius: 8px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 0 10px var(--card-color, #9b5de5);
                }
                
                .select-btn:hover {
                    background: #fff;
                    filter: brightness(1.2);
                }

                /* --- GLOWY LINKED BUTTONS STYLES (Adjusted for 3 steps) --- */
                .dex-actions-group {
                    z-index: 20;
                    display: flex;
                    justify-content: space-between;
                    margin-top: 2rem;
                    gap: 0.5rem; /* Reduced gap for 3 buttons */
                    position: relative;
                    align-items: center;
                }

                .dex-actions-group .action-btn {
                    flex: 1;
                    min-width: 0;
                    padding: 0.8rem 0.3rem; /* Adjusted padding */
                    border-radius: 8px;
                    font-size: 0.8rem; /* Adjusted font size */
                    background: #100020; 
                    border: 2px solid #5d00a0;
                    color: #a0f0ff;
                    text-shadow: none;
                    transition: all 0.3s ease;
                }
                
                .dex-btn:disabled {
                    cursor: not-allowed;
                    filter: grayscale(100%) opacity(0.5);
                }
                
                /* ACTIVE/COMPLETED GLOW */
                .glow-active {
                    color: #fff !important;
                    border: 3px solid #ff6ec7 !important; 
                    box-shadow: 
                        0 0 10px #ff6ec7, 
                        0 0 25px #9b5de5 !important; 
                    filter: brightness(1.2);
                    transform: scale(1.03);
                }
                
                /* INACTIVE/PENDING GLOW */
                .glow-inactive {
                    box-shadow: 0 0 5px rgba(160, 240, 255, 0.15); 
                    border: 2px solid rgba(213, 154, 255, 0.2);
                }
                
                /* Disabled Glow */
                .glow-disabled {
                    box-shadow: none !important;
                    filter: grayscale(100%) opacity(0.2);
                    border: 2px dashed #333;
                }

                /* The Glowing Link Line (Simplified) - HIDDEN IN MODAL */
                .dex-actions-group::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 2%; /* Adjusted width */
                    right: 2%; /* Adjusted width */
                    height: 3px; 
                    background: #9b5de5; 
                    border-radius: 1px;
                    filter: blur(1px); 
                    transform: translateY(-50%);
                    z-index: 5;
                    pointer-events: none;
                }

                /* Mobile Adjustments */
                @media (max-width: 600px) {
                    .dex-actions-group {
                        flex-direction: column;
                        gap: 1rem;
                    }
                    .dex-actions-group::before {
                        display: none; 
                    }
                    .dex-actions-group .action-btn {
                        width: 100%;
                        font-size: 1rem;
                    }
                }
            `}</style>
            
            <h1 className="dex-title">Aesthetic Hub — DEX Gateway</h1>

            {/* Wallet Connection / Initial View */}
            {!isConnected ? (
                <div className="neon-panel">
                    <p className="dex-status">
                        {isEthersLoaded && isThreeLoaded ? status : "Initializing Modules..."}
                    </p>
                    <button 
                        onClick={connect} 
                        className="dex-btn connect-btn"
                        disabled={!isEthersLoaded} 
                        style={{ padding: '1rem 2rem', fontSize: '1.2rem', margin: '1rem 0' }}
                    >
                        {isEthersLoaded ? "Connect Wallet" : "Loading Ethers..."}
                    </button>
                </div>
            ) : (
                /* Main Content View (Grid or Modal) */
                selectedToken ? <SwapModal /> : <TokenGrid />
            )}

            <p className="dex-note" style={{zIndex: 50, position: 'absolute', bottom: '1rem', color: '#555', fontSize: '0.8rem'}}>
                Note: Mock inventory and exchange rates are used for the front-end demo.
            </p>
        </div>
    );
}