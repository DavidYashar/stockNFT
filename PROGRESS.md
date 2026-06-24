# Google Stock NFT — Project Progress Notes

> **Last Updated:** 2026-06-15
> **Status:** ⏳ V20 Ready — All fixes applied, waiting for redeploy

---

## Quick Status

| Layer | Status | Detail |
|-------|--------|--------|
| Smart Contracts (5 + 1 mock) | ✅ V20 Ready | All 10+ bugs fixed, compiled clean |
| Backend Bots | ✅ V20 Ready | 30min test intervals, yield harvester fixed |
| Frontend (Next.js) | ✅ V20 Ready | Config consolidated, env support added |
| Deploy Script | ✅ V20 Ready | 17-point wiring, MockAUsdc auto-deploy |
| End-to-end Test | ⏳ Pending | After V20 redeploy |

---

## V20 Changes (June 15) — ALL FIXES APPLIED

### 🐛 Bugs Fixed (10 total across contracts + frontend)

| # | Bug | Fix |
|---|-----|-----|
| 1 | `setAUsdcToken` locked forever → MockUSDC broke `currentDeFiBalance()` | Removed "Already set" guard, now re-settable |
| 2 | `currentDeFiBalance()` read pool80 as fake DeFi balance | Deployed `MockAUsdc` (zero supply) → bal=0 path works |
| 3 | `harvestAndDistribute()` double-dips same yield | Added `lastHarvestYieldIndex` tracking |
| 4 | `claimRedemption` anyone could call → theft | Added `redemptionRequester` mapping |
| 5 | `resetInterestClock` no access control → griefing | Now requires `owner \|\| PM \|\| ID` |
| 6 | `emergencyWithdrawFromAave` always reverted with MockAUsdc | Checks `totalDeFiPrincipal > 0` instead |
| 7 | `tokenURI` hardcoded mainnet IRYS gateway | Added `irysGateway` state var + setter |
| 8 | `REDEMPTION_DELAY` hardcoded 48s | Made configurable `redemptionDelay` + setter |
| 9 | Redemption fee went to `owner()` instead of platform | Added `feeRecipient` setter |
| 10 | Interest rate was 2%, should be 3.9% | Changed `ANNUAL_RATE_BPS` 200→390 |

### 🏗 Frontend Changes

| Change | Detail |
|--------|--------|
| Constants file | Created `frontend/src/lib/constants.ts` — single source of truth |
| Env support | `NEXT_PUBLIC_*` vars for all configurable values |
| Frontend env file | Created `frontend/.env.local` with all 9 contract addresses + config |
| Hardcoded values | Removed all magic numbers (gas limits, decimals, fees, wait times) |
| Admin page | Fixed DeFi balance display, uses on-chain `currentDeFiBalance()` |
| Dashboard | Added USDC approval banner for transfers |
| Certificate coords | De-duplicated across frontend + backend |

### 📋 Deploy Script

| Change | Detail |
|--------|--------|
| MockAUsdc | Auto-deployed + wired as `tv.setAUsdcToken()` |
| Wiring | 17 calls total (was 16, added `nft.setInterestDistributor()`) |
| Output | Includes `ausdc` address in `deployed.json` |

---

## ⏳ Remaining Tasks (V20.2+)

### 🔴 High Priority
- [ ] **Redeploy V20 on Sepolia** — all contracts fresh
- [ ] **Update all 3 env files** with new addresses
- [ ] **End-to-end test** — mint → sweep → force yield → harvest → claim interest → redeem

### 🟠 Medium Priority
- [ ] **Marketplace / Loyalty Fee fix** — remove 1 USDC fee from `_update`, use EIP-2981 for marketplaces, build marketplace contract for flat fee collection (see memory for full details)

### 🟡 Low Priority
- [ ] `settleOnTransfer` cleanup — removed from InterestDistributor but NFT should handle forfeiture explicitly
- [ ] Mainnet `REDEMPTION_DELAY` — change to 48 hours before production deploy
- [ ] WalletConnect projectId — replace placeholder `"google-stock-nft"`

---

## Sepolia V19 Deployed Addresses (2026-06-15) — SUPERSEDED

| Contract | Address |
|----------|---------|
| GoogleStockNFT | `0xb52657693449C6002fC41a1c8aF40C3f54F2ecd0` |
| TreasuryVault | `0xB674574bfE8b57DEfC6288C83306EAaDc792D18a` |
| StockVault | `0x296D842528a9b7e537C2e13a0B6d1a5168B524bE` |
| PlatformManager | `0x274C1eB409e6A5850Fb45b6f3741E44Fdf9453bD` |
| InterestDistributor | `0x827d4C1c7105dBf8F6CfA11bF1404b5bB6A7f21f` |
| MockUSDC | `0x6b39A032211bF51D4E166B60E4C30b2F9a2500dD` |
| MockGOOGLon | `0x68540f4A25b6e284aD33A4cf67848c79ABe9fBC5` |
| MockAavePool | `0x224F61E9FCeD1F488b92668b1D535cEcA5CeC555` |

### Config Files to Update on Each Deploy
- `frontend/src/lib/contracts.ts` + `frontend/.env.local`
- `backend/.env`
- `.env` (root)
- **Delete `frontend/.next` cache** after config changes

---

## Key Architecture Notes

- **MockAavePool**: Real Sepolia Aave doesn't support custom USDC → deploy mock
- **MockAUsdc**: Zero-supply token so `currentDeFiBalance()` falls back to `principal × index`
- **80/20 split**: pool80 = Google reserve, pool20 = DeFi (swept to Aave)
- **Harvest**: All yield → InterestDistributor, no platform cut
- **Trigger**: `mintEnded && loyaltyFee ≥ gap20` → one-time pool80 release
- **Redemption**: Burn NFT → 48s wait → claim GOOGLon minus 5% fee

---

## Remaining for Mainnet

| Task | Priority | Status |
|------|----------|--------|
| Replace `_simulateSwap` with real Uniswap V4 swap | **HIGH** | Placeholder only |
| Change `REDEMPTION_DELAY` to 48 hours | **HIGH** | Currently 48s (test) |
| Real token addresses (USDC, GOOGLon, Aave) | **HIGH** | Mock addresses in .env |
| Interest formula → actual Aave yield | Medium | 2% APR placeholder |
| Events not queryable on public RPC | Low | Use state checks |

## Key Lessons (for memory)

1. **NEVER reuse stateful contracts across deploys** — deploy all fresh
2. **Delete `.next` cache** after every config change
3. **`burnUnminted` advances `_nextMintId`** — call after mint
4. **Decimal precision**: USDC=6, GOOGLon=18 — price denominator must match USDC
5. **Auth gates**: `burnForRedemption` needs StockVault; use `_update` to bypass `_burn` auth
6. **Frontend**: use `getShares()` not `nftShares()`; localStorage for post-burn tracking
