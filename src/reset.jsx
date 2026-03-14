import { useState } from "react";
import axios from "axios";

export default function Reset() {
  const [newPass, setNewPass] = useState('');
  const token = new URLSearchParams(window.location.search).get("token");

  const submit = async () => {
    await axios.post("https://aesthetic-hub-production.up.railway.app/resetPassword", { token, newPassword: newPass });
    alert("Password updated. You can log in now.");
    window.location.href = "/";
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Reset Password</h2>
      <input
        type="password"
        placeholder="New password"
        value={newPass}
        onChange={e => setNewPass(e.target.value)}
      />
      <button onClick={submit}>Reset</button>
    </div>
  );
}
