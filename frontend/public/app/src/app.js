/**
 * stockNFT DAPP — App Logic
 * Tab switching, wallet connect, mobile sidebar, real contract reads for tier.
 */
import { ethers } from 'ethers';

// ─── Contract config ───
const RPC_URL = '/api/rpc';
const PM_ADDRESS = '0xd3Afa4B4529619a09d7f78d0898d69f413EE8df4';
const PM_ABI = [
  'function mintPhase() view returns (uint8)',
  'function whitelistRoot() view returns (bytes32)',
];
const provider = new ethers.JsonRpcProvider(RPC_URL);
const pmContract = new ethers.Contract(PM_ADDRESS, PM_ABI, provider);

// ─── DOM Elements ───
const sidebarTabs = document.querySelectorAll('.sidebar-tab');
const appPages = document.querySelectorAll('.app-page');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileTitle = document.getElementById('mobile-title');
const btnWalletConnect = document.getElementById('btn-wallet-connect');
const walletInfo = document.getElementById('wallet-info');
const walletAddress = document.getElementById('wallet-address');

// ---- State ----
let activeTab = 'mint';
let walletConnected = false;
let walletProvider = null;
let walletSigner = null;
let userAddress = null;

// ---- Wallet Connect (MetaMask + OKX) ----
const walletSelector = document.getElementById('wallet-selector');

// Show wallet selector dropdown
function openWalletSelector() {
  if (walletConnected) { disconnectWallet(); return; }
  if (walletSelector) {
    walletSelector.style.display = walletSelector.style.display === 'flex' ? 'none' : 'flex';
  }
}

// Connect to a specific wallet
async function connectWallet(walletType) {
  let injected = null;
  if (walletType === 'metamask' && window.ethereum) {
    injected = window.ethereum;
  } else if (walletType === 'okx' && window.okxwallet) {
    injected = window.okxwallet;
  } else if (window.ethereum) {
    // Fallback to any injected provider
    injected = window.ethereum;
  }

  if (!injected) {
    const name = walletType === 'metamask' ? 'MetaMask' : walletType === 'okx' ? 'OKX Wallet' : 'an EVM wallet';
    alert(`Please install ${name} to use this DAPP.`);
    return;
  }

  try {
    walletProvider = new ethers.BrowserProvider(injected);
    const accounts = await walletProvider.send('eth_requestAccounts', []);
    if (accounts.length === 0) return;
    userAddress = accounts[0];
    walletSigner = await walletProvider.getSigner();
    walletConnected = true;

    // Hide selector, update UI
    if (walletSelector) walletSelector.style.display = 'none';
    btnWalletConnect.classList.add('connected');
    btnWalletConnect.innerHTML = '<span class="material-icons-round">link</span><span>Connected</span>';
    walletInfo.style.display = 'flex';
    walletAddress.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;

    detectTier();
  } catch (err) {
    console.error('Wallet connect failed:', err);
  }
}

async function disconnectWallet() {
  walletConnected = false;
  walletProvider = null;
  walletSigner = null;
  userAddress = null;

  btnWalletConnect.classList.remove('connected');
  btnWalletConnect.innerHTML = '<span class="material-icons-round">account_balance_wallet</span><span>Connect Wallet</span>';
  walletInfo.style.display = 'none';

  // Reset tier display
  if (tierValue) {
    tierValue.textContent = 'Connect wallet to see your tier';
    tierValue.style.color = 'var(--text-muted)';
  }
  setTier('public');
  // Reset tier + selector
  if (tierValue) {
    tierValue.textContent = 'Connect wallet to see your tier';
    tierValue.style.color = 'var(--text-muted)';
  }
  setTier('public');
  if (walletSelector) walletSelector.style.display = 'none';
}

// ---- Connect button toggles selector ----
if (btnWalletConnect) {
  btnWalletConnect.addEventListener('click', openWalletSelector);
}

// ---- Wallet option buttons ----
if (walletSelector) {
  walletSelector.querySelectorAll('.wallet-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const walletType = btn.dataset.wallet;
      connectWallet(walletType);
    });
  });
}

// Close selector on outside click
document.addEventListener('click', (e) => {
  if (walletSelector && walletSelector.style.display === 'flex') {
    if (!walletSelector.contains(e.target) && e.target !== btnWalletConnect && !btnWalletConnect.contains(e.target)) {
      walletSelector.style.display = 'none';
    }
  }
});
function switchTab(tabName) {
  activeTab = tabName;

  // Update sidebar buttons
  sidebarTabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update content panels
  appPages.forEach((page) => {
    page.classList.toggle('active', page.id === `page-${tabName}`);
  });

  // Update mobile title
  if (mobileTitle) {
    const label = document.querySelector(`[data-tab="${tabName}"] .tab-label`);
    mobileTitle.textContent = label ? label.textContent : tabName.charAt(0).toUpperCase() + tabName.slice(1);
  }

  // Close mobile sidebar after selection
  closeSidebar();
}

sidebarTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
  });
});

// ---- Mobile Sidebar ----
function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
}

if (overlay) {
  overlay.addEventListener('click', closeSidebar);
}

// Close sidebar on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar.classList.contains('open')) {
    closeSidebar();
  }
});

// ---- Mobile Wallet Button (triggers main connect) ----
const mobileWalletBtn = document.getElementById('mobile-wallet-btn');
if (mobileWalletBtn && btnWalletConnect) {
  mobileWalletBtn.addEventListener('click', () => {
    btnWalletConnect.click();
  });
}

// ---- Keyboard Navigation (Tab between pages with 1-4 keys) ----
document.addEventListener('keydown', (e) => {
  // Only if not in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  const tabKeys = { '1': 'mint', '2': 'portfolio', '3': 'redeem', '4': 'admin' };
  const tab = tabKeys[e.key];
  if (tab) {
    e.preventDefault();
    switchTab(tab);
  }
});

// ---- Handle window resize (close mobile sidebar on desktop) ----
window.addEventListener('resize', () => {
  if (window.innerWidth > 640) {
    closeSidebar();
  }
});

// ================================================================
// MINT PAGE LOGIC
// ================================================================

// ---- 3D Certificate Tilt ----
const certFrame = document.getElementById('cert-frame');
const certCard = document.getElementById('cert-card');

if (certFrame && certCard) {
  certFrame.addEventListener('mousemove', (e) => {
    const rect = certFrame.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation (max ±15 degrees)
    const rotateY = ((x - centerX) / centerX) * 12;
    const rotateX = -((y - centerY) / centerY) * 12;

    certFrame.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  });

  certFrame.addEventListener('mouseleave', () => {
    certFrame.style.transform = 'rotateY(0deg) rotateX(0deg)';
  });

  // Touch support
  certFrame.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = certFrame.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateY = ((x - centerX) / centerX) * 10;
    const rotateX = -((y - centerY) / centerY) * 10;

    certFrame.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
  }, { passive: false });

  certFrame.addEventListener('touchend', () => {
    certFrame.style.transform = 'rotateY(0deg) rotateX(0deg)';
  });
}

// ---- Floating Particles around Certificate ----
const certParticles = document.getElementById('cert-particles');
if (certParticles && window.innerWidth > 640) {
  const particleCount = 16;
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'cert-particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 3}s`;
    particle.style.animationDuration = `${2.5 + Math.random() * 4}s`;
    particle.style.width = `${2 + Math.random() * 4}px`;
    particle.style.height = particle.style.width;
    certParticles.appendChild(particle);
  }
}

// ---- Quantity Selector ----
const qtyInput = document.getElementById('qty-input');
const qtyMinus = document.getElementById('qty-minus');
const qtyPlus = document.getElementById('qty-plus');
const mintTotal = document.getElementById('mint-total');
const tierWhitelist = document.getElementById('tier-whitelist');
const tierPublic = document.getElementById('tier-public');
const tierValue = document.getElementById('tier-value');

let quantity = 1;
let activeTier = 'whitelist'; // 'whitelist' | 'public'
const TIER_PRICES = { whitelist: 4, public: 6 };

function updateMintTotal() {
  const price = TIER_PRICES[activeTier];
  const total = price * quantity;
  if (mintTotal) {
    mintTotal.textContent = `${total.toFixed(2)} USDG`;
  }
}

function updateQuantityDisplay() {
  if (qtyInput) qtyInput.value = quantity;
  updateMintTotal();
}

if (qtyMinus) {
  qtyMinus.addEventListener('click', () => {
    if (quantity > 1) {
      quantity--;
      updateQuantityDisplay();
    }
  });
}

if (qtyPlus) {
  qtyPlus.addEventListener('click', () => {
    if (quantity < 100) {
      quantity++;
      updateQuantityDisplay();
    }
  });
}

// Set initial tier message
if (tierValue) {
  tierValue.textContent = 'Connect wallet to see your tier';
  tierValue.style.color = 'var(--text-muted)';
}

// ---- Tier Switching (real — reads PlatformManager on-chain) ----
function setTier(tier) {
  activeTier = tier;
  if (tierWhitelist) tierWhitelist.classList.toggle('active', tier === 'whitelist');
  if (tierPublic) tierPublic.classList.toggle('active', tier === 'public');
  if (tierValue) {
    tierValue.textContent = tier === 'whitelist' ? 'Whitelist · 4 USDG/share' : 'Public · 6 USDG/share';
    tierValue.style.color = tier === 'whitelist' ? 'var(--color-primary)' : 'var(--text-primary)';
  }
  updateMintTotal();
}

// ---- Tier Detection (real — reads PlatformManager on-chain) ----
async function detectTier() {
  try {
    const phase = await pmContract.mintPhase();
    if (phase === 1n && userAddress) {
      const root = await pmContract.whitelistRoot();
      let isWL = false;
      if (root !== ethers.ZeroHash) {
        const userLeaf = ethers.keccak256(ethers.toUtf8Bytes(userAddress.slice(2).toLowerCase()));
        isWL = (userLeaf === root);
      }
      setTier(isWL ? 'whitelist' : 'public');
      if (tierValue) {
        tierValue.textContent = isWL ? 'Whitelist · 4 USDG/share' : 'Not Whitelisted · Public Phase';
        tierValue.style.color = isWL ? 'var(--color-primary)' : '#E04040';
      }
    } else if (phase === 2n) {
      setTier('public');
    } else {
      setTier('public');
      if (tierValue) tierValue.textContent = 'Mint not active';
    }
  } catch (err) {
    console.warn('Tier detection failed:', err.message);
    setTier('public');
  }
}

// ---- Mint Button ----
const btnMint = document.getElementById('btn-mint');
if (btnMint) {
  btnMint.addEventListener('click', () => {
    const price = TIER_PRICES[activeTier];
    const total = price * quantity;
    // In production: call smart contract mint function
    alert(`Minting ${quantity} GOOGL stock NFT(s) at ${price} USDG each.\nTotal: ${total} USDG\n\n(Simulated — connect wallet and approve USDG spending to proceed on-chain.)`);
  });
}

// ---- Live Price Updater (Robinhood API via our proxy) ----
const googlePriceEl = document.getElementById('google-price');
const googleChangeEl = document.getElementById('google-change');

async function updateGooglePrice() {
  try {
    const res = await fetch('/api/stock-prices');
    if (!res.ok) return;
    const data = await res.json();
    const googl = data.find(d => d.symbol === 'GOOGL');
    if (!googl) return;

    if (googlePriceEl) {
      googlePriceEl.textContent = googl.price;
    }
    if (googleChangeEl) {
      const change = parseFloat(googl.change);
      const isUp = googl.up;
      googleChangeEl.textContent = `${isUp ? '▲' : '▼'} ${googl.change} (${googl.change}%)`;
      googleChangeEl.className = `price-change ${isUp ? 'up' : 'down'}`;
    }
  } catch { /* keep previous price on error */ }
}

// Initial fetch + update every hour (Robinhood cache window)
updateGooglePrice();
setInterval(updateGooglePrice, 3600000);

// ---- Init Mint Page ----
detectTier();
updateQuantityDisplay();
updateGooglePrice();

// ================================================================
// PORTFOLIO PAGE LOGIC
// ================================================================

// ---- Mock NFT Data ----
const MOCK_NFTS = [
  { id: '#001', symbol: 'GOOGL', tokens: 10, shares: 10, claimed: true,  date: 'Jul 15, 2026', value: '$1,984.50' },
  { id: '#002', symbol: 'GOOGL', tokens: 5,  shares: 5,  claimed: true,  date: 'Jul 16, 2026', value: '$992.25' },
  { id: '#003', symbol: 'AAPL', tokens: 20, shares: 20, claimed: true,  date: 'Jul 17, 2026', value: '$3,969.00' },
  { id: '#004', symbol: 'GOOGL', tokens: 3,  shares: 3,  claimed: false, date: 'Jul 18, 2026', value: '$595.35' },
  { id: '#005', symbol: 'TSLA', tokens: 15, shares: 15, claimed: true,  date: 'Jul 18, 2026', value: '$3,685.05' },
  { id: '#006', symbol: 'MSFT', tokens: 8,  shares: 8,  claimed: true,  date: 'Jul 19, 2026', value: '$3,431.20' },
  { id: '#007', symbol: 'GOOGL', tokens: 2,  shares: 2,  claimed: false, date: 'Jul 20, 2026', value: '$396.90' },
  { id: '#008', symbol: 'AAPL', tokens: 12, shares: 12, claimed: true,  date: 'Jul 21, 2026', value: '$2,381.40' },
];

const STOCK_COLORS = {
  GOOGL: { bg: 'rgba(66,133,244,0.12)', border: 'rgba(66,133,244,0.3)', text: '#4285F4' },
  AAPL:  { bg: 'rgba(160,160,160,0.12)', border: 'rgba(160,160,160,0.3)', text: '#A0A0A0' },
  TSLA:  { bg: 'rgba(224,64,64,0.12)',  border: 'rgba(224,64,64,0.3)',  text: '#E04040' },
  MSFT:  { bg: 'rgba(0,163,96,0.12)',   border: 'rgba(0,163,96,0.3)',   text: '#00A360' },
};

// ---- Populate NFT Grid ----
const portfolioGrid = document.getElementById('portfolio-grid');
const nftModalOverlay = document.getElementById('nft-modal-overlay');
const modalClose = document.getElementById('modal-close');

function buildPortfolioGrid() {
  if (!portfolioGrid) return;

  portfolioGrid.innerHTML = '';

  MOCK_NFTS.forEach((nft) => {
    const colors = STOCK_COLORS[nft.symbol] || STOCK_COLORS['GOOGL'];
    const statusClass = nft.claimed ? 'claimed' : 'unclaimed';
    const statusText = nft.claimed ? 'Claimed' : 'Unclaimed';

    const card = document.createElement('div');
    card.className = 'nft-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${nft.symbol} Stock NFT ${nft.id}`);
    card.style.borderColor = colors.border.replace(/[\d.]+\)$/, '0.15)');
    card.innerHTML = `
      <div class="nft-card-image-wrapper" style="background:${colors.bg}; display:flex; align-items:center; justify-content:center; aspect-ratio:4/3; border-bottom:1px solid var(--border-color);">
        <span style="font-family:var(--font-mono); font-size:48px; font-weight:900; color:${colors.text}; opacity:0.6;">${nft.symbol}</span>
      </div>
      <div class="nft-card-body">
        <span class="nft-card-symbol">${nft.symbol}</span>
        <span class="nft-card-name">Stock NFT ${nft.id}</span>
        <span class="nft-card-number">${nft.tokens} Tokens · ${nft.shares} Shares</span>
        <div class="nft-card-footer">
          <span class="nft-card-value">${nft.value}</span>
          <span class="nft-card-status ${statusClass}">${statusText}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openNftModal(nft));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openNftModal(nft);
      }
    });

    portfolioGrid.appendChild(card);
  });
}

// ---- NFT Detail Modal ----
function openNftModal(nft) {
  if (!nftModalOverlay) return;

  // Update modal content
  const modalTitle = document.getElementById('modal-title');
  const modalNftId = document.getElementById('modal-nft-id');
  const modalTokens = document.getElementById('modal-tokens');
  const modalShares = document.getElementById('modal-shares');
  const modalDate = document.getElementById('modal-date');
  const modalValue = document.getElementById('modal-value');
  const modalStatus = document.getElementById('modal-status');
  const modalBadge = nftModalOverlay.querySelector('.modal-badge');

  if (modalTitle) modalTitle.textContent = `${nft.symbol} Stock NFT ${nft.id}`;
  if (modalNftId) modalNftId.textContent = nft.id;
  if (modalTokens) modalTokens.textContent = `${nft.tokens} ${nft.symbol}`;
  if (modalShares) modalShares.textContent = `${nft.shares} Shares`;
  if (modalDate) modalDate.textContent = nft.date;
  if (modalValue) modalValue.textContent = nft.value;
  if (modalBadge) modalBadge.textContent = nft.symbol;

  const statusClass = nft.claimed ? 'claimed' : 'unclaimed';
  const statusText = nft.claimed ? 'Claimed' : 'Unclaimed';
  if (modalStatus) {
    modalStatus.innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;
  }

  // Open modal
  nftModalOverlay.classList.add('open');
  nftModalOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeNftModal() {
  if (!nftModalOverlay) return;
  nftModalOverlay.classList.remove('open');
  nftModalOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

if (modalClose) {
  modalClose.addEventListener('click', closeNftModal);
}

// Close modal on backdrop click
const modalBackdrop = nftModalOverlay?.querySelector('.modal-backdrop');
if (modalBackdrop) {
  modalBackdrop.addEventListener('click', closeNftModal);
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nftModalOverlay?.classList.contains('open')) {
    closeNftModal();
  }
});

// ---- Init Portfolio Page ----
buildPortfolioGrid();

// ---- Init ----
console.log('%c stockNFT DAPP ready %c v1.0.0 ',
  'background:#80C020;color:#000;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:bold;',
  'background:#141414;color:#80C020;padding:4px 8px;border-radius:0 4px 4px 0;');
