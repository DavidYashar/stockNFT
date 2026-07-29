# Google Stock NFT V3 — User Guide

> **Network**: Robinhood Chain (Arbitrum Orbit L2)  
> **DAPP**: [your-domain.com/app](https://your-domain.com/app)

---

## What Is Google Stock NFT?

Google Stock NFT lets you own a fraction of **Alphabet Class A (GOOGL)** stock through a single NFT. Each NFT represents:

- **$4 worth of GOOGL stock** — held in your NFT's own smart wallet
- **$1 worth of PILE tokens** — airdropped to every holder
- **Total value per NFT**: $5.00

No brokerage account. No six-figure minimum. Just connect your wallet and mint.

---

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  You Mint    │ ──▶ │ NFT + Smart Wallet │ ──▶ │  PILE + GOOGL   │
│  an NFT      │     │ (TBA) created      │     │  held inside    │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                      │
                                              You claim both
                                              to your wallet
                                                      │
                                              NFT becomes a
                                              permanent collectible
```

Every NFT has its own **ERC-6551 Token Bound Account (TBA)** — a smart wallet that holds your PILE tokens and GOOGL shares. Only you (the NFT owner) can access it.

---

## Token Information

### Mainnet Addresses

| Token | Address | Decimals | Purpose |
|-------|---------|----------|---------|
| **USDG** | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | 6 | Stablecoin for mint payment |
| **GOOGL** | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | 18 | Alphabet Class A stock token |
| **PILE** | Announced at launch | 6 | Airdrop token for all holders |

### NFTs

| Detail | Value |
|--------|-------|
| Collection | Google Stock NFT (GSNFT) |
| Standard | ERC-721 |
| Max Supply | 4,083 |
| WL Price | 4 USDG |
| Public Price | 6 USDG |

---

## Add Robinhood Chain to Your Wallet

### MetaMask / Rabby / Any EVM Wallet

| Setting | Value |
|---------|-------|
| **Network Name** | Robinhood Chain |
| **Chain ID** | `4663` |
| **Currency Symbol** | ETH |
| **RPC URL** | `https://rpc.mainnet.chain.robinhood.com` |
| **Block Explorer** | `https://robinhoodchain.blockscout.com` |

> 💡 You need ETH for gas fees. ETH on Robinhood Chain functions like ETH on Ethereum — tiny fees per transaction (~$0.01).

### Getting USDG

USDG is the native stablecoin on Robinhood Chain. You can acquire it through:

- **Robinhood Crypto** — on/off ramp
- **Uniswap** — swap ETH for USDG

---

## How to Participate

### Step 1: Whitelist (Early Access)

Whitelisted users mint at **4 USDG** instead of 6 USDG. To join:

1. Go to the [DAPP](https://your-domain.com/app) → **Whitelist** tab
2. Connect your wallet
3. Complete these tasks on Twitter/X:
   - Follow our account
   - Like & Retweet the project tweet
   - Comment on the project tweet
   - Post the required tweet from the template shown
4. Fill in your **Twitter username**, **retweet link**, and **tweet link**
5. Your wallet address is filled automatically
6. Click **Submit**

> ⚠️ One wallet = one whitelist entry. One Twitter account = one wallet. No duplicates.

After the submission period ends, we verify all entries and publish the whitelist.

### Step 2: Mint

Once mint opens:

1. Go to the DAPP → **Mint** tab
2. If whitelisted, you'll see "Whitelist · 4 USDG/share"
3. Click **Mint Stock NFT**
4. Approve the USDG transaction in your wallet
5. Your NFT arrives with a unique on-chain certificate

### Step 3: Claim PILE

After mint ends and the airdrop opens:

1. Go to **Portfolio** tab
2. Find your NFT
3. Click **Claim $PILE**
4. PILE tokens are sent to your NFT's smart wallet

### Step 4: Claim GOOGL

After the GOOGL purchase is executed:

1. Go to **Portfolio** tab
2. Find your NFT
3. Click **Claim GOOGL**
4. GOOGL shares are sent to your NFT's smart wallet

### Step 5: Withdraw

1. In Portfolio, click on your NFT to open details
2. Use **Withdraw PILE** and **Withdraw GOOGL** to move tokens to your personal wallet
3. After both are withdrawn, your NFT becomes a **soulbound collectible** — it stays in your wallet forever as proof of ownership

---

## NFT Certificate

Every NFT has a unique on-chain SVG certificate showing:

- Token ID
- GOOGL shares held
- PILE value
- GOOGL price at mint
- Mint date
- Your TBA smart account address
- Network: Robinhood Chain

No external image hosting — everything lives on-chain.

---

## Phases Summary

| Phase | What Happens |
|-------|-------------|
| **Whitelist Mint** | 1,500 NFTs at 4 USDG (2-hour window, Merkle proof) |
| **Public Mint** | Remaining 2,583 NFTs at 6 USDG (open to all) |
| **Mint Ends** | No more NFTs minted |
| **LP Creation** | PILE/USDG liquidity pool created on Uniswap V3 |
| **PILE Airdrop** | 50% of PILE distributed to all NFT holders |
| **GOOGL Purchase** | Pool80 USDG swapped for GOOGL on Uniswap |
| **GOOGL Claims** | Holders claim proportional GOOGL shares |
| **Soulbound** | After full redemption, NFT becomes non-transferable |

---

## FAQ

**Q: Can I sell my NFT before claiming?**  
A: Yes. Before claiming both PILE and GOOGL, your NFT is fully transferable and can be listed on any NFT marketplace.

**Q: What happens after I claim everything?**  
A: Your NFT becomes soulbound — it can't be transferred or sold. It stays in your wallet as a permanent certificate proving you owned the stock assets.

**Q: How is the GOOGL price determined?**  
A: GOOGL is a tokenized stock on Robinhood Chain that tracks Alphabet's real stock price via oracles.

**Q: What's PILE worth?**  
A: PILE gets its initial price from the Uniswap V3 liquidity pool. The DAPP shows the live market cap and price.

**Q: Is this audited?**  
A: Our contracts are built on OpenZeppelin's audited libraries. A full security audit report is available in our documentation.

---

## Links

| Resource | URL |
|----------|-----|
| DAPP | [your-domain.com/app](https://your-domain.com/app) |
| Explorer | [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com) |
| Uniswap | [info.uniswap.org](https://info.uniswap.org) |

---

> *"In Chain We Trust"* — Google Stock NFT
