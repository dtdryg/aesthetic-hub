import React, { useState } from "react";

function PostChain() {
  const [data, setData] = useState("");
  const [response, setResponse] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("https://aesthetic-hub-production.up.railway.app/add_block", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
    });

    const json = await res.json();
    setResponse(JSON.stringify(json, null, 2));
    setData("");
  };

  return (
    <div>
      <h2>Add to Blockchain</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={data}
          onChange={(e) => setData(e.target.value)}
          placeholder="Enter transaction data"
        />
        <button type="submit">Add Block</button>
      </form>
      <pre>{response}</pre>
    </div>
  );
}

export default PostChain;
