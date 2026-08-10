# ERC-6551 — What We Learned

> Based on [EIP-6551](https://eips.ethereum.org/EIPS/eip-6551) and live testing on Robinhood Chain.

---

## 1. Core Concept

Every NFT gets its own smart contract wallet — a **Token Bound Account (TBA)**. The TBA address is deterministically derived, exists before deployment, and can receive assets immediately. Whoever holds the NFT controls the TBA.

```
NFT holder → owns NFT → controls TBA → controls all assets inside
```

---

## 2. Registry — The Most Important Contract

| Attribute | Value |
|---|---|
| Address | `0x000000006551c19487814612e58FE06813775758` (canonical, same on all chains) |
| Deployed by | Nick's Factory (`0x4e59b44847b379578588920cA78FbF26c0B4956C`) |
| Mechanism | `CREATE2` — deterministic addresses |
| Owner | None — permissionless, immutable |

### Critical: `account()` has 5 parameters (not 2!)

```solidity
// ✅ CORRECT — EIP-6551 spec
function account(
    address implementation,  // TBA implementation contract
    bytes32 salt,            // usually bytes32(0)
    uint256 chainId,         // blockchain ID
    address tokenContract,   // NFT contract
    uint256 tokenId          // NFT ID
) external view returns (address);

// ❌ WRONG — common mistake (we made this!)
function account(address tokenContract, uint256 tokenId) external view returns (address);
```

The implementation address is part of the address derivation. Different implementations = different TBA addresses for the same NFT. This is by design — an NFT can have multiple TBAs with different implementations.

### `createAccount` also takes 5 params

```solidity
function createAccount(
    address implementation,
    bytes32 salt,
    uint256 chainId,
    address tokenContract,
    uint256 tokenId
) external returns (address account);
```

Deploys an ERC-1167 minimal proxy. If already deployed, returns existing address without reverting.

---

## 3. TBA Implementation — Required Interfaces

### MUST implement

| Interface | ERC-165 ID | Required Functions |
|---|---|---|
| `IERC6551Account` | `0x6faff5f1` | `token()`, `state()`, `isValidSigner()`, `receive()` |
| `IERC165` | `0x01ffc9a7` | `supportsInterface()` |
| `IERC1271` | `0x1626ba7e` | `isValidSignature()` |

### MAY implement

| Interface | ERC-165 ID | Functions |
|---|---|---|
| `IERC6551Executable` | `0x51945447` | `execute(to, value, data, operation)` |

### Key Function Details

**`token()`** — Reads `(chainId, tokenContract, tokenId)` from the proxy's appended bytecode using `extcodecopy`, not from storage. The canonical registry appends this data as ABI-encoded constants AFTER the ERC-1167 proxy bytecode.

```solidity
function token() public view returns (uint256, address, uint256) {
    bytes memory footer = new bytes(0x60);
    assembly {
        extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
    }
    return abi.decode(footer, (uint256, address, uint256));
}
```

**`state()`** — Returns a value that changes each time the account state changes. Increments on every `execute()`.

**`isValidSigner()`** — Returns `0x523e3260` for valid signers, `bytes4(0)` for invalid. Must NOT revert for invalid signers.

**`owner()`** — Reads `IERC721(tokenContract).ownerOf(tokenId)` fresh from chain each call. Not cached.

**`execute(to, value, data, operation)`** — `operation=0` means CALL. Only the NFT owner (or other valid signer) can call.

---

## 4. TBA Proxy Bytecode Structure

Each TBA is an ERC-1167 minimal proxy with appended constant data:

```
Offset  Size  Content
------  ----  -------
0x00    10    ERC-1167 Header
0x0A    20    Implementation address
0x1E    15    ERC-1167 Footer
0x2D    32    Salt (bytes32)
0x4D    32    Chain ID (uint256)
0x6D    32    Token Contract (address, left-padded)
0x8D    32    Token ID (uint256)
```

Total: 173 bytes (0xAD). The `token()` function reads from offset 0x4D for 0x60 bytes (96 bytes = salt + chainId + tokenContract + tokenId), then decodes to get the last three.

---

## 5. Security Model

```
NFT owner = TBA owner
     ↓
Only NFT owner can call TBA.execute()
     ↓
TBA holds all assets
     ↓
If NFT is sold, new owner instantly controls TBA
     ↓
If NFT is burned, TBA is forever locked
```

### Key risks
- **NFT theft = TBA theft** — all assets in TBA go to thief
- **Ownership cycles** — if NFT is sent to its own TBA, everything is locked forever
- **Bridge limitation** — TBAs are chain-specific. If NFT is bridged to another chain, the TBA does not follow

---

## 6. Common Mistakes (We Made These)

| # | Mistake | Fix |
|---|---|---|
| 1 | `account(tokenContract, tokenId)` — 2 params | Needs 5: `account(impl, salt, chainId, nft, tokenId)` |
| 2 | `executeCall(to, value, data)` — custom name | Use `execute(to, value, data, operation)` per spec |
| 3 | `isValidSigner` returns `0xffffffff` for invalid | Return `bytes4(0)` |
| 4 | Missing `state()` function | Required by `IERC6551Account` |
| 5 | Missing `IERC165` / `IERC1271` | Required interfaces |
| 6 | Storing tokenContract/tokenId in storage | Read from proxy bytecode via `extcodecopy` |
| 7 | `withdrawFromTBA` convenience in StockVault | Removed — TBA.execute() gates to NFT owner, so StockVault can't call it. Users must call `TBA.execute()` directly. |

---

## 7. Our Implementation

| Contract | File | Role |
|---|---|---|
| `IERC6551Registry` | `contracts/interfaces/IERC6551Registry.sol` | 5-param interface for canonical registry |
| `StockNFTAccount` | `contracts/ERC6551Account.sol` | TBA implementation — EIP-6551 compliant |
| `StockVault` (TBA helpers) | `contracts/StockVault.sol` | `tbaForToken()`, `_ensureTBA()` |
| `PlatformManager` | `contracts/PlatformManager.sol` | `setERC6551()` one-time setup |

### Verified on Robinhood Testnet
- Registry `0x000000006551...` — ✅ deployed, working
- `createAccount()` — ✅ deploys TBA proxies
- `account()` — ✅ returns deterministic addresses
- `execute()` — ✅ transfers tokens from TBA
- Full lifecycle: mint → claim $G-Pass → claim GOOGL → withdraw ✅
