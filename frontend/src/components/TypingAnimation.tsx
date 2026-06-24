"use client";

import { useState, useEffect } from "react";

const PHRASES = [
  "Mint a share of Google.",
  "Earn 3.5% APY via Aave.",
  "Trade freely onchain.",
  "Redeem for GOOGLon.",
];

export function TypingAnimation() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    const phrase = PHRASES[phraseIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward
        if (charIndex < phrase.length) {
          setDisplayText(phrase.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          // Pause at end before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setDisplayText(phrase.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          setIsDeleting(false);
          setPhraseIndex((phraseIndex + 1) % PHRASES.length);
        }
      }
    }, isDeleting ? 30 : 60);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex]);

  return (
    <div style={{ fontSize: 42, fontWeight: 400, lineHeight: 1.3, letterSpacing: '-0.3px' }}>
      <span>{displayText}</span>
      <span style={{
        display: 'inline-block',
        width: 3,
        height: 36,
        marginLeft: 4,
        backgroundColor: 'var(--accent)',
        animation: 'blink 0.8s infinite',
        verticalAlign: 'middle',
        marginTop: -4,
      }} />
      <style>{`@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  );
}
