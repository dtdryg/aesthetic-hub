import React, { useState } from "react";
import "./index.css"; // keep your existing styles

export default function LoginGate() {
  const [activeTab, setActiveTab] = useState("web3");
  const [isRegister, setIsRegister] = useState(false);

  // form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeTab === "web2") {
      if (isRegister) {
        console.log("Register with:", { username, email, password });
      } else {
        console.log("Login with:", { username, email, password });
      }
    } else {
      console.log("Web3 login flow…");
    }
  };

  return (
    <div id="login-gate">
      <div className="login-form">
        <div className="login-tabs">
          <button
            className={activeTab === "web3" ? "active" : ""}
            onClick={() => setActiveTab("web3")}
          >
            Web3
          </button>
          <button
            className={activeTab === "web2" ? "active" : ""}
            onClick={() => setActiveTab("web2")}
          >
            Web2
          </button>
        </div>

        {/* --- Web3 tab --- */}
        {activeTab === "web3" && (
          <div className="login-card">
            <h3 className="login-title">Web3 Login</h3>
            <button className="siwe-btn">Connect Wallet</button>
          </div>
        )}

        {/* --- Web2 tab --- */}
        {activeTab === "web2" && (
          <form className="login-card" onSubmit={handleSubmit}>
            <h3 className="login-title">
              {isRegister ? "Register (Web2)" : "Login (Web2)"}
            </h3>

            {/* Show both fields always so user can pick */}
            {!isRegister && (
              <>
                <input
                  type="text"
                  placeholder="Username (or leave blank if using email)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Email (or leave blank if using username)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </>
            )}

            {/* Force all three for register */}
            {isRegister && (
              <>
                <input
                  type="text"
                  placeholder="Choose a Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <input
                  type="email"
                  placeholder="Enter your Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </>
            )}

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit">{isRegister ? "Register" : "Login"}</button>

            <p className="login-sub">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <button type="button" onClick={() => setIsRegister(false)}>
                    Login
                  </button>
                </>
              ) : (
                <>
                  Don’t have an account?{" "}
                  <button type="button" onClick={() => setIsRegister(true)}>
                    Register
                  </button>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
