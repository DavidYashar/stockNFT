// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MockAUsdc
 * @notice Zero-supply token used as placeholder aUsdcToken for MockAavePool testing.
 *         TreasuryVault.currentDeFiBalance() checks aUsdcToken.balanceOf(TV);
 *         since TV never holds this token, balance is always 0,
 *         so the calculation falls back to totalDeFiPrincipal × index / RAY.
 *
 *         For real Aave, this is replaced with the real aToken (aSepUSDC).
 *         The MockAavePool doesn't issue aTokens, so we use this fallback.
 */
contract MockAUsdc {
    string public name = "Mock Aave USDC";
    string public symbol = "aUSDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address, uint256) external pure returns (bool) { return false; }
    function approve(address, uint256) external pure returns (bool) { return false; }
    function transferFrom(address, address, uint256) external pure returns (bool) { return false; }
}
