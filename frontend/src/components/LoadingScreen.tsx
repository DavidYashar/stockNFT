'use client';

import { useEffect, useRef } from 'react';

export default function LoadingScreen() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hide = () => {
      setTimeout(() => el.classList.add('hidden'), 800);
    };
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
    return () => window.removeEventListener('load', hide);
  }, []);

  return (
    <div ref={ref} id="loading-screen" aria-label="Loading">
      <div className="loader-ring"></div>
      <p>Loading StockNFT</p>
    </div>
  );
}
