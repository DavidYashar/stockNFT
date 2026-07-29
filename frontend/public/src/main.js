/**
 * stockNFT — Main Entry Point
 * Initializes the SceneManager, UI interactions, and ticker data.
 */

import { SceneManager } from './SceneManager.js';

// ---- DOM Elements ----
const loadingScreen = document.getElementById('loading-screen');
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('mobile-nav');
const btnOpenDapp = document.getElementById('btn-open-dapp');

// ---- Three.js Background ----
let sceneManager;

/**
 * Initialize the application after assets are ready.
 */
function init() {
  // --- WebGL Background ---
  sceneManager = new SceneManager('webgl-bg');

  // --- Navigation ---
  initNavigation();

  // --- Tickers ---
  initTickers();

  // --- Stats Counter ---
  initCounters();

  // --- Open DAPP ---
  initOpenDapp();

  // --- Loading Screen ---
  hideLoadingScreen();
}

/**
 * Hide the loading screen with a fade.
 */
function hideLoadingScreen() {
  // Small delay to ensure everything is initialized
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
  }, 800);
}

/**
 * Initialize navigation behavior (sticky, scroll spy, mobile).
 */
function initNavigation() {
  // Mobile nav toggle with overlay backdrop
  navToggle.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    navToggle.querySelector('.material-icons-round').textContent = isOpen ? 'close' : 'menu';
    document.body.style.overflow = isOpen ? 'hidden' : '';
    // Toggle overlay
    let overlay = document.querySelector('.mobile-nav-overlay');
    if (isOpen) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'mobile-nav-overlay';
        document.body.appendChild(overlay);
        // Force reflow then add open class for transition
        overlay.offsetHeight;
        overlay.classList.add('open');
        overlay.addEventListener('click', () => {
          mobileNav.classList.remove('open');
          overlay.classList.remove('open');
          navToggle.querySelector('.material-icons-round').textContent = 'menu';
          document.body.style.overflow = '';
          setTimeout(() => overlay.remove(), 350);
        });
      } else {
        overlay.classList.add('open');
      }
    } else {
      if (overlay) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 350);
      }
    }
  });

  // Close mobile nav on link click (including Open DAPP button)
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      navToggle.querySelector('.material-icons-round').textContent = 'menu';
      document.body.style.overflow = '';
      const overlay = document.querySelector('.mobile-nav-overlay');
      if (overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 350); }
    });
  });

  // Scroll spy for nav items
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-item');

  const observerOptions = {
    root: null,
    rootMargin: '-40% 0px -55% 0px',
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach((item) => {
          item.classList.toggle('active', item.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, observerOptions);

  sections.forEach((section) => observer.observe(section));

  // Navbar scrolled state
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

/**
 * Initialize stock ticker and tech marquee.
 * Fetches live prices from Robinhood Stock Token API via our proxy.
 */
function initTickers() {
  const tickerTrack = document.getElementById('ticker-track');
  const marqueeStocks = document.getElementById('marquee-stocks');
  const stockSymbols = ['AAPL','GOOGL','TSLA','MSFT','NVDA','AMZN','META','XOM','NFLX','INTC','AMD','QCOM'];

  // Render a stock ticker item from API data
  function renderTickerItem(q) {
    const up = q.up;
    const cls = up ? 'ticker-up' : 'ticker-down';
    const arrow = up ? '▲' : '▼';
    return `<span class="${cls}">${q.symbol} $${q.price} ${arrow} ${q.change}%</span>`;
  }

  // Fallback static data (shown before first API fetch)
  const fallbackStocks = [
    { symbol:'AAPL',price:'198.45',change:'2.34',up:true},{ symbol:'GOOGL',price:'152.30',change:'0.87',up:false},
    { symbol:'TSLA',price:'245.67',change:'5.21',up:true},{ symbol:'MSFT',price:'428.90',change:'3.15',up:true},
    { symbol:'NVDA',price:'132.45',change:'1.20',up:false},{ symbol:'AMZN',price:'187.32',change:'1.89',up:true},
    { symbol:'META',price:'515.78',change:'4.56',up:true},{ symbol:'XOM',price:'118.30',change:'0.50',up:false},
    { symbol:'NFLX',price:'682.90',change:'5.40',up:true},{ symbol:'INTC',price:'32.50',change:'0.25',up:true},
    { symbol:'AMD',price:'142.80',change:'1.10',up:true},{ symbol:'QCOM',price:'188.60',change:'0.90',up:false},
  ];

  function updateTickerHTML(quotes) {
    const items = quotes.map(renderTickerItem).join(' · ');
    if (tickerTrack) tickerTrack.innerHTML = items + ' · ' + items;
    if (marqueeStocks) {
      const content = quotes.map(q => `<span>$${q.symbol}</span>`).join('');
      marqueeStocks.innerHTML = `<div class="marquee-scroll">${content} ${content}</div>`;
    }
  }

  // Show fallback immediately
  updateTickerHTML(fallbackStocks);

  // Fetch live prices every hour (Robinhood data is not real-time for display)
  async function fetchLivePrices() {
    try {
      const res = await fetch('/api/stock-prices');
      if (!res.ok) return;
      const quotes = await res.json();
      if (quotes && quotes.length > 0) {
        updateTickerHTML(quotes);
      }
    } catch { /* keep showing fallback */ }
  }

  fetchLivePrices();
  setInterval(fetchLivePrices, 3600000); // 1 hour

  // Tech marquee (static)
  const marqueeTech = document.getElementById('marquee-tech');
  const techTags = [
    '#SOLIDITY', '#EVM', '#NFT', '#DEFI', '#WEB3', '#BLOCKCHAIN',
    '#SMART_CONTRACTS', '#TOKENIZATION', '#ROBINHOOD_CHAIN', '#DA0',
    '#ERC721', '#LAYER2', '#ZKP', '#INTEROPERABILITY',
  ];
  if (marqueeTech) {
    const content = techTags.map((t) => `<span>${t}</span>`).join('');
    marqueeTech.innerHTML = `<div class="marquee-scroll">${content} ${content}</div>`;
  }
}

/**
 * Animate stat counters when they come into view.
 */
function initCounters() {
  const statValues = document.querySelectorAll('.stat-value[data-count]');

  const animateCounter = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 2000;
    const startTime = performance.now();

    const formatNumber = (num) => {
      if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return num.toLocaleString('en-US');
      return num.toString();
    };

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      el.textContent = formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  statValues.forEach((el) => counterObserver.observe(el));
}

/**
 * Open DAPP button — navigates to the app section.
 */
function initOpenDapp() {
  if (!btnOpenDapp) return;

  btnOpenDapp.addEventListener('click', () => {
    window.location.href = '/app/';
  });
}

// ---- Boot ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ---- Cleanup on page unload ----
window.addEventListener('beforeunload', () => {
  if (sceneManager) {
    sceneManager.dispose();
  }
});
