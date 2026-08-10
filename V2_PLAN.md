# StockNFT V2 — Robinhood Chain Integration

> **Last Updated:** 2026-07-19  
> **Status:** Testnet Development

---

## 1. Network: Robinhood Chain

| Attribute | Mainnet | Testnet |
|---|---|---|
| Chain ID | `4663` | `46630` |
| Type | Arbitrum Orbit L2 | Arbitrum Orbit L2 |
| Gas Token | ETH | ETH |
| RPC (Alchemy) | `https://robinhood-mainnet.g.alchemy.com/v2/{KEY}` | `https://robinhood-testnet.g.alchemy.com/v2/{KEY}` |
| Explorer | `https://robinhoodchain.blockscout.com/` | `https://explorer.testnet.chain.robinhood.com/` |
| Explorer API | `https://robinhoodchain.blockscout.com/api/` | `https://explorer.testnet.chain.robinhood.com/api/` |

---

## 2. Deployed Contracts

### Testnet (Deployed via Foundry)

| Contract | Address | Purpose |
|---|---|---|
| **MockGOOGL** | `0x02f86DcC514C4974A0664f7364F93382997A01F6` | GOOGL ERC-20 mock (Alphabet Class A) |
| **MockUniswapRouter** | `0xA811a7E98359b88b2b0F849180389136524Cf424` | Mock V3 router (fixed rate 0.066 GOOGL/WETH) |
| **Deployer** | `0x2bAFb4513b5e9a8C6BBb9ce063f5b18BF1B2cc1E` | Deployer EOA |

### Testnet External Tokens

| Token | Address | Type |
|---|---|---|
| **USDG** (Stablecoin) | `0x7E955252E15c84f5768B83c41a71F9eba181802F` | Paxos stablecoin |
| **WETH** | `0x7943e237c7F95DA44E0301572D358911207852Fa` | Wrapped ETH |

### Mainnet (Reference — not deployed yet)

| Contract | Address | Type |
|---|---|---|
| **GOOGL** (Alphabet) | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | BeaconProxy → "Stock" impl |
| **USDG** | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Paxos stablecoin |
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Wrapped ETH |
| **SwapRouter02** | `0xcaf681a66d020601342297493863e78c959e5cb2` | Uniswap V3 |
| **UniswapV3Factory** | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` | Pool factory |

### Uniswap V3 Mainnet Deployments

| Contract | Address |
|---|---|
| UniversalRouter | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| QuoterV2 | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| NFT Position Manager | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |

---

## 3. Tokenomics — V2 Model

### Our ERC-20 Token ("STKN" — TBD)

| Attribute | Value |
|---|---|
| **Total Supply** | 1,000,000,000 (1 billion) |
| **Decimals** | 6 |
| **Created** | After NFT mint-out |
| **Funded by** | 20% of all mint fees |

### Token Allocation

| Allocation | % | Amount | Description |
|---|---|---|---|
| **NFT Holders** | 50% | 500,000,000 | Equal per NFT held |
| **Liquidity Pool (LP)** | 15% | 150,000,000 | DEX LP for trading |
| **Team Operations** | 10% | 100,000,000 | Ongoing dev & ops |
| **Ecosystem Partners** | 10% | 100,000,000 | Partner incentives |
| **Diamond Hands** | 15% | 150,000,000 | Time-based NFT holding |

### Mint — Two Phase

| Phase | NFTs | Price | Total Raised |
|---|---|---|---|
| **Phase 1: Whitelist** | 1,500 | 4 USDG | 6,000 USDG |
| **Phase 2: Public** | 2,583 | 6 USDG | 15,498 USDG |
| **Total** | 4,083 | — | 21,498 USDG |

### Fee Split (per mint)

```
Mint Fee (USDG)
      │
      ▼
  Fee Distributor (auto)
      │
  ┌───┴───┐
  ▼       ▼
 80%     20%
  │       │
Stock    Token
Pool     Pool
```

| Pool | % | Phase 1 (4 USDG) | Phase 2 (6 USDG) | Total |
|---|---|---|---|---|
| **Stock (GOOGL)** | 80% | 3.20 USDG | 4.80 USDG | 17,198.40 USDG |
| **Token Buyback** | 20% | 0.80 USDG | 1.20 USDG | 4,299.60 USDG |

### Payment Token

All mint fees are in **USDG** (Robinhood native stablecoin by Paxos), not ETH.

| Attribute | Why USDG |
|---|---|
| Stable value | 1 USDG = $1 — no ETH volatility |
| Native to Robinhood | No bridging needed from Ethereum |
| Simplifies accounting | Fee split in same unit, predictable revenue |

### Whitelist (Phase 1) — Twitter-based Verification

```
User sees mint page
      │
      ▼
"Connect & Verify" button
      │
      ▼
Backend validates via Twitter API:
  ✅ Follow @StockNFT
  ✅ Like pinned post
  ✅ Retweet pinned post
      │
      ▼
Address added to WL database
      │
      ▼
After WL collection period ends:
  → Generate Merkle tree from all WL addresses
  → Deploy Merkle root to Whitelist contract
  → Phase 1 mint opens (1,500 NFTs at 4 USDG)
```

| Component | Details |
|---|---|
| **Twitter verification** | Twitter API v2 (OAuth 2.0). Checks: follow, like, retweet status. |
| **WL database** | Backend stores: `{ twitterId, walletAddress, verified, timestamp }` |
| **Merkle tree** | Generated from final WL address list. Root deployed on-chain. |
| **Mint verification** | User submits Merkle proof with mint tx → contract verifies against root. |

> ⚠️ Twitter API key required — user will provide. Backend handles verification + Merkle generation.

### Token Deployment

OurToken is deployed **after** NFT mint-out. This ensures the final token supply and allocation are based on actual mint totals.

```
NFT Mint-Out
     │
     ▼
Calculate final numbers:
  Total raised × 20% = Token buyback amount
  Token supply = 1B (pre-determined)
     │
     ▼
Deploy OurToken with 5-way allocation
     │
     ▼
Phase 1 redemption opens (NFT → OurToken)
```

### Redemption — Two Phase

```
Phase 1 (After Mint-Out)
  → Burn NFT → Receive ERC-20 tokens
  → Stock portion REMAINS LOCKED

Phase 2 (TBD — based on market conditions)
  → Stock portion UNLOCKS
  → Redeem for GOOGL shares
```

### Diamond Hands Rewards

| Hold Duration | Multiplier |
|---|---|
| 30 days | 1× |
| 90 days | 2× |
| 180 days | 3× |
| 365 days | 5× |

---

## 4. New Contracts Required

| # | Contract | Purpose | Status |
|---|---|---|---|
| 1 | **OurToken.sol** | ERC-20: 1B supply, 6 decimals, 5-way allocation mint | ✅ Done |
| 2 | **FeeDistributor.sol** | Auto-splits mint fees 80/20 in USDG | Not started |
| 3 | **DiamondHands.sol** | Time-based NFT holding rewards (1×–5×) | Not started |
| 4 | **Whitelist.sol** | Phase 1 whitelist (Merkle tree or owner-managed) | Not started |

### Existing Contracts to Modify

| Contract | Change |
|---|---|
| **GoogleStockNFT.sol** | ✅ Two-phase mint (WL 4 USDG, Public 6 USDG). Merkle whitelist. USDG via transferFrom. 80/20 split to StockVault + Treasury. |
| **PlatformManager.sol** | ✅ Removed pool80/pool20/DeFi. Added Phase enum. Simplified trigger. Treasury-gated. |
| **StockVault.sol** | ✅ Two-phase redemption. Inline Uniswap V3 swap. USDG payments. OurToken Phase 1. |
| **InterestDistributor.sol** | ❌ Deleted — replaced by OurToken distribution |
| **GooglonSwapAdapter.sol** | ❌ Deleted — swap inlined in StockVault |

---

## 5. Key Configuration

| Config | Value |
|---|---|
| **Token Supply** | 1,000,000,000 (1B) |
| **Token Decimals** | 6 |
| **Phase 1: WL Supply** | 1,500 NFTs |
| **Phase 1: WL Price** | 4 USDG |
| **Phase 2: Public Supply** | 2,583 NFTs |
| **Phase 2: Public Price** | 6 USDG |
| **Total NFT Supply** | 4,083 |
| **Fee Split** | 80% Stock / 20% Token |
| **Payment Token** | USDG (Robinhood native) |
| **Redemption Fee (Stock)** | 5% |
| **Royalty (EIP-2981)** | 10% |
| **Stock Redemption Delay** | 48 hours |
| **Network** | Robinhood Chain |

---

## 6. Explorer & Verification

### Blockscout Verification (Hardhat)

```js
etherscan: {
  apiKey: { robinhood: "empty", "robinhood-testnet": "empty" },
  customChains: [
    {
      network: "robinhood",
      chainId: 4663,
      urls: {
        apiURL: "https://robinhoodchain.blockscout.com/api/",
        browserURL: "https://robinhoodchain.blockscout.com/",
      },
    },
    {
      network: "robinhood-testnet",
      chainId: 46630,
      urls: {
        apiURL: "https://explorer.testnet.chain.robinhood.com/api/",
        browserURL: "https://explorer.testnet.chain.robinhood.com/",
      },
    },
  ],
},
```

### Foundry Verification

```bash
forge verify-contract <ADDRESS> contracts/path.sol:ContractName \
  --chain-id 46630 \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api/
```

---

## 7. File Structure

```
contracts/
├── GoogleStockNFT.sol          # ERC-721 NFT (two-phase mint with USDG)
├── PlatformManager.sol         # Phase tracking, fee accounting
├── StockVault.sol              # GOOGL purchase + two-phase redemption
├── GooglonSwapAdapter.sol      # Uniswap V3: USDG→WETH→GOOGL
├── FeeDistributor.sol          # NEW: 80/20 auto-split
├── OurToken.sol                # NEW: ERC-20, 1B supply, 6 decimals
├── Whitelist.sol               # NEW: Merkle tree verification
├── DiamondHands.sol            # NEW: Time-based rewards
├── interfaces/
│   └── IGooglonSwap.sol
└── mocks/
    ├── MockGOOGL.sol            # Testnet GOOGL ERC-20
    └── MockUniswapRouter.sol    # Testnet swap router

scripts/
├── deploy-mainnet.ts            # Hardhat deploy (Ethereum mainnet — deprecated)
└── foundry/
    ├── DeployMockGOOGL.s.sol    # Foundry: deploy GOOGL mock
    └── DeployMockUniswapRouter.s.sol  # Foundry: deploy router mock

backend/
├── src/
│   ├── services/
│   │   ├── irys.service.ts      # IRYS metadata + certificates
│   │   ├── loyalty-bot.ts       # Etherscan/Blockscout royalty detection
│   │   └── twitter-verify.ts    # NEW: Twitter API WL verification
│   └── index.ts                 # API server
└── data/
    ├── loyalty-fees.json
    ├── loyalty-state.json
    └── whitelist.json           # NEW: Verified WL addresses
```

---

## 8. Migration Checklist

- [ ] Design & implement `OurToken.sol` (ERC-20, 1B supply, 6 decimals)
- [ ] Design & implement `FeeDistributor.sol` (80/20 USDG split)
- [ ] Design & implement `Whitelist.sol` (Merkle tree verification)
- [ ] Design & implement `DiamondHands.sol` (time-based multipliers)
- [ ] Build Twitter verification backend (`twitter-verify.ts`)
- [ ] Refactor `GoogleStockNFT.sol` — USDG mint, two-phase pricing, whitelist
- [ ] Refactor `PlatformManager.sol` — remove Aave/DeFi, add phase tracking
- [ ] Refactor `StockVault.sol` — two-phase redemption (token → GOOGL)
- [ ] Update `GooglonSwapAdapter.sol` — USDG→WETH→GOOGL path
- [ ] Remove `InterestDistributor.sol`
- [ ] Deploy all contracts to Robinhood testnet
- [ ] Generate Merkle tree from WL database
- [ ] Test full lifecycle: WL mint → public mint → token deploy → redeem
- [ ] Update frontend: mint (USDG + phases), portfolio, redeem (two tabs), admin
- [ ] Update landing page with new tokenomics docs
- [ ] Deploy to Robinhood mainnet
