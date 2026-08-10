# Robinhood Mainnet Plan — Google Stock NFT V2

> Last updated: 2026-07-20  
> Status: **Contracts complete + tested on testnet. Frontend / backend next.**

---

## 1. Key Mainnet Addresses

| Contract | Address | Notes |
|---|---|---|
| **GOOGL** (Alphabet Class A) | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | Robinhood Token, BeaconProxy |
| **USDG** (Stablecoin) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Paxos stablecoin |
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Wrapped ETH |
| **SwapRouter02** | `0xcaf681a66d020601342297493863e78c959e5cb2` | Uniswap V3 |
| **UniswapV3Factory** | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` | Pool factory |
| **QuoterV2** | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` | Price quotes |

### Uniswap V3 Fee Tiers

| Fee | BPS | Use |
|---|---|---|
| 0.01% | 100 | Very stable pairs |
| 0.05% | 500 | Stable pairs (USDG/WETH) |
| 0.3% | 3000 | Standard pairs |
| 1% | 10000 | Volatile pairs (GOOGL) |

> ⚠️ GOOGL is likely 1% (10000) tier. Need to verify pool exists and has liquidity before mainnet deploy.

---

## 2. What We Deploy

| # | Contract | Constructor Args |
|---|---|---|
| 1 | **OurToken** | `(owner)` — deployed after mint-out |
| 2 | **PlatformManager** | `(owner, treasuryEOA)` |
| 3 | **StockVault** | `(usdgToken, googlToken, swapRouter, owner, treasuryEOA)` |
| 4 | **GoogleStockNFT** | `(owner, usdgToken, treasuryEOA)` |
| 5 | **Whitelist** | `(owner, merkleRoot)` — after WL collection |
| 6 | **DiamondHands** | `(owner, nftAddress)` |

### Post-Deploy Wiring

```
1. PM.setGoogleStockNFT(nft)
2. PM.setStockVault(sv)
3. SV.setPlatformManager(pm)
4. SV.setGoogleStockNFT(nft)
5. SV.setOurToken(ourToken)
6. SV.setSwapPath(usdgToGooglPath)     // Uniswap V3 path: USDG → fee → GOOGL
7. NFT.setPlatformManager(pm)
8. NFT.setStockVault(sv)
9. NFT.setWhitelist(wl)                // or setWhitelistRoot(root)
10. PM.openWhitelist()                 // Start Phase 1
```

### Uniswap V3 Swap Path

The `usdgToGooglPath` is encoded as:
```
USDG (20 bytes) + fee (3 bytes) + WETH (20 bytes) + fee (3 bytes) + GOOGL (20 bytes)
```

Example (if route is USDG → WETH → GOOGL):
```
0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 + 0001F4 + 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 + 002710 + 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3
```

Or if direct USDG → GOOGL pool exists:
```
0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 + fee + 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3
```

Use QuoterV2 to determine which route exists and has best liquidity.

---

## 3. Pre-Flight Checklist

### Keys & Funding
- [ ] Generate **fresh** deployer private key (hardware wallet or new hot wallet)
- [ ] Generate **fresh** treasury EOA (never used on testnet)
- [ ] Fund deployer with ETH for gas
- [ ] Fund treasury with ETH for operations

### GOOGL Token
- [ ] Verify Uniswap V3 pool exists and has liquidity
- [ ] Determine fee tier (likely 10000 = 1%)
- [ ] Test swap quoting via QuoterV2
- [ ] Set swap path on StockVault

### USDG
- [ ] Verify USDG contract at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
- [ ] Confirm 6 decimals
- [ ] Confirm users can acquire USDG on Robinhood Chain

### Contract Verification
- [ ] `GoogleStockNFT.MAX_SUPPLY = 4083` ✅ (in code)
- [ ] `GoogleStockNFT.WL_PRICE = 4_000_000` (4 USDG) ✅
- [ ] `GoogleStockNFT.PUBLIC_PRICE = 6_000_000` (6 USDG) ✅
- [ ] `StockVault.redemptionDelay = 48 hours` ✅
- [ ] `StockVault.REDEMPTION_FEE_BPS = 500` (5%) ✅
- [ ] No mock contracts deployed on mainnet
- [ ] No test-only addresses in code

### WL Collection (Phase 1 prep)
- [ ] Twitter verification backend running
- [ ] WL list finalized → Merkle tree generated
- [ ] Merkle root deployed to Whitelist contract (or set on NFT)
- [ ] Phase 1: 1,500 NFTs at 4 USDG

### Env Files
- [ ] `frontend/.env.local` — all `NEXT_PUBLIC_*` filled with mainnet addresses
- [ ] `backend/.env` — `PRIVATE_KEY`, `RPC_URL`, contract addresses
- [ ] `backend/.env` — `IRYS_NETWORK=mainnet`
- [ ] `backend/.env` — Blockscout API key set
- [ ] `IRYS_PRIVATE_KEY` set for Arweave uploads
- [ ] Pre-fund IRYS with ETH for uploads

---

## 4. Render Deployment

| Service | Root | Start | Disk |
|---|---|---|---|
| Frontend | `frontend` | `pnpm start` | none |
| Backend | `backend` | `pnpm start` | `/data` → `backend/data` |

Single GitHub repo, two Web Services. Push = both redeploy.

---

## 5. Mainnet Sequence

```
1. Deploy PlatformManager + StockVault + GoogleStockNFT
2. Wire all contracts (see wiring above)
3. Set swap path on StockVault
4. Open whitelist phase (PM.openWhitelist())
5. WL users mint (1,500 NFTs at 4 USDG)
6. Open public phase (PM.openPublic())
7. Public users mint (2,583 NFTs at 6 USDG)
8. End mint (PM.endMint())
9. Deploy OurToken (1B supply)
10. Fund StockVault.Phase1 with 50% NFT allocation
11. Open Phase 1 redemption (SV.openPhase1())
12. Trigger GOOGL purchase (PM.triggerGooglePurchase())
13. Users redeem Phase 1 (OurToken) + Phase 2 (GOOGL)
```

---

## 6. Robinhood Chain — Specific Risks & Mitigations

### 6.1 Sequencer Downtime

Robinhood Chain runs a **single sequencer** (Arbitrum Orbit). If it stalls:

| Scenario | Impact | Mitigation |
|---|---|---|
| During WL/Public mint | Users can't mint | Communicate on Twitter/Discord. No financial loss — mint resumes when sequencer recovers |
| During GOOGL purchase trigger | Treasury TX can't execute | Treasury waits for recovery. No automation — manual trigger means human checks first |
| During claim windows | Users can't claim | Assets safe in StockVault. Claims resume when sequencer recovers |
| Diamond Hands 7-day window | Clock still ticks (`block.timestamp`) | Holders can claim after recovery. Window doesn't reset |

**Admin page: add sequencer status indicator.** Use Chainlink's L2 Sequencer Uptime Feed if available on Robinhood, or a simple heuristic (check if last block is within 5 minutes).

Reference: Chainlink Sequencer Uptime Feed — check if deployed on Robinhood Chain mainnet. If available, read via `AggregatorV3Interface`.

### 6.2 Tokenized Stock Behavior

GOOGL is a Robinhood token representing Alphabet Class A stock:

- **Trades 24/7 on-chain** but the real stock trades market hours only (Mon-Fri 9:30am-4pm ET, plus after-hours)
- **Not equity** — debt security issued by Robinhood's Jersey entity. Economic exposure only, no voting rights
- **Depeg/counterparty risk** — if Robinhood or the Jersey entity fails, GOOGL value could decouple from actual GOOGL stock

| Risk | Our Mitigation |
|---|---|
| Stale price during closed market | GOOGL purchase is **manual**, triggered by treasury. Treasury checks market conditions before clicking |
| Depeg | We hold GOOGL temporarily in StockVault before distribution. Hold period is short (days not weeks) |
| Counterparty failure | Users redeem GOOGL from StockVault within the claim window. After that, they hold GOOGL directly |

**Disclosure:** Users should understand GOOGL is not a stock share — it's a tokenized debt instrument. This should be stated in our docs and mint page disclaimer.

### 6.3 Corporate Actions (Dividends, Splits)

GOOGL uses [ERC-8056](https://eips.ethereum.org/EIPS/eip-8056) for corporate actions. The token has an on-chain multiplier that adjusts for splits and dividends. The price feed may pause during updates.

| Concern | Handling |
|---|---|
| Multiplier changes before GOOGL purchase | Treasury checks `googlToken` multiplier before triggering purchase |
| Price feed pauses during corporate action | Not applicable — we don't use automated price feeds |
| Multiplier changes after GOOGL distribution | Not our concern — holders manage their own GOOGL after claiming |

**Operations procedure:** Before triggering `triggerGooglePurchase()`, Treasury should:
1. Check GOOGL token contract for any pending corporate action multiplier changes
2. Verify Uniswap pool liquidity is adequate
3. Check sequencer is operational (admin page indicator)
4. Execute during market hours for best liquidity

---

## 7. Pre-Mainnet Security Checklist

| # | Item | Status |
|---|---|---|
| 1 | Sequencer downtime handling + admin page indicator | ⬜ Implement in frontend |
| 2 | Market-hours-aware GOOGL purchase (manual, Treasury-gated) | ✅ Architecture |
| 3 | Counterparty/depeg risk disclosed in docs | ⬜ Add to documentation |
| 4 | Corporate action monitoring procedure | ✅ Added above |
| 5 | No bridges — zero bridge attack surface | ✅ |
| 6 | Reentrancy guards on all claim functions | ✅ `nonReentrant` |
| 7 | Access control: `onlyOwner`, treasury-gated, PM-gated | ✅ Applied |
| 8 | Checks-Effects-Interactions pattern | ✅ All claim functions |
| 9 | No upgradeable proxies | ✅ All immutable/one-time settable |
| 10 | External audit (pre-mainnet) | ⬜ Required |
| 11 | Fresh deployer + treasury keys (never used on testnet) | ⬜ Generate before mainnet |
| 12 | Mainnet GOOGL pool liquidity verified | ⬜ Before swap path config |
