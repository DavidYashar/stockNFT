# Google Stock NFT V3 — Mainnet Migration Plan & Security Audit

> **Date**: 2026-07-29  
> **Target Network**: Robinhood Chain Mainnet (Chain ID: 4663)  
> **Source Network**: Robinhood Chain Testnet (Chain ID: 46630)

---

## 1. CONFIRMED MAINNET ADDRESSES

| Component | Mainnet Address | Source |
|-----------|----------------|--------|
| **USDG** (native stablecoin) | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |
| **GOOGL** (stock token) | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | [Blockscout](https://robinhoodchain.blockscout.com/token/0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3) |
| **ERC-6551 Registry** | `0x000000006551c19487814612e58FE06813775758` | Canonical (same on all EVM chains) |

### Pending Confirmation

| Component | Status |
|-----------|--------|
| **Uniswap V3 SwapRouter02** | ✅ Confirmed — `0xcaf681a66d020601342297493863e78c959e5cb2` |
| **Uniswap V3 NonfungiblePositionManager** | ✅ Confirmed — `0x73991a25c818bf1f1128deaab1492d45638de0d3` |
| **Uniswap V3 Factory** | ✅ Confirmed — `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| **QuoterV2** | ✅ Confirmed — `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7` (optional) |
| **ERC-6551 Implementation** | ❓ Verify on RH mainnet (`0x8C92910D3230f51138571dba331D19150aFE6b11` used on testnet) |

> Source: [Uniswap Docs — Robinhood Chain Deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)  
> Versions: `@uniswap/v3-core@1.0.0`, `@uniswap/v3-periphery@1.0.0`, `@uniswap/swap-router-contracts@1.1.0`

---

## 2. CONTRACT CHANGES REQUIRED BEFORE MAINNET DEPLOY

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `GoogleStockNFT.sol` L260-265 | `_update`: add `&& to != address(0)` to soulbound check | Currently blocks burning (transfer to zero address). Fix: allow burn while blocking transfers |
| 2 | `GoogleStockNFT.sol` | Add `burnIfEmpty(uint256 tokenId)` — checks TBA balances of PILE + GOOGL, burns NFT if both zero | Users can clean up fully-redeemed NFTs |
| 3 | `TreasuryVault.sol` L286 | Move `lpCreated = true` AFTER `positionManager.mint()` succeeds | Current code sets flag before the external call — if Uniswap reverts, LP can never be retried |
| 4 | `TreasuryVault.sol` `_getUsdgToGooglPath()` | Verify `uint24(3000)` (0.3% fee tier) exists as USDG→GOOGL pool on RH mainnet | Hardcoded fee tier may not match actual Uniswap pool |

---

## 3. NEW MAINNET DEPLOYMENTS

### Contracts to Deploy (in order)

| # | Contract | Constructor Args |
|---|----------|-----------------|
| 1 | **PileToken** | `("PILE Token", "PILE", 1_000_000_000 * 1e6, owner)` — 1B supply, 6 decimals |
| 2 | **PlatformManager** | `(owner, treasuryEOA)` |
| 3 | **TreasuryVault** | `(USDG, GOOGL, swapRouter, positionManager, owner, treasuryEOA)` |
| 4 | **GoogleStockNFT** | `(owner, USDG, treasuryEOA, treasuryVault)` |

### Post-Deploy Wiring

```
5.  PlatformManager.setGoogleStockNFT(nftAddr)
6.  PlatformManager.setTreasuryVault(tvAddr)
7.  PlatformManager.setERC6551(registry, impl)
8.  TreasuryVault.setGoogleStockNFT(nftAddr)
9.  TreasuryVault.setPlatformManager(pmAddr)
10. TreasuryVault.setPileToken(pileAddr)
11. GoogleStockNFT.setPlatformManager(pmAddr)
```

### NOT Deployed on Mainnet

| Contract | Testnet Address | Reason |
|----------|----------------|--------|
| MockGOOGL | `0x5aAe...06a4` | Use real GOOGL `0x2e08...4FE3` |
| MockGooglSwap | `0xd758...BD8B` | Use real Uniswap V3 |
| MockPositionManager | `0xc4D0...cc9d` | Use real Uniswap NonfungiblePositionManager |

---

## 4. ENVIRONMENT FILES

### `backend/.env` — Mainnet Overrides

```
RPC_URL=https://robinhood-mainnet.g.alchemy.com/v2/<KEY>
PRIVATE_KEY=<MAINNET_DEPLOYER_KEY>

GOOGLE_STOCK_NFT=<newly deployed>
PLATFORM_MANAGER=<newly deployed>
STOCK_VAULT=<newly deployed — TreasuryVault>
PILE_TOKEN=<newly deployed>
TREASURY_EOA=<mainnet multisig>

FAUCET_USDG_ADDRESS=<REMOVE — no faucet on mainnet>

FRONTEND_URL=https://your-production-domain.com
TWITTER_TWEET_ID=<real project tweet>
TWITTER_FOLLOW_ACCOUNT=<real project account>
TWITTER_POST_KEYWORDS=<real project keywords>
```

### `frontend/.env.local` — Mainnet Overrides

```
NEXT_PUBLIC_MAINNET_RPC=https://robinhood-mainnet.g.alchemy.com/v2/<KEY>
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_NETWORK_DISPLAY_NAME=Robinhood Chain

NEXT_PUBLIC_NFT_ADDRESS=<newly deployed>
NEXT_PUBLIC_PLATFORM_ADDRESS=<newly deployed>
NEXT_PUBLIC_TREASURY_ADDRESS=<newly deployed>
NEXT_PUBLIC_PILE_ADDRESS=<newly deployed>
NEXT_PUBLIC_GOOGL_ADDRESS=0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3
NEXT_PUBLIC_USDG_ADDRESS=0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168

NEXT_PUBLIC_FAUCET_API=<REMOVE>
NEXT_PUBLIC_BACKEND_API=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<NEW PRODUCTION PROJECT ID>

NEXT_PUBLIC_TWITTER_TWEET_ID=<real project tweet>
NEXT_PUBLIC_TWITTER_FOLLOW_ACCOUNT=<real project account>
```

---

## 5. BACKEND CHANGES FOR MAINNET

| Change | Detail |
|--------|--------|
| Remove faucet endpoint (`/api/faucet`) | Testnet only |
| Remove `@irys/upload` from dependencies | Metadata is fully on-chain SVG |
| Remove `twitter-api-v2` from dependencies | No OAuth API verification |
| Update `submission.service.ts` data path | Ensure `data/` persists on Render |
| `next.config.js` rewrites | Remove `/api/twitter/:path*`, keep `/api/whitelist/:path*` |

---

## 6. FRONTEND CHANGES FOR MAINNET

| Change | Detail |
|--------|--------|
| Remove faucet button | Testnet only |
| Update all contract addresses | See env table §4 |
| Whitelist: update tweet IDs, account name | Real project values |
| New WalletConnect project ID | `cloud.walletconnect.com` |
| Add mainnet badge/indicator | Visual cue for users |

---

## 7. POST-DEPLOYMENT ADMIN SEQUENCE

| Step | Action | Contract |
|------|--------|----------|
| 1 | Transfer PILE supply to TreasuryVault | PileToken → TV |
| 2 | `setLpAmounts(pileAmount, usdgAmount)` | TreasuryVault |
| 3 | `createLP(minPileOut, minUsdgOut)` | TreasuryVault |
| 4 | `airdropPILE(pileAmount)` | TreasuryVault |
| 5 | `setWhitelistRoot(merkleRoot)` | GoogleStockNFT |
| 6 | `openWhitelist()` | PlatformManager |
| 7 | Wait 2 hours → WL phase ends | — |
| 8 | `openPublic()` | PlatformManager |
| 9 | After minting ends → `purchaseGOOGL(usdgAmount, minGooglOut)` | TreasuryVault |
| 10 | `openPileClaims()` | TreasuryVault |
| 11 | `openGOOGLClaims()` | TreasuryVault |

---

## 8. PRE-MAINNET FINAL CHECKLIST

- [ ] Deploy exact mainnet code to testnet one final time (with real Uniswap addresses)
- [ ] Verify all contracts on RH Blockscout explorer
- [ ] Test Merkle tree generation from `whitelist-submitted.json`
- [ ] Confirm Uniswap V3 SwapRouter + PositionManager addresses on RH mainnet
- [ ] Confirm ERC-6551 implementation address on RH mainnet
- [ ] Set up production WalletConnect project
- [ ] Audit Uniswap pool existence for USDG→GOOGL and PILE→USDG
- [ ] Frontend: test duplicate wallet + duplicate Twitter prevention
- [ ] Backend: verify `whitelist-submitted.json` persists on Render disk
- [ ] Remove all mock contract deployment code from scripts

---

# SECURITY AUDIT

## Scope

| Contract | Lines | Role |
|----------|-------|------|
| `GoogleStockNFT.sol` | ~270 | ERC-721 minting, Merkle WL, TBA deployment, soulbound |
| `TreasuryVault.sol` | ~560 | Fund reception, 80/20 split, LP, airdrop, GOOGL swap, claims |
| `PlatformManager.sol` | ~180 | Phase management, mint recording, pause/lifecycle |
| `PileToken.sol` | Standard ERC-20 | 1B supply, 6 decimals, Ownable |

**Total audit surface**: ~1,010 Solidity lines + OpenZeppelin v5 dependencies

---

## CRITICAL FINDINGS

### C-1: Soulbound blocks NFT burn — token permanently stuck after redemption
**File**: `GoogleStockNFT.sol` L260-265  
**Severity**: Medium  
**Status**: 🔴 MUST FIX before mainnet

The `_update` override blocks ALL transfers when `soulbound = true`, including burning (transfer to `address(0)`). After full redemption, the NFT is permanently stuck in the user's wallet with no way to remove it.

```solidity
// Current (broken):
if (soulbound[tokenId] && from != address(0)) {
    revert("NFT fully redeemed - soulbound");
}

// Fixed:
if (soulbound[tokenId] && from != address(0) && to != address(0)) {
    revert("NFT fully redeemed - soulbound");
}
```

**Fix**: Add `&& to != address(0)` — allows `_update(address(0), tokenId, auth)` for burning while still blocking normal transfers.

---

### C-2: `createLP` flag set before Uniswap call — irreversible failure
**File**: `TreasuryVault.sol` L286-320  
**Severity**: High  
**Status**: 🔴 MUST FIX before mainnet

`lpCreated = true` is set BEFORE `positionManager.mint()`. If the Uniswap call reverts (price moved, insufficient liquidity), the flag is already true and LP can NEVER be retried. The function becomes permanently bricked.

**Fix**: Move `lpCreated = true;` to AFTER the successful `positionManager.mint()` call (after L316).

---

### C-3: Merkle leaf uses `abi.encodePacked(address)` — second-preimage safe but dual-path risk
**File**: `GoogleStockNFT.sol` L250-251  
**Severity**: Medium  
**Status**: 🟡 Acceptable with caution

`keccak256(abi.encodePacked(user))` for a single `address` (20 bytes fixed) is safe against second-preimage attacks. However, the fallback path (`whitelistRoot != 0, whitelist == address(0)`) allows the owner to set a root directly, bypassing the whitelist contract entirely.

**Mitigation**: Always deploy the whitelist contract. Never set `whitelistRoot` without it. Document this in deployment procedure.

---

### C-4: `_autoMarkSoulbound` silently fails
**File**: `TreasuryVault.sol` L545-551  
**Severity**: Low  
**Status**: 🟡 Monitor

```solidity
if (!ok) {} // best-effort
```

If the call to `markSoulbound` fails (e.g., NFT contract address misconfigured), the soulbound flag is never set but the claim succeeds. The NFT remains transferable after full redemption — defeating the soulbound design.

**Mitigation**: Consider emitting a warning event, or reverting if this is considered critical. Currently acceptable if post-deployment testing verifies the call succeeds.

---

### C-5: `receiveMintFunds` — access control depends on correct `googleStockNFT` address
**File**: `TreasuryVault.sol` L208-218  
**Severity**: Low  
**Status**: 🟢 Mitigated

Only `googleStockNFT` can call `receiveMintFunds`. If the NFT contract is upgraded to a malicious implementation, pool accounting is compromised. `updateGoogleStockNFT` is `onlyOwner`.

**Mitigation**: Owner must be a multisig (Gnosis Safe). Document that `updateGoogleStockNFT` is a highly sensitive function.

---

## MEDIUM FINDINGS

### M-1: `totalPileForAirdrop` is one-shot with no recovery
**File**: `TreasuryVault.sol` L357-363  
If the wrong amount is recorded, there is no way to fix it. The airdrop is permanently misconfigured.

**Recommendation**: Add `updateAirdropAmount(uint256)` guarded by `onlyOwner` that can be called before `openPileClaims`.

### M-2: `purchaseGOOGL` — no oracle/TWAP validation
**File**: `TreasuryVault.sol` L400-440  
The admin manually sets `minGooglOut`. There is no on-chain price validation. A wrong `minGooglOut` (set too low) allows a sandwich attacker to capture value.

**Recommendation**: Frontend should fetch a Uniswap quote before the admin signs, or add an optional TWAP oracle check.

### M-3: `_isNFTOwner` uses `staticcall` — silently returns false on failure
**File**: `TreasuryVault.sol` L542-545  
If `googleStockNFT` is misconfigured (zero address, self-destructed), the `staticcall` returns `false` and `_isNFTOwner` returns `false` — preventing ALL claims. This is a liveness risk, not a security risk.

**Mitigation**: `googleStockNFT` is set once via `onlyOwner`. Acceptable.

---

## LOW / INFORMATIONAL FINDINGS

| ID | Description | File | Severity |
|----|-------------|------|----------|
| L-1 | `mint()` does not validate `googlPrice > 0` — accepts zero oracle price | GoogleStockNFT | Info |
| L-2 | `burnUnminted` can be called during active mint — could accidentally burn available supply | GoogleStockNFT | Low |
| L-3 | `pauseMint` / `resumeMint` on PM — no event emitted on PM itself | PlatformManager | Info |
| L-4 | `setTotalMintPrincipal` accepts ANY larger value — no validation of correctness | PlatformManager | Low |
| L-5 | `stopMintAndBurn` is irreversible — burns tokens AND ends mint | PlatformManager | Low |
| L-6 | No event emitted for `markSoulbound` — limits off-chain monitoring | GoogleStockNFT | Info |
| L-7 | `createLP` uses `tickLower: -887272` / `tickUpper: 887272` — full-range = high slippage | TreasuryVault | Info |
| L-8 | `_getUsdgToGooglPath` hardcodes 0.3% fee tier — may not exist on RH mainnet | TreasuryVault | Low |
| L-9 | `sendPILE` / `sendUSDG` no cap besides pool balances — treasury could drain pools | TreasuryVault | Info |
| L-10 | `recoverERC20` cannot recover PILE/USDG/GOOGL — no way to rescue stuck core tokens | TreasuryVault | Low |

---

## DEPENDENCY AUDIT

| Dependency | Status |
|-----------|--------|
| OpenZeppelin Contracts v5 | ✅ Industry standard, regularly audited |
| ERC-6551 (canonical registry) | ✅ ERC standard |
| Uniswap V3 Periphery (interfaces only) | ✅ Battle-tested |
| ethers.js v6.17 | ✅ Mature, audited |
| wagmi v2 + RainbowKit v2 | ✅ Widely used |
| Solidity 0.8.27 viaIR | ✅ Latest stable, built-in overflow checks |

No unverified or unknown external dependencies.

---

## SUMMARY

| Severity | Count | Must Fix? |
|----------|-------|-----------|
| Critical | 0 | — |
| High | 1 (C-2) | 🔴 Yes — lpCreated flag |
| Medium | 4 (C-1, C-3, C-4, C-5) | 🟡 C-1 should fix |
| Low | 10 | 🟢 Acceptable |
| Informational | 6 | 🟢 Acceptable |

**Recommended pre-mainnet fixes**: C-1 (soulbound burn), C-2 (lpCreated flag). The remaining findings are acceptable with a multisig owner and proper deployment procedures.
