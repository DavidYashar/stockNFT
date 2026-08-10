// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * @title IERC6551Account
 * @notice EIP-6551 Account interface (ERC-165 identifier: 0x6faff5f1).
 */
interface IERC6551Account {
    receive() external payable;
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4 magicValue);
}

/**
 * @title IERC6551Executable
 * @notice EIP-6551 Execution interface (ERC-165 identifier: 0x51945447).
 */
interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory);
}

/**
 * @title StockNFTAccount
 * @notice ERC-6551 Token Bound Account implementation for GoogleStockNFT.
 *
 *         Compliant with EIP-6551: implements IERC6551Account, IERC6551Executable,
 *         IERC165, and IERC1271. Ownership follows the NFT holder — whoever holds
 *         the NFT controls the TBA and all assets inside.
 *
 *         One implementation deployed. Registry creates ERC-1167 minimal proxies
 *         with appended constant data (salt, chainId, tokenContract, tokenId).
 */
contract StockNFTAccount is IERC165, IERC1271, IERC6551Account, IERC6551Executable {
    using SafeERC20 for IERC20;

    uint256 internal _state;

    // ─── ERC-6551: Initialization (called by registry via createAccount) ───

    /// @notice Initialize the TBA. Called exactly once by the canonical registry.
    function initialize(uint256 /*chainId*/, address /*_nft*/, uint256 /*_id*/) external {
        // Token contract + tokenId are read from appended proxy bytecode, not stored here.
        // We verify initialization by checking _state == 0 (only set once).
        require(_state == 0, "Already initialized");
        _state = 1;
    }

    // ─── ERC-6551 Interface (IERC6551Account) ───

    /// @notice Returns the (chainId, tokenContract, tokenId) from the proxy's appended bytecode.
    function token() public view returns (uint256, address, uint256) {
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    /// @notice Account state — increments on each execute(), per EIP-6551 spec.
    function state() external view returns (uint256) {
        return _state;
    }

    /// @notice The TBA owner = the current NFT owner. Reads fresh from chain each call.
    function owner() public view returns (address) {
        (, address tokenContract, uint256 tokenId) = token();
        if (tokenContract == address(0)) return address(0);
        try IERC721(tokenContract).ownerOf(tokenId) returns (address nftOwner) {
            return nftOwner;
        } catch {
            return address(0);
        }
    }

    // ─── EIP-6551 Execution (IERC6551Executable) ───

    /// @notice Execute a call from the TBA. Only the current NFT owner can call.
    /// @param operation 0 = CALL (only CALL supported)
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable returns (bytes memory result) {
        require(_isValidSigner(msg.sender), "Invalid signer");
        require(operation == 0, "Only CALL supported");

        ++_state;

        (bool success, bytes memory ret) = to.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    // ─── EIP-1271 Signature Validation ───

    /// @notice ERC-1271: validate a signature. Valid if signed by the NFT owner.
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        returns (bytes4 magicValue)
    {
        if (SignatureChecker.isValidSignatureNow(owner(), hash, signature)) {
            return IERC1271.isValidSignature.selector;
        }
        return bytes4(0);
    }

    // ─── ERC-6551: isValidSigner ───

    /// @notice Returns 0x523e3260 if signer is the NFT owner, else bytes4(0).
    function isValidSigner(address signer, bytes calldata /* context */) external view returns (bytes4) {
        if (_isValidSigner(signer)) {
            return IERC6551Account.isValidSigner.selector;
        }
        return bytes4(0);
    }

    function _isValidSigner(address signer) internal view returns (bool) {
        return signer == owner() && signer != address(0);
    }

    // ─── ERC-165 Interface Detection ───

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC6551Account).interfaceId
            || interfaceId == type(IERC6551Executable).interfaceId
            || interfaceId == type(IERC1271).interfaceId;
    }

    // ─── ETH Receiver ───

    receive() external payable {}
}
