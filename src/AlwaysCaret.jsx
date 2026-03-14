// src/AlwaysCaret.jsx
import React, { useEffect, useState } from "react";
import "./index.css"; // make sure .fake-caret CSS is here

const COLORS = ["#ff004c", "#ff7a00", "#ffe600", "#00f5a0", "#00b3ff", "#7a00ff", "#ff00ea"];

export default function AlwaysCaret() {
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setColorIndex((i) => (i + 1) % COLORS.length);
    }, 350);
    return () => clearInterval(t);
  }, []);

  return (
    <span
      className="fake-caret"
      style={{ color: COLORS[colorIndex] }}
    >
      |
    </span>
  );
}
