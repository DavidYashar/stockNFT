# Mainnet Plan — Google Stock NFT

> Last updated: 2026-06-23  
> Status: **Code ready. Awaiting deploy keys + GOOGLon address.**

---

## 1. Architecture

```
User mints NFT (ETH)
  ├─ 80% → pool80 → StockVault → GooglonSwapAdapter → Uniswap V3 → GOOGLon
  └─ 20% → pool20 → Uniswap V3 (ETH→USDC) → Aave V3 → yield → Uniswap V3 (USDC→ETH) → InterestDistributor → holders
```

### Key Mainnet Addresses

| Contract | Address | Verified? |
|---|---|---|
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | ✅ Verified on Etherscan |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | ✅ |
| aUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` | ✅ |
| Uniswap V3 Router | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | ✅ Verified on Etherscan |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | ✅ |
| GOOGLon (Alphabet) | `0xbA47214eDd2bb43099611b208F75e4B42FDcfEDc` | ✅ User confirmed |

---

## 2. What We Deploy

| Contract | Constructor Args |
|---|---|
| `GooglonSwapAdapter` | `(weth, googlon, uniswapV3Router, poolFee, owner)` |
| `PlatformManager` | `(deployer)` |
| `StockVault` | `(usdc, googlon, owner)` |
| `InterestDistributor` | `(deployer)` |
| `GoogleStockNFT` | `(deployer, mintPrice)` |

Post-deploy wiring: `setGooglonSwap`, `setFeeRecipient`, `setPlatformManager`, `setGoogleStockNFT`, `setTreasuryVault`, ownership transfers.

---

## 3. Pre-Flight Checklist

### Keys & Funding
- [ ] Generate **fresh** deployer private key (hardware wallet or new hot wallet)
- [ ] Generate **fresh** treasury EOA (never used on testnet)
- [ ] Fund deployer with ≥0.5 ETH for gas
- [ ] Fund treasury with initial ETH for sweep operations

### GOOGLon Token
- [x] GOOGLon mainnet address confirmed: `0xbA47214eDd2bb43099611b208F75e4B42FDcfEDc`
- [ ] Verify Uniswap V3 pool exists (WETH/GOOGLon) and has liquidity at `0xbA47214eDd2bb43099611b208F75e4B42FDcfEDc`
- [ ] Confirm pool fee tier (3000 = 0.3%, 10000 = 1%)
- [ ] Set `UNISWAP_V3_POOL_FEE` env var accordingly

### Contract Verification
- [ ] `StockVault.redemptionDelay = 48 hours` ✅ (in code)
- [ ] `GoogleStockNFT.MAX_SUPPLY = 4083` ✅ (in code)
- [ ] `_executeSwap` requires GooglonSwap adapter ✅ (in code)
- [ ] No mock contracts deployed ✅ (deploy-mainnet.ts verified)

### Env Files
- [ ] `frontend/.env.local` — all `NEXT_PUBLIC_*` filled
- [ ] `backend/.env` — `PRIVATE_KEY`, `RPC_URL`, contract addresses filled
- [ ] `backend/.env` — `IRYS_NETWORK=mainnet`, `LOYALTY_CHAIN_ID=1`
- [ ] `backend/.env` — `ETHERSCAN_API_KEY` set
- [ ] `IRYS_PRIVATE_KEY` set for Arweave uploads

---

## 4. Render Deployment

| Service | Root | Start | Disk |
|---|---|---|---|
| Frontend | `frontend` | `pnpm start` | none |
| Backend | `backend` | `pnpm start` | `/data` → `backend/data` |

Single GitHub repo, two Web Services. Push = both redeploy.

### Env vars per service

**Frontend:** `NEXT_PUBLIC_NFT_ADDRESS`, `NEXT_PUBLIC_PLATFORM_ADDRESS`, `NEXT_PUBLIC_STOCK_ADDRESS`, `NEXT_PUBLIC_INTEREST_ADDRESS`, `NEXT_PUBLIC_GOOGLON_ADDRESS`, `NEXT_PUBLIC_TREASURY_EOA`, `NEXT_PUBLIC_DEPLOYER_ADDRESS`, `NEXT_PUBLIC_AAVE_POOL_ADDRESS`, `NEXT_PUBLIC_AUSDC_ADDRESS`, `NEXT_PUBLIC_UNISWAP_V3_ROUTER`, `NEXT_PUBLIC_WETH_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_MAINNET_RPC`, `NEXT_PUBLIC_NETWORK=mainnet`, `NEXT_PUBLIC_MAX_SUPPLY=4083`, `NEXT_PUBLIC_REDEMPTION_WAIT_SECONDS=172800`

**Backend:** `RPC_URL`, `PRIVATE_KEY`, `GOOGLE_STOCK_NFT`, `PLATFORM_MANAGER`, `STOCK_VAULT`, `INTEREST_DISTRIBUTOR`, `TREASURY_EOA`, `LOYALTY_CHAIN_ID=1`, `LOYALTY_POLL_MS=30000`, `LOYALTY_START_TIMESTAMP`, `ETHERSCAN_API_KEY`, `IRYS_NETWORK=mainnet`, `IRYS_PRIVATE_KEY`, `IRYS_RPC_URL`, `CERTIFICATE_TEMPLATE_URL`

---

## 5. Deploy Steps

```bash
# 1. Set env vars in root .env
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
MAINNET_PRIVATE_KEY=...
TREASURY_EOA=...
GOOGLON_TOKEN=0x...
UNISWAP_V3_POOL_FEE=3000

# 2. Compile
npx hardhat compile

# 3. Deploy
npx hardhat run scripts/deploy-mainnet.ts --network mainnet

# 4. Verify each contract on Etherscan
npx hardhat verify --network mainnet <address> <args...>

# 5. Fill deployed addresses into frontend/.env.local and backend/.env

# 6. Push to GitHub → Render auto-deploys both services
```

---

## 6. Post-Deploy Verification

- [ ] `NFT.MAX_SUPPLY() == 4083`
- [ ] `SV.redemptionDelay() == 172800` (48 hours)
- [ ] `SV.feeRecipient() == treasury`
- [ ] `SV.googlonSwap() == googlonSwapAdapter`
- [ ] `PM.sweepOperator() == treasury`
- [ ] `SV.owner() == treasury`
- [ ] `ID.owner() == treasury`
- [ ] `PM.owner() == deployer`
- [ ] `NFT.owner() == deployer`
- [ ] Mint 1 NFT → verify 80/20 split on-chain
- [ ] Sweep → verify USDC deposited to Aave
- [ ] Harvest → verify yield withdrawn + distributed
- [ ] Claim → verify holder receives ETH
- [ ] Google Purchase → verify GOOGLon swapped via Uniswap
- [ ] Redemption → verify 48h delay + 5% fee
- [ ] Loyalty bot → verify fee detection + on-chain recording
- [ ] IRYS → verify metadata uploaded to Arweave
- [ ] Frontend → loads mainnet chain, all pages functional

---

## 7. Ongoing Operations

| Operation | Frequency | Who | How |
|---|---|---|---|
| Update mint price | Every ~5 min | Mint Price Bot | CoinGecko → `NFT.setMintPrice()` |
| Detect loyalty fees | Every 30s | Loyalty Bot | Etherscan V2 → `PM.receiveLoyalty()` |
| Sweep to Aave | Manual (admin UI) | Treasury | Uniswap swap + Aave deposit |
| Harvest & Distribute | Manual (admin UI) | Treasury | Aave withdraw + Uniswap swap + ID fund |
| Trigger Google Purchase | Once (manual) | Treasury | PM → SV → GooglonSwapAdapter |
| Upload NFT metadata | On mint/transfer | IRYS service | Mint/Transfer events → Arweave |

---

## 8. Known Limitations

- **No Marketplace contract** — Secondary trading relies on OpenSea/Blur via EIP-2981 royalties (10% to treasury).
- **Yield calculation**: Harvest withdraws full aUSDC position value. In production, should track `principalDeposited` separately and withdraw only the delta.
- **Slippage**: Both sweep and harvest Uniswap swaps use `amountOutMinimum: 0`. Add slippage protection before mainnet.
- **Googlon pool fee**: Hardcoded to env var. Must match actual Uniswap V3 pool fee tier for WETH/GOOGLon.
