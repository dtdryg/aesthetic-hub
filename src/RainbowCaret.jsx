// src/RainbowCaret.jsx
import { useEffect } from "react";

// rainbow gradient steps
const COLORS = [
  "#ff004c",
  "#ff7a00",
  "#ffe600",
  "#00f5a0",
  "#00b3ff",
  "#7a00ff",
  "#ff00ea"
];

export default function RainbowCaret({ intervalMs = 100 }) {
  useEffect(() => {
    let i = 0;
    const targets = new Set();

    const setCaret = (el, color) => {
      try {
        el.style.caretColor = color;
      } catch {}
    };

    const onFocusIn = (e) => {
      const el = e.target;
      if (el.matches?.("input, textarea, [contenteditable='true'], .ql-editor")) {
        targets.add(el);
        setCaret(el, COLORS[i % COLORS.length]);
      }
    };

    const onFocusOut = (e) => {
      targets.delete(e.target);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    const t = setInterval(() => {
      i = (i + 1) % COLORS.length;
      const color = COLORS[i];
      targets.forEach((el) => setCaret(el, color));
    }, intervalMs);

    return () => {
      clearInterval(t);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [intervalMs]);

  return null;
}
