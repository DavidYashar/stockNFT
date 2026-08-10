# Google Stock NFT V2 — Full Lifecycle

> Last updated: 2026-07-19
> Chain: Robinhood Chain (Arbitrum Orbit L2)
> ERC-6551 Registry: `0x000000006551c19487814612e58FE06813775758` ✅ Deployed

---

## Table of Contents

1. [Token Summary](#1-token-summary)
2. [Contract Roles](#2-contract-roles)
3. [Phase 0: Setup & Deploy](#3-phase-0-setup--deploy)
4. [Phase 1: Mint (Whitelist + Public)](#4-phase-1-mint-whitelist--public)
5. [Phase 2: Mint Ends](#5-phase-2-mint-ends)
6. [Phase 3: GOOGL Purchase](#6-phase-3-googl-purchase)
7. [Phase 4: $G-Pass Token Deploy](#7-phase-4-g-pass-token-deploy)
8. [Phase 5: LP Creation](#8-phase-5-lp-creation)
9. [Phase 6: $G-Pass Claim (Token Redemption)](#9-phase-6-g-pass-claim-token-redemption)
10. [Phase 7: GOOGL Claim (Stock Redemption)](#10-phase-7-googl-claim-stock-redemption)
11. [Phase 8: Diamond Hands Rewards](#11-phase-8-diamond-hands-rewards)
12. [Post-Claim: NFT Final State](#12-post-claim-nft-final-state)
13. [Asset Flow Summary](#13-asset-flow-summary)
14. [Admin Operations Reference](#14-admin-operations-reference)

---

## 1. Token Summary

| Token | Type | Contract | Details |
|---|---|---|---|
| **GoogleStockNFT** | ERC-721 | `GoogleStockNFT.sol` | 4,083 max supply. WL: 4 USDG, Public: 6 USDG. Merkle whitelist. |
| **$G-Pass** | ERC-20 | `OurToken.sol` | 1B supply, 6 decimals. Fully minted at deploy. 5-way allocation. |
| **GOOGL** | ERC-20 (external) | Robinhood Token | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3`. Purchased via Uniswap V3. |
| **USDG** | ERC-20 (external) | Paxos Stablecoin | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Payment token for mint. |

### $G-Pass Allocation (1,000,000,000 total)

| Allocation | Amount | Recipient | Claim |
|---|---|---|---|
| NFT Holders | 500M (50%) | StockVault | Equal per NFT via `claimOurToken()` |
| Liquidity Pool | 150M (15%) | LP Reserve | Paired with 20% USDG mint fees |
| Team | 100M (10%) | Treasury EOA | Admin button |
| Ecosystem Partners | 100M (10%) | Partner address | Admin button |
| Diamond Hands | 150M (15%) | DiamondHands contract | Time-based NFT holding |

---

## 2. Contract Roles

| Contract | Purpose |
|---|---|
| **GoogleStockNFT** | ERC-721 mint. Two-phase pricing. Merkle whitelist. Soulbound tracking. |
| **PlatformManager** | Phase state machine. Mint accounting. Loyalty tracking. Trigger gate. |
| **StockVault** | Receives 80% USDG. GOOGL purchase (inline Uniswap V3). Two-phase claims via TBA. |
| **OurToken** | $G-Pass ERC-20. Fully minted at deploy. Not mintable. |
| **ERC6551Account** | TBA implementation. Deployed once. Registry creates minimal proxies per NFT. |
| **DiamondHands** | Time-based $G-Pass rewards for NFT holders. |

### Key Addresses

| Name | Address |
|---|---|
| ERC-6551 Registry | `0x000000006551c19487814612e58FE06813775758` |
| SwapRouter02 (Uniswap V3) | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| NonfungiblePositionManager | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |
| UniswapV3Factory | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| GOOGL Token | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` |
| USDG Token | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |

---

## 3. Phase 0: Setup & Deploy

### Deploy Order

```
1. Deploy ERC6551Account implementation     (once, ~1M gas)
2. Deploy PlatformManager(owner, treasury)
3. Deploy StockVault(usdg, googl, swapRouter, owner, treasury)
4. Deploy GoogleStockNFT(owner, usdg, treasury)
```

### Wiring (17 calls)

```
 5. StockVault.setPlatformManager(pm)
 6. StockVault.setGoogleStockNFT(nft)
 7. GoogleStockNFT.setPlatformManager(pm)
 8. GoogleStockNFT.setStockVault(sv)
 9. PlatformManager.setGoogleStockNFT(nft)
10. PlatformManager.setStockVault(sv)
11. PlatformManager.setERC6551(registry, erc6551Impl)
12. StockVault.setSwapPath(usdgToGooglPath)
```

---

## 4. Phase 1: Mint (Whitelist + Public)

### State Before

```
PlatformManager.mintPhase = WHITELIST (or PUBLIC)
GoogleStockNFT.mintActive = true
```

### Whitelist Mint Flow

```
User calls: GoogleStockNFT.mint(googlPrice, merkleProof)
  │
  ├─ 1. Reads phase from PlatformManager → WHITELIST (phase=1)
  ├─ 2. Verifies Merkle proof against whitelist root
  ├─ 3. Requires 4 USDG (WL_PRICE)
  ├─ 4. Pulls USDG from user via transferFrom
  ├─ 5. Sends 80% (3.20 USDG) → StockVault
  ├─ 6. Sends 20% (0.80 USDG) → Treasury EOA
  ├─ 7. Calls PlatformManager.recordMint(4.00 USDG)
  ├─ 8. Mints NFT to user
  └─ 9. Emits NFTMinted(tokenId, owner, 4.00, googlPrice)
```

### Public Mint Flow

```
User calls: GoogleStockNFT.mint(googlPrice, [])   // empty proof
  │
  ├─ 1. Reads phase from PlatformManager → PUBLIC (phase=2)
  ├─ 2. No whitelist check needed
  ├─ 3. Requires 6 USDG (PUBLIC_PRICE)
  ├─ 4. Pulls USDG from user via transferFrom
  ├─ 5. Sends 80% (4.80 USDG) → StockVault
  ├─ 6. Sends 20% (1.20 USDG) → Treasury EOA
  ├─ 7. Calls PlatformManager.recordMint(6.00 USDG)
  ├─ 8. Mints NFT to user
  └─ 9. Emits NFTMinted(tokenId, owner, 6.00, googlPrice)
```

### State After Example (1,000 NFTs)

```
StockVault USDG balance:         ~4,600 USDG (80% of all mints)
Treasury EOA USDG balance:       ~1,150 USDG (20% of all mints)
PlatformManager.stockPool:       ~4,600
PlatformManager.tokenPool:       ~1,150
GoogleStockNFT.totalSupply():    1,000

Each NFT has:
  • mintPrincipal[id] = 4 or 6 USDG (what user paid)
  • googlPriceAtMint[id] = GOOGL price at mint time
  • mintTimestamp[id] = when minted
```

### TBA Status at This Point

```
TBA for each NFT: NOT YET DEPLOYED
  → Address is deterministic and known
  → But no code exists on-chain
  → Zero gas spent on TBAs
```

---

## 5. Phase 2: Mint Ends

Admin (owner) calls:

```
PlatformManager.endMint()
  → Sets mintEnded = true
  → Sets mintPhase = ENDED
  → Calls GoogleStockNFT.stopMint()

OR if burning remaining supply:

PlatformManager.stopMintAndBurn(remaining)
  → Burns unminted supply
  → Sets mintEnded = true
  → Sets mintPhase = ENDED
```

### State After

```
mintEnded = true
mintPhase = ENDED
mintActive = false

No more NFTs can be minted.
```

---

## 6. Phase 3: GOOGL Purchase

### Prerequisites

- [ ] Mint has ended (`mintEnded == true`)
- [ ] StockVault holds 80% of all mint fees in USDG

### Admin Action

Treasury wallet connects → Admin page → clicks **"Purchase Google Shares"**

```
PlatformManager.triggerGooglePurchase(minGooglOut)
  │
  ├─ Checks: mintEnded && !triggerFired
  ├─ Sets: triggerFired = true
  └─ Calls: StockVault.executeGooglePurchase(stockPool, minGooglOut)
       │
       ├─ Checks: purchaseComplete == false
       ├─ Checks: USDG balance >= stockPool
       ├─ Approves Uniswap SwapRouter for USDG
       ├─ Calls: SwapRouter02.exactInput(path: USDG→GOOGL, amount: stockPool)
       ├─ Receives: GOOGL tokens
       ├─ Sets: purchaseComplete = true
       ├─ Sets: totalGooglonHeld = googlReceived
       ├─ Refunds dust USDG to Treasury
       └─ Emits: PurchaseExecuted(stockPool, googlReceived)
```

### State After

```
StockVault:
  USDG:  0 (all spent on GOOGL)
  GOOGL: X (total purchased, e.g. ~25 GOOGL)

Each NFT's share (dynamic, computed on-chain):
  getShares(tokenId) = totalGooglonHeld × mintPrincipal[tokenId] / totalMintPrincipal

Example:
  Total raised: 5,600 USDG
  GOOGL purchased: 25 GOOGL
  NFT #42 paid 6 USDG
  → Share = 25 × 6 / 5600 = 0.02678 GOOGL
```

**Users can SEE their GOOGL entitlement but CANNOT claim yet.** The `googlClaimable` flag is not yet set.

---

## 7. Phase 4: $G-Pass Token Deploy

### Token Details

| Attribute | Value |
|---|---|
| Name | Google Stock Passport |
| Ticker | $G-Pass |
| Supply | 1,000,000,000 (1B) |
| Decimals | 6 |
| Mintable | ❌ No — fully pre-minted |

### Deployment

```
Deploy OurToken with constructor arguments:
  • nftHoldersAllocation:   500,000,000 → sent to StockVault
  • lpAllocation:           150,000,000 → sent to LP Reserve address
  • teamAllocation:         100,000,000 → sent to Treasury EOA
  • ecosystemAllocation:    100,000,000 → sent to Partner address
  • diamondHandsAllocation: 150,000,000 → sent to DiamondHands contract
```

All tokens are minted at construction. No `mint()` function. Fully immutable supply.

### Admin: Fund Phase 1 Claims

```
Owner/Admin calls: StockVault.fundPhase1(500,000,000)
  → Transfers 500M $G-Pass from deployer to StockVault
  → Sets totalOurTokenForRedemption = 500,000,000
  → These are the tokens NFT holders will claim
```

---

## 8. Phase 5: LP Creation

### What You Have

| Asset | Amount | Location |
|---|---|---|
| USDG | ~1,150 (20% of mint fees) | Treasury EOA |
| $G-Pass | 150,000,000 (15% of supply) | LP Reserve |

### Mechanism

Use Uniswap V3 `NonfungiblePositionManager` to create a full-range liquidity position:

```
1. Treasury EOA approves NonfungiblePositionManager for:
   • USDG: ~1,150
   • $G-Pass: 150,000,000

2. Call NonfungiblePositionManager.mint():
   struct MintParams {
     address token0;           // $G-Pass (lower address)
     address token1;           // USDG
     uint24  fee;              // 10000 (1%) — new token, volatile
     int24   tickLower;        // MIN_TICK (full range)
     int24   tickUpper;        // MAX_TICK (full range)
     uint256 amount0Desired;   // 150,000,000
     uint256 amount1Desired;   // ~1,150 USDG
     uint256 amount0Min;       // 148,500,000 (1% slippage)
     uint256 amount1Min;       // ~1,138 (1% slippage)
     uint256 deadline;         // block.timestamp + 300
   }

3. Result:
   • LP NFT minted to Treasury EOA
   • Pool: $G-Pass / USDG live on Uniswap V3
   • $G-Pass is now tradable
```

**This is a one-time admin operation** — a script, not a contract function. Treasury holds the LP NFT and earns trading fees.

### State After

```
Uniswap V3 Pool:  150M $G-Pass + ~1,150 USDG
Treasury EOA:     LP NFT (representing the position)
$G-Pass:          NOW TRADABLE on Robinhood Chain
```

---

## 9. Phase 6: $G-Pass Claim (Token Redemption)

### Admin Opens Phase 1

```
Admin calls: StockVault.openPhase1()
  → Sets phase1Open = true
```

### User Claims $G-Pass

Each NFT holder can now claim their proportional share of the 500M $G-Pass pool.

**First claim per NFT** (TBA NOT yet deployed):

```
User calls: StockVault.claimOurToken(tokenId)
  │
  ├─ 1. Checks: phase1Open == true
  ├─ 2. Checks: ourTokenClaimed[tokenId] == false
  ├─ 3. Checks: ownerOf(tokenId) == msg.sender (fresh on-chain read)
  ├─ 4. Calculates share:
  │     _getOurTokenShare = totalOurTokenForRedemption × mintPrincipal[id] / totalMintPrincipal
  │
  ├─ 5. Sets state BEFORE external calls:
  │     ourTokenClaimed[tokenId] = true
  │
  ├─ 6. Deploys TBA (one-time, ~250k gas):
  │     address tba = registry.createAccount(erc6551Impl, 0, chainId, nft, tokenId)
  │     → ERC-1167 minimal proxy created
  │     → initialize(nft, tokenId) called
  │     → TBA now has code on-chain
  │
  ├─ 7. Sends $G-Pass to TBA:
  │     ourToken.safeTransfer(tba, share)
  │
  └─ 8. Emits: Phase1Claimed(tokenId, user, tba, share)
```

**Second claim per NFT** (TBA already deployed):

```
User calls: StockVault.claimOurToken(tokenId)
  │
  ├─ ... same checks ...
  ├─ 5. ourTokenClaimed[tokenId] = true
  ├─ 6. TBA already exists → skip deployment (~80k gas)
  ├─ 7. ourToken.safeTransfer(tba, share)
  └─ 8. Emits Phase1Claimed(...)
```

### What the User Sees

```
AFTER CLAIM:
  ┌──────────────────────────────┐
  │ NFT #42                      │
  │ Owner: you                   │
  │                              │
  │ ┌──────────────────────────┐ │
  │ │ TBA_42 (0xBEEF...)       │ │
  │ │                          │ │
  │ │ $G-Pass: 500,000.0       │ │
  │ │ GOOGL:   0.02678 (locked)│ │
  │ └──────────────────────────┘ │
  └──────────────────────────────┘

  $G-Pass sits in the TBA — NOT in user's wallet yet.
```

### Withdrawing $G-Pass to Wallet

```
User calls: StockVault.withdrawFromTBA(tokenId, ourTokenAddress, amount)
  │
  ├─ Checks: ownerOf(tokenId) == msg.sender
  ├─ Checks: TBA is deployed
  └─ Calls: TBA.executeCall(ourToken.transfer(user, amount))
       → $G-Pass arrives in user's EOA wallet
       → TBA balance decreases
```

### State After (partial claims)

```
NFT #42:  ourTokenClaimed[42] = true    TBA holds 500,000 $G-Pass
NFT #99:  ourTokenClaimed[42] = false   TBA not yet deployed
NFT #100: ourTokenClaimed[100] = true   TBA holds 500,000 $G-Pass

Some NFTs have both $G-Pass and GOOGL (in TBA), some just GOOGL (pending).
$G-Pass is tradable on Uniswap from the moment LP is created.
NFTs are tradable on OpenSea from the moment they're minted.
```

---

## 10. Phase 7: GOOGL Claim (Stock Redemption)

### Admin Opens GOOGL Claims

Treasury wallet connects → Admin page → clicks **"Open GOOGL Claims"**

```
Admin calls: StockVault.openGOOGLClaims()
  → Sets googlClaimable = true
```

### User Claims GOOGL

```
User calls: StockVault.claimGOOGL(tokenId)
  │
  ├─ 1. Checks: purchaseComplete == true
  ├─ 2. Checks: googlClaimable == true
  ├─ 3. Checks: googlClaimed[tokenId] == false
  ├─ 4. Checks: ownerOf(tokenId) == msg.sender
  ├─ 5. Calculates shares:
  │     getShares(tokenId) = totalGooglonHeld × mintPrincipal[id] / totalMintPrincipal
  │
  ├─ 6. Sets state BEFORE external calls:
  │     googlClaimed[tokenId] = true
  │
  ├─ 7. Ensures TBA exists (deploys if first claim ever):
  │     address tba = _ensureTBA(tokenId)
  │
  ├─ 8. Calculates fee:
  │     fee = shares × 500 / 10000        (5%)
  │     toUser = shares - fee
  │
  ├─ 9. Sends GOOGL:
  │     googlToken.safeTransfer(tba, toUser)         → TBA
  │     googlToken.safeTransfer(feeRecipient, fee)   → Treasury (always)
  │
  ├─ 10. If both claims done:
  │      if (ourTokenClaimed[id] && googlClaimed[id])
  │        → GoogleStockNFT.markSoulbound(tokenId)
  │        → NFT becomes non-transferable
  │
  └─ 11. Emits: GOOGLClaimed(tokenId, user, tba, toUser, fee)
```

### What the User Sees

```
AFTER BOTH CLAIMS:
  ┌──────────────────────────────┐
  │ NFT #42 🔒 SOULBOUND         │
  │ Owner: you (forever)         │
  │                              │
  │ ┌──────────────────────────┐ │
  │ │ TBA_42 (0xBEEF...)       │ │
  │ │                          │ │
  │ │ $G-Pass: 500,000.0       │ │ ← if not withdrawn yet
  │ │ GOOGL:   0.02544         │ │ ← minus 5% fee
  │ └──────────────────────────┘ │
  └──────────────────────────────┘

  Both assets in TBA. User withdraws each to wallet via separate TXs.
```

### Withdrawing GOOGL to Wallet

```
User calls: StockVault.withdrawFromTBA(tokenId, googlTokenAddress, amount)
  → TBA.executeCall(googl.transfer(user, amount))
  → GOOGL arrives in user's EOA wallet
```

---

## 11. Phase 8: Diamond Hands Rewards

### Reward Multipliers

| Hold Duration | Multiplier |
|---|---|
| 30 days | 1× |
| 90 days | 2× |
| 180 days | 3× |
| 365 days | 5× |

### Claim Flow

```
User calls: DiamondHands.claimRewards(tokenId)
  │
  ├─ Checks: ownerOf(tokenId) == msg.sender
  ├─ Calculates: heldDays = (now - mintTimestamp[id]) / 1 day
  ├─ Calculates: multiplier from heldDays
  ├─ Calculates: reward = baseReward × multiplier
  ├─ Ensures TBA deployed
  └─ Sends: ourToken.safeTransfer(tba, reward)
```

Rewards go to the TBA (same vault as $G-Pass and GOOGL). User withdraws to wallet when desired.

---

## 12. Post-Claim: NFT Final State

### Three Possible NFT States

```
STATE A: "Fresh NFT"
  • ourTokenClaimed = false
  • googlClaimed = false
  • TBA: not deployed
  • Transferable: yes
  • Visible in TBA: nothing yet
  • Metadata: shows $G-Pass entitlement + GOOGL entitlement

STATE B: "Partially Claimed"
  • ourTokenClaimed = true AND/OR googlClaimed = true
  • TBA: deployed, holds claimed assets
  • Transferable: yes (one claim done, but not both)
  • Visible in TBA: $G-Pass and/or GOOGL
  • Metadata: shows claimed + unclaimed entitlements
  • ⚠️ Buyer gets whatever is still unclaimed + TBA assets

STATE C: "Fully Redeemed — Soulbound"
  • ourTokenClaimed = true AND googlClaimed = true
  • soulbound[tokenId] = true
  • Transferable: NO — blocked by _update hook
  • TBA: deployed, may hold assets (if not withdrawn)
  • NFT becomes a permanent on-chain collectible
  • Metadata: shows "Fully Redeemed" badge
```

### NFT Value Over Time

```
MINT ──────→ CLAIM $G-PASS ────→ CLAIM GOOGL ────→ SOULBOUND
 │                │                    │                │
 │ Value:         │ Value:             │ Value:         │ Value:
 │ • GOOGL share  │ • TBA: $G-Pass     │ • TBA: both    │ • Collectible
 │ • $G-Pass      │ • GOOGL share      │                │ • History
 │ • Tradable     │ • Tradable         │ • Not tradable │ • Permanent
```

---

## 13. Asset Flow Summary

```
                         ┌─────────────────────────┐
                         │      User Wallet        │
                         │  (0xAAA...)             │
                         └───────────┬─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
                    ▼                ▼                 ▼
             ┌────────────┐  ┌────────────┐  ┌────────────────┐
             │  NFT #42   │  │  USDG      │  │  $G-Pass/GOOGL │
             │  ERC-721   │  │  (payment) │  │  (withdrawn)   │
             └─────┬──────┘  └────────────┘  └────────────────┘
                   │
         "controls"
                   │
                   ▼
             ┌──────────────────────┐
             │  TBA_42 (0xBEEF...)  │
             │                      │
             │  ┌────────────────┐  │
             │  │ $G-Pass: 500K  │  │  ← claimed from StockVault
             │  │ GOOGL:  0.025  │  │  ← claimed from StockVault
             │  │ Diamond: 50K   │  │  ← from DiamondHands
             │  └────────────────┘  │
             │                      │
             │  withdrawToWallet()  │  → sends to user EOA
             └──────────────────────┘

WHERE ASSETS COME FROM:
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  StockVault  │     │ DiamondHands │     │   Treasury   │
  │              │     │              │     │              │
  │ Holds:       │     │ Holds:       │     │ Holds:       │
  │ • 80% USDG   │     │ • 150M $GPass│     │ • 20% USDG   │
  │ → GOOGL      │     │              │     │ • 100M $GPass│
  │ • 500M $GPass│     │ Sends→ TBA   │     │ • LP NFT     │
  │              │     │              │     │              │
  │ Sends→ TBA   │     │              │     │ Sends→ LP    │
  └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 14. Admin Operations Reference

| # | Operation | Who | Contract.Function | When |
|---|---|---|---|---|
| 1 | Open Whitelist | Owner | `PM.openWhitelist()` | Before mint starts |
| 2 | Open Public Mint | Owner | `PM.openPublic()` | After WL phase |
| 3 | End Mint | Owner | `PM.endMint()` | After mint-out or early close |
| 4 | Burn Remaining | Owner | `PM.stopMintAndBurn(n)` | If not all minted |
| 5 | Purchase GOOGL | Treasury | `PM.triggerGooglePurchase(minGooglOut)` | After mint ends |
| 6 | Deploy $G-Pass Token | Owner | Deploy `OurToken` with 5 addresses | After mint ends |
| 7 | Fund Phase 1 | Owner | `SV.fundPhase1(500M)` | After token deploy |
| 8 | Create LP | Treasury | Script — call `NonfungiblePositionManager.mint()` | After token deploy |
| 9 | Open $G-Pass Claims | Owner | `SV.openPhase1()` | After funding |
| 10 | Open GOOGL Claims | Treasury | `SV.openGOOGLClaims()` | When ready (TBD) |
| 11 | Send Team Tokens | Treasury | `$GPass.transfer(treasury, 100M)` | After token deploy |
| 12 | Send Ecosystem Tokens | Treasury | `$GPass.transfer(partner, 100M)` | After token deploy |
| 13 | Pause Mint (emergency) | Owner | `PM.pauseMint()` | Anytime during mint |
| 14 | Resume Mint | Owner | `PM.resumeMint()` | After unpausing |

---

## Fee Recipients

| Fee | Rate | Sent To |
|---|---|---|
| GOOGL Redemption Fee | 5% | `feeRecipient` (always Treasury EOA) |
| EIP-2981 Royalty | 10% | `treasuryEOA` (Treasury EOA) |
| Mint Fee Split | 80/20 | 80% → StockVault / 20% → Treasury EOA |
