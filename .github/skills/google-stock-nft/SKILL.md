---
name: google-stock-nft
description: "Google Stock NFT V3 — Robinhood Chain NFT platform with TreasuryVault hub, PILE token, LP/airdrop/GOOGL admin sections. USE FOR: contracts, deploy, frontend DAPP, mint flow, wallet connect, IRYS metadata, tier detection, portfolio, admin panel. Key terms: GoogleStockNFT, TreasuryVault, PlatformManager, PileToken, ERC-6551 TBA, MockGOOGL, MockGooglSwap, MockPositionManager, USDG, two-phase mint, RainbowKit, wagmi, ethers.js."
argument-hint: "[query about GoogleStockNFT V3 platform]"
---

# 🚨 MANDATORY RULES

0. **Read this entire file before ANY code change.**
1. **Verify on-chain before every claim.** Never state a number without querying the chain.
2. **Propose before executing.** Present the plan, wait for user confirmation, then act.
3. **After every deploy, update ALL config files:** `frontend/.env.local`, `backend/.env`, `deployed-v3.json`, and this file's address table.
4. **Test changes before reporting success.** Compile, check for errors, verify in browser.
5. **Use wagmi for all wallet interactions.** Never use `window.ethereum` directly.

---

# Google Stock NFT V3 — Robinhood Chain Testnet

## Architecture (5 Contracts)

```
User → GoogleStockNFT V3 (ERC-721, TBA at mint)
  → 100% USDG → TreasuryVault (auto-splits 80/20 internally)
  → PlatformManager (phase state only)
  → PileToken (1B supply, ALL in TreasuryVault)

Admin Panel: LP Creation | PILE Airdrop | GOOGL Purchase
Claims: PILE + GOOGL → TBA → soulbound collectible
```

## Contract Addresses (2026-07-23 deploy)

| # | Contract | Address |
|---|----------|---------|
| 1 | PileToken | `0xEc0dCDE946080dA694e47FBd400a609A2adFEA10` |
| 2 | GoogleStockNFT V3 | `0xD50936Ac0E7f5Eb72FaEF0B88E90a99C0ade3358` |
| 3 | TreasuryVault V3 | `0x533aAF9AdA77423b889026250af3463C31C7076b` |
| 4 | PlatformManager V3 | `0x0301E19FBc01fB7933859866aC0155BfC604589A` |
| 5 | ERC6551Account (TBA impl) | `0x9D156ED19dc761C387CfF826807d2792F2176e83` |

### Testnet Mocks (Uniswap V3 NOT on testnet)

| Mock | Address | Purpose |
|------|---------|---------|
| MockGOOGL | `0xff5157906979a861e75d07dAc0e4E9c21FE7933A` | Mintable GOOGL ERC-20 |
| MockGooglSwap | `0xB03817f17BD2d19F3FeB0e7ae703f1b974A81485` | USDG→GOOGL swap at 0.066 rate |
| MockPositionManager | `0x8Bdb3D31DF241B332dB73d29B1AFC6Ee2EB76a3f` | PILE/USDG LP creation |
| MockUSDG | `0xcD3246a7E37eDFBd29113EB84c997D5859Fc2677` | Faucet token (6 decimals) |
| ERC-6551 Registry | `0x000000006551c19487814612e58FE06813775758` | Canonical registry |

### Wallets

| Role | Address |
|------|---------|
| Deployer (contract owner) | `0x2bAFb4513b5e9a8C6BBb9ce063f5b18BF1B2cc1E` |
| Treasury EOA | `0x982698483F08F99b9354878fFFf5A600b63f5145` |

---

## Fund Flow

```
mint(googlPrice, proof)
  → safeTransferFrom(user → NFT, price)
  → safeTransfer(NFT → TreasuryVault, price)  ← 100%
  → TV.receiveMintFunds(price)
      → pool80 += 80% (for GOOGL purchase)
      → pool20 += 20% (for LP / revenue)
  → PM.recordMint(price)  ← totalMintPrincipal only
  → _safeMint(user, tokenId)
  → Registry.createAccount(impl, 0, chainId, NFT, tokenId)  ← TBA at mint
```

## Admin Page Sections

| Section | Contract | Functions |
|---------|----------|-----------|
| Phase Controls | PlatformManager | openWhitelist(), openPublic(), endMint() |
| A: LP Creation | TreasuryVault | setLpAmounts(), getMarketCap(), createLP() |
| B: PILE Airdrop | TreasuryVault | airdropPILE(), openPileClaims() |
| C: GOOGL Purchase | TreasuryVault | purchaseGOOGL(), openGOOGLClaims() |

**Access**: Both deployer AND treasury EOA can call all admin functions.

---

## Contracts Detail

### GoogleStockNFT V3
- ERC-721, `MAX_SUPPLY=4083`, `WL_PRICE=4_000_000`, `PUBLIC_PRICE=6_000_000`
- `mint(googlPrice, proof)` — 100% USDG→TV, TBA deployed at mint
- `markSoulbound(tokenId)` — called by TreasuryVault only
- `erc6551Registry` + `erc6551Implementation` — set via PlatformManager or owner

### TreasuryVault V3 (the hub)
- `receiveMintFunds(amount)` — auto-splits 80/20
- `setLpAmounts(pile, usdg)` → `createLP(minPile, minUsdg)` — calls MockPositionManager
- `airdropPILE(amount)` → `openPileClaims()` → `claimPILE(tokenId)` — to TBA
- `purchaseGOOGL(usdg, minOut)` → `openGOOGLClaims()` → `claimGOOGL(tokenId)` — to TBA (5% fee)
- PILE token set via `setPileToken()` (one-time) / `updatePileToken()`

### PlatformManager V3
- Phase: NONE(0) → WHITELIST(1) → PUBLIC(2) → ENDED(3)
- `recordMint(amount)` — just tracks totalMintPrincipal
- `onlyTreasuryOrOwner` modifier on phase functions

### PileToken
- 1B total supply, 6 decimals, pre-minted
- ALL tokens go to TreasuryVault at deploy (TV distributes: 50% airdrop, 15% LP, etc.)
- Name: "PILE Token", Symbol: "PILE"

### ERC-6551
- Registry: `0x000000006551c19487814612e58FE06813775758`
- TBA deployed at mint time by GoogleStockNFT
- TreasuryVault deploys TBA lazily if not already deployed (via `_ensureTBA`)

---

## Frontend Architecture

- Next.js 14.2 App Router, RainbowKit v2.2 + wagmi v2.19, ethers.js v6.17, sonner v2
- **Contract reads**: ethers.JsonRpcProvider (bypasses wagmi chain issues)
- **Contract writes**: wagmi useWriteContract().writeContractAsync
- **Portfolio**: auto-refreshes every 15s via setInterval
- **Mint status badge**: phase-aware (NOT OPEN / WL LIVE / PUBLIC LIVE / ENDED / PAUSED)
- **Admin access**: wallet === deployer OR wallet === treasury EOA
- **tvContract**: null-safe — returns null if `NEXT_PUBLIC_TREASURY_ADDRESS` not set
- **Toast**: sonner via `createPortal(<Toaster/>, document.body)`

### Tier Detection
```
Read PM.mintPhase() + NFT.whitelistRoot() via ethers.JsonRpcProvider
Leaf: ethers.solidityPackedKeccak256(["address"], [address])
NOT keccak256(toUtf8Bytes(address)) — wrong leaf computation
```

---

## Backend

- IRYS metadata service (certificates), Loyalty bot, Faucet API on port 3002
- Faucet: POST /api/faucet { address } → mints 1,000 USDG (1-min cooldown)
- Certificate: PNG via Sharp, uploaded to IRYS devnet

---

## Env Files

### frontend/.env.local
```
NEXT_PUBLIC_NFT_ADDRESS=0xD50936Ac0E7f5Eb72FaEF0B88E90a99C0ade3358
NEXT_PUBLIC_PLATFORM_ADDRESS=0x0301E19FBc01fB7933859866aC0155BfC604589A
NEXT_PUBLIC_TREASURY_ADDRESS=0x533aAF9AdA77423b889026250af3463C31C7076b
NEXT_PUBLIC_PILE_ADDRESS=0xEc0dCDE946080dA694e47FBd400a609A2adFEA10
NEXT_PUBLIC_ERC6551_ACCOUNT_ADDRESS=0x9D156ED19dc761C387CfF826807d2792F2176e83
NEXT_PUBLIC_GOOGL_ADDRESS=0xff5157906979a861e75d07dAc0e4E9c21FE7933A
NEXT_PUBLIC_USDG_ADDRESS=0xcD3246a7E37eDFBd29113EB84c997D5859Fc2677
```

### backend/.env
```
GOOGLE_STOCK_NFT=0xD50936Ac0E7f5Eb72FaEF0B88E90a99C0ade3358
PLATFORM_MANAGER=0x0301E19FBc01fB7933859866aC0155BfC604589A
STOCK_VAULT=0x533aAF9AdA77423b889026250af3463C31C7076b
FAUCET_USDG_ADDRESS=0xcD3246a7E37eDFBd29113EB84c997D5859Fc2677
```

---

## Known Issues & Fixes

1. **Portfolio not showing NFTs after V3 deploy**: Must kill+restart `pnpm dev` (Next.js caches NEXT_PUBLIC_* at build time). Clear `.next` folder first.
2. **tvContract crash**: `TV_ADDR=""` → ethers throws UNCONFIGURED_NAME. Fixed with null guard in useRef.
3. **PM→NFT setERC6551 propagation fails**: NFT has old `onlyOwner` modifier (not deployed with latest source). Workaround: call NFT.setERC6551 directly from deployer.
4. **MockGooglSwap needs GOOGL funding**: Deploy script funds it with 5,000 GOOGL. If redeploying, must fund again.
5. **Uniswap V3 NOT on testnet**: All swap/LP go through mocks (MockGooglSwap, MockPositionManager). On mainnet, point TreasuryVault at real Uniswap addresses.
6. **No auto-refresh after mint**: Added 15s setInterval on portfolio fetch. Works regardless of user action.

## Deploy Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy-v3-testnet.ts` | Full deploy: mocks + 4 contracts + wiring |
| `scripts/setup-erc6551-v3.ts` | Deploy TBA impl + wire to TV+NFT |
| `scripts/redeploy-pm.ts` | Redeploy only PlatformManager + rewire |
