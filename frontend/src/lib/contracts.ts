/**
 * Google Stock NFT V2 — Contract ABIs, Addresses, and Single Source of Truth
 *
 * V2 Architecture:
 * - No DeFi (Aave V3, InterestDistributor, GooglonSwapAdapter, TreasuryVault removed)
 * - ERC-6551 TBA integration (claim tokens through NFT's bound account)
 * - Two-phase mint (Whitelist 4 USDG, Public 6 USDG)
 * - DiamondHands loyalty rewards
 * - $G-Pass token (OurToken) — pre-minted, claimable from TBA
 */

import type { Address } from "viem";

// ====================================================================
// Environment-derived addresses (single source of truth)
// ====================================================================

export const ADDRESSES = {
  nft: (process.env.NEXT_PUBLIC_NFT_ADDRESS || "0x7b2db28C6F248Ad602c23A38E9419E8476340728") as Address,
  platform: (process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || "0xd3Afa4B4529619a09d7f78d0898d69f413EE8df4") as Address,
  stock: (process.env.NEXT_PUBLIC_STOCK_ADDRESS || "0x0B5E63B5812a4F50D3C35f4e2b8c886Db0f13D26") as Address,
  ourToken: (process.env.NEXT_PUBLIC_OUR_TOKEN_ADDRESS || "") as Address,
  diamondHands: (process.env.NEXT_PUBLIC_DIAMOND_HANDS_ADDRESS || "") as Address,
  erc6551Account: (process.env.NEXT_PUBLIC_ERC6551_ACCOUNT_ADDRESS || "0x7612959e3dF93AF717270Cb55FF98853e47A04d7") as Address,
  googl: (process.env.NEXT_PUBLIC_GOOGL_ADDRESS || "0x02f86DcC514C4974A0664f7364F93382997A01F6") as Address,
  usdg: (process.env.NEXT_PUBLIC_USDG_ADDRESS || "0xB14F6cFc482de0DadE91344Bd27d01Ee6C499e80") as Address,
  treasury: (process.env.NEXT_PUBLIC_TREASURY_EOA || "0x2bAFb4513b5e9a8C6BBb9ce063f5b18BF1B2cc1E") as Address,
} as const;

// ====================================================================
// ABI Fragments (minimal — only functions called from frontend)
// ====================================================================

// ---- GoogleStockNFT (ERC-721 + soulbound + two-phase mint) ----
export const NFT_ABI = [
  // ERC-721 read
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)",

  // Mint (two-phase)
  "function mint(address to, bytes32[] calldata proof) external returns (uint256)",

  // Soulbound
  "function isSoulbound(uint256 tokenId) view returns (bool)",

  // Phase
  "function mintPhase() view returns (uint8)",
  "function whitelistRoot() view returns (bytes32)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Minted(uint256 indexed tokenId, address indexed buyer, uint256 usdgPaid, uint8 phase)",
  "event SoulboundSet(uint256 indexed tokenId, bool soulbound)",
] as const;

// ---- PlatformManager (phase management) ----
export const PLATFORM_ABI = [
  "function mintPhase() view returns (uint8)",
  "function whitelistRoot() view returns (bytes32)",
  "function treasury() view returns (address)",
  "function owner() view returns (address)",
  "function setPhase(uint8 _phase) external",
  "function setWhitelistRoot(bytes32 _root) external",
  "function triggerMintEnd() external",
  "function pause() external",
  "function unpause() external",
  "event PhaseChanged(uint8 indexed oldPhase, uint8 indexed newPhase)",
] as const;

// ---- StockVault (TBA claims + GOOGL redemption) ----
export const STOCK_ABI = [
  // TBA
  "function tbaForToken(uint256) view returns (address)",
  "function claimOurToken(uint256 tokenId) external",
  "function claimGOOGL(uint256 tokenId) external",

  // GOOGL
  "function googlPerNFT() view returns (uint256)",
  "function googlAddress() view returns (address)",

  // NFT purchase
  "function purchaseViaUniswap(address tokenIn, uint256 amountIn, uint256 minGooglOut) external returns (uint256)",

  // State
  "function paused() view returns (bool)",
  "function owner() view returns (address)",

  // Events
  "event OurTokenClaimed(uint256 indexed tokenId, uint256 amount)",
  "event GOOGLClaimed(uint256 indexed tokenId, uint256 amount)",
] as const;

// ---- ERC-20 (standard) ----
export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

// ---- DiamondHands ----
export const DIAMOND_HANDS_ABI = [
  "function claimable(uint256 tokenId) view returns (uint256)",
  "function claim(uint256 tokenId) external",
  "function totalRewardPool() view returns (uint256)",
  "function rewardPerNFT() view returns (uint256)",
  "function mintEndTime() view returns (uint256)",
  "function sweepDeadline() view returns (uint256)",
  "event RewardsClaimed(uint256 indexed tokenId, uint256 amount)",
] as const;

// ---- ERC-6551 Registry (canonical) ----
export const ERC6551_REGISTRY_ABI = [
  "function account(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt) view returns (address)",
  "function createAccount(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt, bytes calldata initData) external returns (address)",
] as const;

// ---- ERC-6551 Account ----
export const ERC6551_ACCOUNT_ABI = [
  "function token() view returns (uint256 chainId, address tokenContract, uint256 tokenId)",
  "function owner() view returns (address)",
  "function execute(address to, uint256 value, bytes calldata data, uint8 operation) external returns (bytes memory)",
  "function isValidSignature(bytes32 hash, bytes calldata signature) view returns (bytes4)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
] as const;

// ---- Mock USDG Faucet ----
export const FAUCET_ABI = [
  "function mint(address to, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
] as const;

// ====================================================================
// Canonical ERC-6551 Registry Address
// ====================================================================

export const ERC6551_REGISTRY = "0x000000006551c19487814612e58FE06813775758" as Address;
