# Google Stock NFT — Contract Architecture

> Sepolia Testnet Deployed: 2026-06-10  
> All 7 contracts verified on-chain. Mint flow tested and working.

## Architecture Overview

```mermaid
graph TD
    USER["👤 User"]
    NFT["🎨 GoogleStockNFT<br/>ERC-1155"]
    TV["🏦 TreasuryVault<br/>Single Wallet (all USDC)"]
    PM["⚙️ PlatformManager<br/>Admin + Royalties"]
    SV["📊 StockVault<br/>GOOGLon Purchase + Redeem"]
    ID["💸 InterestDistributor<br/>2% APR Yield"]
    AAVE["Aave v3"]
    UNI["Uniswap V4"]
    GOOGL["GOOGLon Token<br/>(Ondo Finance)"]

    USER -->|"10 USDC → mint()"| NFT
    NFT -->|"receiveUSDC()<br/>80/20 split"| TV
    NFT -->|"recordMint()"| PM
    TV -->|"sweepDeFi() every 4h"| AAVE
    TV -->|"harvestAndDistribute() weekly"| ID
    ID -->|"claimInterest()"| USER
    PM -->|"triggerGooglePurchase()"| TV
    PM -->|"loyalty fees"| SV
    TV -->|"releaseGoogleFunds()<br/>pool80"| SV
    SV -->|"swap USDC→GOOGLon"| UNI
    SV -->|"claimRedemption()"| USER
    USER -->|"secondary trade<br/>10% royalty"| NFT
    NFT -->|"royalty → receiveLoyalty()"| PM
```

## Full Lifecycle Sequence

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant N as GoogleStockNFT
    participant T as TreasuryVault
    participant P as PlatformManager
    participant I as InterestDistributor
    participant S as StockVault
    participant A as Aave
    participant G as GOOGLon

    Note over U,G: === PHASE 1: Minting ===
    U->>N: mint(googlPrice) + 10 USDC
    N->>T: receiveUSDC(10) → 8→pool80, 2→pool20
    N->>P: recordMint(10)
    N-->>U: NFT minted (48h interest wait)

    Note over U,G: === PHASE 2: Earning Yield ===
    T->>A: sweepDeFi() every 4h<br/>deposits pool20
    A-->>A: yield accrues...
    T->>I: harvestAndDistribute() weekly<br/>sends yield to pool
    U->>I: claimInterest() after 48h<br/>receives 2% APR on 2 USDC principal

    Note over U,G: === PHASE 3: Secondary Trading ===
    U->>N: transfer NFT to Buyer
    N->>I: settleOnTransfer() forfeits unclaimed interest
    N-->>Buyer: NFT transferred (48h interest wait resets)
    N->>P: 10% royalty from sale price

    Note over U,G: === PHASE 4: Trigger Google Purchase ===
    Note over P: mintEnded=true AND loyaltyFees ≥ gap20
    P->>T: releaseGoogleFunds()
    T->>S: pool80 USDC
    P->>S: loyaltyFees USDC
    S->>S: executeGooglePurchase()<br/>swap USDC→GOOGLon on Uniswap V4
    S->>S: assignShares() per NFT

    Note over U,G: === PHASE 5: Redemption ===
    U->>S: requestRedemption()
    Note over S: 48h countdown
    U->>S: claimRedemption()
    S->>U: 95% GOOGLon share (5% fee to platform)
```

## Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| MockUSDC | `0x611A346AEA42a0a656A37bF56Ef028d800C9c3e1` |
| MockGOOGLon | `0xDB5961145115e80dc58Ec81F4701496723830c3C` |
| GoogleStockNFT | `0xef5131b9f962B97dc59282D670dDeB825948C453` |
| TreasuryVault | `0x07eADcaE13Ec80e2e8b606d219d932250a6d5086` |
| StockVault | `0x5f7a7DECBBeB278bd0F365fBE8b2C47c9165AF3d` |
| PlatformManager | `0x850995aA6dA38D074Bb4F33e3B388d5e844146AF` |
| InterestDistributor | `0x4E2944be4F7C2100DdD2c12FfC03c4824aA405EC` |

## Key Numbers

| Parameter | Value |
|-----------|-------|
| NFT Price | 10 USDC (fixed) |
| Total Supply | 10,000 NFTs |
| 80/20 Split | 8 USDC → Google purchase / 2 USDC → Aave DeFi |
| Holder Yield | 2% APR on 2 USDC DeFi principal |
| Interest Wait | 48 hours after mint or transfer |
| Royalty | 10% on secondary sales |
| Redemption Fee | 5% (after 48h delay) |
| Redemption Delay | 48 hours |
| DeFi Sweep Interval | Every 4 hours |
| Yield Distribution | Weekly |

## How the 20% Gap Works

```
Each mint: 10 USDC
  ├── 8 USDC (80%) → pool80 — saved for Google purchase
  └── 2 USDC (20%) → pool20 — DeFi yield for holders

Problem: Only 80% of mint funds go toward buying GOOGLon.
         Need the missing 20% from somewhere else.

Solution: The 10% royalty from ALL secondary trades
          accumulates in PlatformManager as "loyalty fees."

Trigger condition:
  canTrigger() = mintEnded AND loyaltyFees ≥ (totalMintPrincipal × 20%)
```

## On-Chain Verification (2026-06-10)

- ✅ NFT #1 minted at GOOGL price $185 with 10 USDC
- ✅ pool80 = 8.0 USDC, pool20 = 2.0 USDC
- ✅ 48h interest waiting period active
- ✅ All 7 cross-contract wirings verified
- ✅ Deployer: `0x2bAFb4513b5e9a8C6BBb9ce063f5b18BF1B2cc1E`
