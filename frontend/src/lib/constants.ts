/**
 * Google Stock NFT V2 — Shared constants
 * Single source of truth — no magic numbers scattered across files.
 */

// ====================================================================
// Token decimals
// ====================================================================

export const TOKEN_DECIMALS = {
  /** USDG (Paxos stablecoin) — 6 decimals */
  USDG: 6,
  /** Native token (ETH on Robinhood) — 18 decimals */
  NATIVE: 18,
  /** GOOGL — 18 decimals */
  GOOGL: 18,
  /** $G-Pass (OurToken) — 6 decimals */
  OUR_TOKEN: 6,
} as const;

// ====================================================================
// Mint pricing (V2 — USDG only)
// ====================================================================

export const MINT_PRICE = {
  /** Whitelist phase price in USDG */
  WHITELIST: 4,
  /** Public phase price in USDG */
  PUBLIC: 6,
} as const;

// ====================================================================
// DiamondHands
// ====================================================================

export const DIAMOND_HANDS = {
  /** Days after mint-end before rewards are claimable */
  HOLD_DAYS: 7,
  /** Total reward pool allocation (150M $G-Pass) */
  TOTAL_REWARD_POOL: 150_000_000,
  /** Days after mint-end before unclaimed rewards can be swept */
  SWEEP_DAYS: 730, // 2 years
} as const;

// ====================================================================
// Platform
// ====================================================================

export const MINT_PHASE = {
  NONE: 0,
  WHITELIST: 1,
  PUBLIC: 2,
  ENDED: 3,
} as const;

export const PLATFORM_FEE_BPS = 250; // 2.5%
export const PLATFORM_FEE_DENOMINATOR = 10000;

// ====================================================================
// GOOGL purchase (StockVault.purchaseViaUniswap)
// ====================================================================

/** Minimum GOOGL out per USDG in (slippage protection) */
export const GOOGL_MIN_RATE = 0.95; // 95% of oracle rate

// ====================================================================
// Certificate SVG (Arweave template + text overlay coordinates)
// ====================================================================

export const CERTIFICATE = {
  /** Permanent Arweave URL for the certificate template image (1414×2000) */
  TEMPLATE_URL: "https://arweave.net/your-certificate-template-id",
  /** X position for all dynamic text overlays */
  VALUE_X: 520,
  /** Y positions for each field on the certificate */
  FIELD_Y: {
    certificateNo: 640,
    owner: 760,
    share: 880,
    value: 1000,
    issueDate: 1120,
    network: 1240,
    googlPrice: 1360,
  },
} as const;
