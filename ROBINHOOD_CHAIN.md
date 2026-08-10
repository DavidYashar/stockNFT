# Robinhood Chain — Contract Addresses

## Network Info

### Mainnet

| Attribute | Value |
|---|---|
| Chain | Robinhood Chain (Arbitrum L2) |
| Chain ID | `4663` |
| Currency Symbol | ETH |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Alchemy RPC | `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}` |
| Alchemy WebSocket | `wss://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}` |
| Sequencer Feed | `wss://feed.mainnet.chain.robinhood.com` |
| Sequencer | `https://sequencer.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com/` |
| Explorer API | `https://robinhoodchain.blockscout.com/api/` |

### Testnet

| Attribute | Value |
|---|---|
| Chain | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Currency Symbol | ETH |
| Public RPC | `https://rpc.testnet.chain.robinhood.com` |
| Alchemy RPC | `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` |
| Alchemy WebSocket | `wss://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` |
| Sequencer Feed | `wss://feed.testnet.chain.robinhood.com` |
| Sequencer | `https://sequencer.testnet.chain.robinhood.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com/` |
| Explorer API | `https://explorer.testnet.chain.robinhood.com/api/` |

## Token Addresses

### Mainnet

| Token | Address | Type |
|---|---|---|
| **GOOGL** (Alphabet Class A) | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | Robinhood Token |
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Wrapped ETH |
| **USDG** (Native Stablecoin) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Paxos Stablecoin |

### Testnet

| Token | Address | Type |
|---|---|---|
| **USDG** (Testnet Stablecoin) | `0x7E955252E15c84f5768B83c41a71F9eba181802F` | Paxos Stablecoin (testnet) |
| **WETH** (Testnet) | `0x7943e237c7F95DA44E0301572D358911207852Fa` | Wrapped ETH (testnet) |
| **GOOGL** (Testnet Mock) | `0x02f86DcC514C4974A0664f7364F93382997A01F6` | Deployed via Foundry (MockGOOGL.sol) |

## Uniswap V3 — Robinhood Chain Mainnet Deployments

Source: [Uniswap V3 Robinhood Chain Deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

| Contract | Address |
|---|---|
| **SwapRouter02** | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| **UniversalRouter** | `0x8876789976decbfcbbbe364623c63652db8c0904` |
| **UniswapV3Factory** | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| **QuoterV2** | `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **NFT Position Manager** | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |

> ⚠️ These are **mainnet** addresses. Testnet Uniswap V3 addresses are still TBD.

### Pool Fee Tiers

| Fee | BPS | Use |
|---|---|---|
| 0.01% | 100 | Very stable pairs |
| 0.05% | 500 | Stable pairs |
| 0.3% | 3000 | Standard pairs |
| 1% | 10000 | Volatile pairs |

GOOGL token is likely 1% (10000) tier due to volatility. WETH/USDG is likely 0.05% (500).

## Mock GOOGL for Testnet

The real GOOGL (`0x2e0847...`) is a **BeaconProxy** (upgradeable EIP-1967 proxy) pointing to a "Stock" implementation. For testnet, we deploy a simple ERC-20 mock.

### Deploy with Foundry

```bash
# Set env
export PRIVATE_KEY=<your_testnet_private_key>
export RH_TESTNET_RPC=https://robinhood-testnet.g.alchemy.com/v2/<YOUR_KEY>

# Deploy
forge script scripts/foundry/DeployMockGOOGL.s.sol \
  --rpc-url $RH_TESTNET_RPC \
  --broadcast

# Verify on Blockscout
forge verify-contract <DEPLOYED_ADDRESS> contracts/mocks/MockGOOGL.sol:MockGOOGL \
  --chain-id 46630 \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api/
```

| Contract | File | Address |
|---|---|---|
| MockGOOGL | `contracts/mocks/MockGOOGL.sol` | TBD after deploy |

## Our Deployed Contracts (V2)

### Testnet

| Contract | Address |
|---|---|
| MockGOOGL | `0x02f86DcC514C4974A0664f7364F93382997A01F6` |
| MockUniswapRouter | `0xA811a7E98359b88b2b0F849180389136524Cf424` |
| OurToken | `TBD` |
| PlatformManager | `TBD` |
| StockVault | `TBD` |
| GoogleStockNFT | `TBD` |
| Treasury EOA | `TBD` |
| Deployer EOA | `0x2bAFb4513b5e9a8C6BBb9ce063f5b18BF1B2cc1E` |

### Mainnet (TBD)

| Contract | Address |
|---|---|
| OurToken | `TBD` |
| PlatformManager | `TBD` |
| StockVault | `TBD` |
| GoogleStockNFT | `TBD` |
| Treasury EOA | `TBD` |
| Deployer EOA | `TBD` |

### Testnet External Tokens

| Token | Address | Type |
|---|---|---|
| **USDG** (Stablecoin) | `0x7E955252E15c84f5768B83c41a71F9eba181802F` | Paxos stablecoin |
| **WETH** | `0x7943e237c7F95DA44E0301572D358911207852Fa` | Wrapped ETH |
| **GOOGL** (Mock) | `0x02f86DcC514C4974A0664f7364F93382997A01F6` | Deployed via Foundry |

## Changes from Ethereum Mainnet (V1 → V2)

| Removed | Reason |
|---|---|
| Aave V3 Pool | Not on Robinhood |
| aUSDC | Aave removed |
| USDC | Replaced by USDG (Robinhood native) |
| GOOGLon (Ondo) | Replaced by GOOGL (Robinhood Token) |
| DeFi Yield (20% → Aave) | Entire DeFi layer removed |
| InterestDistributor | Replaced by OurToken (Phase 1 redemption) |
| GooglonSwapAdapter | Swap inlined into StockVault |
| TreasuryVault | No separate treasury contract |
| Marketplace | TBD for Robinhood |

## Added in V2

| Added | Purpose |
|---|---|
| **OurToken** | ERC-20, 1B supply, 6 decimals, distributed to NFT holders |
| **Two-phase redemption** | Phase 1: OurToken, Phase 2: GOOGL |
| **Two-phase mint** | WL (4 USDG) + Public (6 USDG) |
| **Merkle whitelist** | Twitter-verified WL for Phase 1 |
| **USDG payments** | Native Robinhood stablecoin |
| **Inline Uniswap swap** | StockVault swaps USDG→GOOGL directly |

## Hardhat Config (Blockscout Verification)

```js
networks: {
  robinhood: {
    url: process.env.RH_RPC_URL,
    chainId: 4663,
    accounts: [process.env.PRIVATE_KEY],
  },
  "robinhood-testnet": {
    url: process.env.RH_TESTNET_RPC_URL,
    chainId: 46630,
    accounts: [process.env.PRIVATE_KEY],
  },
},
etherscan: {
  apiKey: {
    robinhood: "empty",
    "robinhood-testnet": "empty",
  },
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
