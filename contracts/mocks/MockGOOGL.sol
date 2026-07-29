// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockGOOGL
 * @dev Simple ERC-20 mock of Robinhood Chain's GOOGL (Alphabet Class A) token for testnet.
 *
 * Real GOOGL on mainnet (0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3):
 *   - BeaconProxy pattern (EIP-1967)
 *   - Implementation: "Stock" contract
 *   - Compiler: v0.8.33, Prague EVM, 200 runs
 *
 * This mock provides the same ERC-20 interface without the upgradeable proxy complexity.
 */
contract MockGOOGL is ERC20, Ownable {
    constructor() ERC20("Alphabet Class A", "GOOGL") Ownable(msg.sender) {}

    /// @dev Mint test tokens — only owner
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev Anyone can burn their own tokens
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
