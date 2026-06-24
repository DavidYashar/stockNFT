/**
 * Shared constants for the Google Stock NFT platform.
 * Single source of truth — no magic numbers scattered across files.
 */

// ==================== Token Decimals (ETH-native) ====================
export const TOKEN_DECIMALS = {
  ETH: 18,
  GOOGL_PRICE: 8,
  SHARES: 18,
} as const;

// ==================== ETH Price (USD) ====================
// Primary source: CoinGecko API (via useETHPrice hook)
// Fallback: env var NEXT_PUBLIC_ETH_PRICE_USD, default $2000
const ETH_PRICE_FALLBACK = Number(process.env.NEXT_PUBLIC_ETH_PRICE_USD) || 2000;
const TARGET_USD_PER_MINT = Number(process.env.NEXT_PUBLIC_TARGET_USD_PER_MINT) || 10;

// ==================== NFT Configuration ====================
const FEE_BPS = Number(process.env.NEXT_PUBLIC_REDEMPTION_FEE_BPS) || 500;

export const NFT_CONFIG = {
  // Mint price is read live from contract.mintPrice() — this is a display fallback only
  MINT_PRICE_ETH_FALLBACK: TARGET_USD_PER_MINT / ETH_PRICE_FALLBACK,
  TARGET_USD_PER_MINT,
  ETH_PRICE_FALLBACK,
  MAX_SUPPLY: Number(process.env.NEXT_PUBLIC_MAX_SUPPLY) || 4_083,
  REDEMPTION_FEE_BPS: FEE_BPS,
  REDEMPTION_WAIT_SECONDS: Number(process.env.NEXT_PUBLIC_REDEMPTION_WAIT_SECONDS) || 172800,
  REDEMPTION_FEE_PCT: FEE_BPS / 10000,
  REDEMPTION_NET_PCT: 1 - FEE_BPS / 10000,
} as const;

// ==================== Price Configuration (env-configurable) ====================
export const PRICE_CONFIG = {
  DEFAULT_GOOGL: Number(process.env.NEXT_PUBLIC_DEFAULT_GOOGL_PRICE) || 365,
  REFRESH_INTERVAL_MS: Number(process.env.NEXT_PUBLIC_PRICE_REFRESH_MS) || 30 * 60 * 1000,
} as const;

// ==================== Aave / DeFi (fixed protocol constants) ====================
export const AAVE_RAY = BigInt("1000000000000000000000000000"); // 1e27 RAY precision

// ==================== Certificate Layout ====================
// Coordinates are fixed — they match the template PNG design.
// Only the template URL/id may change per environment.
const CERT_TEMPLATE_ID = process.env.NEXT_PUBLIC_CERTIFICATE_TEMPLATE_ID || "DZqDgm2LqH8pDXTtuC7uUByYPaCHiibmR3vQtbBf17DK";
const CERT_GATEWAY = process.env.NEXT_PUBLIC_IRYS_GATEWAY || "https://gateway.irys.xyz";

export const CERTIFICATE = {
  TEMPLATE_ARWEAVE_ID: CERT_TEMPLATE_ID,
  TEMPLATE_URL: CERT_GATEWAY + "/" + CERT_TEMPLATE_ID,
  WIDTH: 1414,
  HEIGHT: 2000,
  VALUE_X: 650,
  FIELD_Y: {
    certificateNo: 920,
    owner: 1030,
    share: 1140,
    value: 1255,
    issueDate: 1370,
    network: 1480,
    googlPrice: 1585,
  },
} as const;

// ==================== localStorage Keys ====================
export const STORAGE_KEYS = {
  PENDING_REDEMPTIONS: "gsnft_pending_redemptions",
} as const;
