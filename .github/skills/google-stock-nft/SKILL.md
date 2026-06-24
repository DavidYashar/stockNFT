---
name: google-stock-nft
description: 'Google Stock NFT — Ethereum mainnet DeFi + NFT platform. USE FOR: deploy scripts, contract architecture, Aave→Uniswap→Distribute pipeline, GOOGLon purchase/redemption flow, InterestDistributor per-round tracking, admin operations. Key terms: StockVault, PlatformManager, GooglonSwapAdapter, InterestDistributor, Aave V3, Uniswap V3.'
argument-hint: '[query about GoogleStockNFT platform]'
---

# 🚨 MANDATORY RULES

1. **Verify on-chain before every claim.** Never state a number without querying the chain.
2. **Deploy only with `deploy-mainnet.ts`.** It deploys ALL contracts together and wires them in order.
3. **Propose before executing.** Present the plan, wait for user confirmation, then act.
4. **After every deploy, update ALL config files:** `frontend/.env.local`, `backend/.env`, `deployed.json`, and this skill's address table.

---

# Google Stock NFT — Ethereum Mainnet

## Project Summary

NFT minting platform. Revenue splits **80% to GOOGLon purchase** (via Uniswap V3) and **20% to DeFi yield** (via Aave V3). Yield earns in USDC, gets swapped to ETH, and distributed equally to NFT holders with per-round accumulation tracking.

**Network:** Ethereum Mainnet  
**ETH price:** CoinGecko live (5-min refresh) via `useETHPrice` hook  
**RPC:** Alchemy mainnet

---

## Contract Addresses

### 🔧 We Deploy (TBD — fill after `deploy-mainnet.ts` runs)

| # | Contract | Address | Purpose |
|---|---|---|---|
| 1 | GoogleStockNFT | `TBD` | ERC-721, minting, tokenURI |
| 2 | PlatformManager | `TBD` | Pools, lifecycle, sweep tracking |
| 3 | StockVault | `TBD` | GOOGLon purchase + redemption |
| 4 | InterestDistributor | `TBD` | Per-round ETH yield distribution |
| 5 | GooglonSwapAdapter | `TBD` | Uniswap V3 WETH→GOOGLon swap |

### 🔑 We Create (fresh wallets)

| Wallet | Address | Purpose |
|---|---|---|
| Treasury EOA | `TBD` | Receives mint ETH, signs sweeps, gets fees |
| Deployer EOA | `TBD` | Deploys contracts, controls mint lifecycle |

### ✅ Already on Mainnet (confirmed — no deploy needed)

| Contract | Address | Verified |
|---|---|---|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | ✅ |
| aEthUSDC (Aave) | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` | ✅ |
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | ✅ Etherscan |
| Uniswap V3 Router | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | ✅ Etherscan |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | ✅ |
| GOOGLon (Alphabet) | `0xbA47214eDd2bb43099611b208F75e4B42FDcfEDc` | ✅ Confirmed |

---

## Asset Flow

### Mint
```
User → NFT.mint(googlPrice) {value: ETH}
  ├─ ETH → Treasury EOA
  ├─ PM.recordMint: 80% pool80, 20% pool20
  └─ NFT minted → user
```

### Sweep (pool20 → USDC → Aave)
```
Admin clicks "Sweep to Aave"
  ├─ WETH.deposit(pool20 ETH)
  ├─ Uniswap V3: WETH → USDC (pool fee from NEXT_PUBLIC_UNISWAP_POOL_FEE, default 500=0.05%)
  ├─ USDC.approve(Aave)
  ├─ Aave V3: supply(USDC, amount, treasury, 0)
  └─ PM.recordSweep(ethAmount)
```

### Harvest & Distribute (Yield → ETH → Holders)
```
Admin enters USDC amount in input bar → clicks "Harvest & Distribute"
  ├─ Validates: amount ≤ current Aave position (scaledBalance × liquidityIndex / 1e27)
  ├─ Aave V3: withdraw(USDC, enteredAmount, treasury)
  ├─ PM.recordHarvest(yieldAmount)
  ├─ Uniswap V3: USDC → WETH (1% slippage) → unwrap to ETH
  ├─ ID.fundEqualDistribution{value: eth}()
  └─ ID.allowClaims()
```

### Claim
```
Holder → ID.claimInterest(tokenId)
  ├─ Loops unclaimed rounds, accumulates per-round amounts
  └─ Sends ETH via .call{value} (safe for all wallet types)
```

### Google Purchase (one-time)
```
Admin triggers via PM
  ├─ "Send Pool80" → sends 80% of mint revenue to SV
  ├─ "Send Loyalty" → sends only enough loyalty to cover 20% gap (excess stays in Treasury)
  ├─ Gates: mintEnded, triggerFired=false, loyaltyFees ≥ gap20
  └─ pm.triggerGooglePurchase(minGooglonOut)  [1% slippage]
       └─ SV.executeGooglePurchase(totalMintPrincipal, minGooglonOut)
            └─ GooglonSwapAdapter: WETH → GOOGLon via Uniswap V3 (with slippage)
```

### Google Purchase — Verified & Fixed (2026-06-24)

| Fix | Detail |
|---|---|
| **Slippage on swap** | `executeGooglePurchase` takes `minGooglonOut` parameter, passed through to Uniswap swap |
| **Loyalty send cap** | "Send Loyalty" button only sends `min(loyaltyFees, gap20)` — excess stays in Treasury |
| **`withdrawSurplus()`** | SV can return excess ETH to treasury after purchase (safety net) |

### Redemption
```
Holder → SV.requestRedemption(tokenId)  [burns NFT, starts 48h timer]
  ... wait 48 hours ...
Holder → SV.claimRedemption(tokenId)
  ├─ shares = proportional GOOGLon (getShares)
  ├─ fee = 5% → feeRecipient (treasury)
  └─ GOOGLon → holder
```

### Redemption — Verified (2026-06-24)

| Check | Status |
|---|---|
| Only owner can request | ✅ `ownerOf(tokenId)` check |
| Only requester can claim | ✅ `redemptionRequester[tokenId]` guard |
| 48h delay enforced | ✅ `block.timestamp >= requestedAt + 172800` |
| One-time claim | ✅ State reset to 0 after claim |
| 5% fee math correct | ✅ `shares × 500 / 10000` |
| GOOGLon via safeTransfer | ✅ OpenZeppelin SafeERC20 |
| getShares dynamic | ✅ `(totalGooglonHeld × principal) / totalMintPrincipal` |
| Post-burn tracking | ✅ localStorage + on-chain `RedemptionRequested` event fallback |

---

## Contracts

| Contract | Source | Key Functions |
|---|---|---|
| **GoogleStockNFT** | `contracts/GoogleStockNFT.sol` | ERC-721, `mint()`, `MAX_SUPPLY=4083` |
| **PlatformManager** | `contracts/PlatformManager.sol` | pool80/pool20 split, lifecycle, `recordSweep/Harvest`, `triggerGooglePurchase` |
| **StockVault** | `contracts/StockVault.sol` | `executeGooglePurchase`, `requestRedemption`, `claimRedemption`, 48h delay, 5% fee |
| **InterestDistributor** | `contracts/InterestDistributor.sol` | `fundEqualDistribution`, `claimInterest`, per-round tracking (V2) |
| **GooglonSwapAdapter** | `contracts/GooglonSwapAdapter.sol` | Wraps ETH→WETH, Uniswap V3 `exactInputSingle` WETH→GOOGLon |
| **IGooglonSwap** | `contracts/interfaces/IGooglonSwap.sol` | Interface: `swapEthForGooglon()` |

### Where WETH Is Used

| File | Usage |
|---|---|
| `GooglonSwapAdapter.sol` | Wraps ETH→WETH, approves router, swaps WETH→GOOGLon |
| `admin/page.tsx` (Sweep) | Wraps ETH→WETH, swaps WETH→USDC via Uniswap V3 |
| `admin/page.tsx` (Harvest) | Swaps USDC→WETH, unwraps WETH→ETH for distribution |

### Access Control

| Operation | Who | Contract Check |
|---|---|---|
| Sweep / Harvest / Trigger Purchase | Treasury | `PM.onlySweepOrOwner` |
| Fund Distribution / Allow Claims | Treasury | `ID.onlyTreasuryVault` / `ID.owner` |
| Pause / Resume / Stop Mint | Deployer | `PM/NFT.onlyOwner` |
| Set Mint Price | Deployer | `NFT.onlyOwner` |
| Set GooglonSwap adapter | SV Owner | `SV.onlyOwner` |

---

## Aave V3 Yield Math

Aave has **no** "get yield" function. aUSDC is interest-bearing — its value grows automatically.

```
currentValue = scaledBalance × liquidityIndex / 1e27
yield = currentValue - principalDeposited
```

| Variable | Source |
|---|---|
| `scaledBalance` | `aUSDC.scaledBalanceOf(treasury)` |
| `liquidityIndex` | `Pool.getReserveData(USDC).liquidityIndex` |
| `principalDeposited` | Tracked off-chain / PM |

**Harvest:** `aavePool.withdraw(USDC, yieldAmount, treasury)` — not `claimYieldTo()` (that's a mock-only function).

---

## Loyalty Bot

Monitors treasury ETH via Etherscan V2 API. Any transfer NOT from our contracts → loyalty fee → records on-chain via `pm.receiveLoyalty()`.

| Config | Value |
|---|---|
| `LOYALTY_CHAIN_ID` | `1` |
| `LOYALTY_POLL_MS` | `30000` |
| API | `https://api.etherscan.io/v2/api?chainid=1` |
| Storage | `backend/data/loyalty-fees.json` + `loyalty-state.json` (persistent disk) |

---

## Mint Price Bot

Reads CoinGecko ETH/USD, sets `NFT.mintPrice` so 1 mint = `$TARGET_USD_PER_MINT` (default $10).

```
mintPrice (ETH) = TARGET_USD_PER_MINT / ETH_USD_price
```

---

## IRYS (Arweave) — NFT Metadata

Uploads per-token SVG certificates to Arweave via IRYS. **Already configured for mainnet** — no changes needed.

| Config | Value | Where |
|---|---|---|
| Network | `mainnet` | `backend/.env` → `IRYS_NETWORK=mainnet` |
| Gateway | `https://gateway.irys.xyz` | `GoogleStockNFT.sol` immutable `irysGateway`, `constants.ts` `CERT_GATEWAY` |
| NFT tokenURI | `https://gateway.irys.xyz/mutable/<txId>` | Generated by `GoogleStockNFT.tokenURI()` |
| Template | `https://gateway.irys.xyz/DZqDgm2LqH8pDXTtuC7uUByYPaCHiibmR3vQtbBf17DK` | Pre-uploaded certificate template PNG |
| **Auto-fund** | Bot sends 0.004 ETH when balance < 0.002 ETH (`minBalance: 0.002, fundAmount: 0.004, multiplier: 1.0`) |

**Flow:** `NFTMinted` event → IRYS bot detects → generates PNG (Sharp) → uploads to Arweave mainnet → calls `NFT.setIrysTxId(tokenId, arweaveTxId)` → `tokenURI()` returns the permanent Arweave URL.

**Timing:** ~5-15 seconds after mint (poll interval + upload). `tokenURI()` returns `""` until the IRYS bot processes the event.

---

## Mint — Verified & Fixed (2026-06-23)

### Mint Flow

```
User → NFT.mint(googlPrice) {value: mintPrice}
  ├─ Guards: mintActive, _nextMintId ≤ 4083, msg.value == mintPrice
  ├─ treasuryEOA.call{value} — ETH sent to Treasury
  ├─ PM.recordMint(msg.value) — 80% pool80, 20% pool20
  ├─ Records: mintPrincipal, googlPriceAtMint, mintTimestamp, interestStartTimestamp
  ├─ _nextMintId incremented (checks-effects-interactions: after external calls)
  ├─ _safeMint(msg.sender, tokenId)
  └─ Auto-stop when _nextMintId > 4083
```

### Verified on-chain state (mint page)

| State | Source | Method |
|---|---|---|
| `mintActive` | `NFT.mintActive()` | On-chain call |
| `contractMintPrice` | `NFT.mintPrice()` | On-chain call |
| `totalMinted` | `NFT.totalSupply()` | ERC721Enumerable — exact count |
| `totalBurned` | `PM.totalBurned()` | On-chain call |
| `MAX_SUPPLY` | `NFT_CONFIG.MAX_SUPPLY` | Env var (4083) |

### Recent Fixes

| Bug | Fix | Date |
|---|---|---|
| Progress bar hardcoded `100` | → `NFT_CONFIG.MAX_SUPPLY` (4083) | 2026-06-23 |
| `totalMinted` from `totalMintPrincipal / mintPrice` | → `NFT.totalSupply()` (exact on-chain) | 2026-06-23 |
| `_nextMintId++` before external calls | → Increment moved after `treasuryEOA.call` + `PM.recordMint`, before `_safeMint` | 2026-06-23 |

### DeFi — Verified & Fixed (2026-06-23)

| Fix | Detail |
|---|---|
| **Harvest input bar** | Admin enters USDC amount to withdraw. Validated against current Aave position. Prevents accidental full-position withdrawal |
| **Aave position display** | UI shows `scaledBalance × liquidityIndex / 1e27` as current position value (not hardcoded "0") |
| **Slippage protection** | Harvest swap uses 1% `amountOutMinimum` on Uniswap. Sweep uses market rate with 1% buffer |
| **Pool fee configurable** | `NEXT_PUBLIC_UNISWAP_POOL_FEE` env var (default 500 = 0.05%) |
| **`.call{value}` for claims** | Replaced `.transfer()` with `.call{value: amount}("")` — safe for Safe/Argent smart wallets |
| **Interest dust** | `withdrawExcess()` guarded by `address(this).balance - interestPool` — can only withdraw excess above what's owed |
| **allowClaims() one-shot** | Intentional — claims permanently open after first distribution |

---

## Render Deployment

Monorepo — one GitHub repo, two Render services:

| | Frontend | Backend |
|---|---|---|
| **Root Dir** | `frontend` | `backend` |
| **Build** | `pnpm install && pnpm build` | `pnpm install && pnpm build` |
| **Start** | `pnpm start` | `pnpm start` |
| **Disk** | none | `/data` → `backend/data` (persistent) |
| **Env** | `NEXT_PUBLIC_*` | `PRIVATE_KEY`, `RPC_URL`, contract addresses, etc. |

---

## Build & Deploy

```bash
# Compile
npx hardhat compile

# Deploy to mainnet
npx hardhat run scripts/deploy-mainnet.ts --network mainnet

# Verify on Etherscan
npx hardhat verify --network mainnet <address> <constructor args>

# Update configs after deploy:
#   1. frontend/.env.local  (NEXT_PUBLIC_* addresses)
#   2. backend/.env          (contract addresses + keys)
#   3. deployed.json         (auto-saved)
#   4. This SKILL.md         (address table above)

# Local dev
pnpm --dir frontend dev
pnpm --dir backend start
```

---

## Project Structure

```
GoogleStockNFT/
├── contracts/
│   ├── GoogleStockNFT.sol
│   ├── PlatformManager.sol
│   ├── StockVault.sol
│   ├── InterestDistributor.sol
│   ├── GooglonSwapAdapter.sol
│   └── interfaces/
│       └── IGooglonSwap.sol
├── frontend/            # Next.js + wagmi + RainbowKit
│   ├── .env.local        # Mainnet config (gitignored)
│   └── src/
│       ├── app/admin/    # Admin panel (sweep, harvest, purchase, mint controls)
│       ├── app/mint/     # NFT minting page
│       └── lib/          # contracts.ts, constants.ts, wagmi.ts
├── backend/             # Express + IRYS + bots
│   ├── .env              # Mainnet config (gitignored)
│   └── src/
│       ├── config.ts
│       └── services/
│           ├── loyalty-bot.ts      # Etherscan V2 → on-chain loyalty
│           ├── mint-price-bot.ts   # CoinGecko → on-chain mintPrice
│           └── irys.service.ts     # NFT events → Arweave certs
├── scripts/
│   └── deploy-mainnet.ts  # ONLY deploy script
└── hardhat.config.ts
```

---

## Quick Debug Commands

```javascript
// PlatformManager state
const pm = new ethers.Contract(pmAddr, [
  'function pool80() view returns (uint256)',
  'function pool20() view returns (uint256)',
  'function totalMintPrincipal() view returns (uint256)',
  'function totalDeFiPrincipal() view returns (uint256)',
  'function totalLoyaltyFees() view returns (uint256)',
], provider);

// Aave V3 yield
const aave = new ethers.Contract(aaveAddr, [
  'function getReserveData(address) view returns (tuple(...))',
], provider);
const aToken = new ethers.Contract(aTokenAddr, [
  'function scaledBalanceOf(address) view returns (uint256)',
], provider);

// StockVault
const sv = new ethers.Contract(svAddr, [
  'function purchaseComplete() view returns (bool)',
  'function totalGooglonHeld() view returns (uint256)',
  'function getShares(uint256) view returns (uint256)',
  'function redemptionRequest(uint256) view returns (uint48)',
], provider);
```
