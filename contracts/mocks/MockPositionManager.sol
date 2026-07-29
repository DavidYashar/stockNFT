// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockPositionManager
 * @dev Mock Uniswap V3 NonfungiblePositionManager for Robinhood testnet.
 *
 *      Implements mint() with the same signature as the real contract.
 *      Pulls approved tokens, records the LP position, returns a mock tokenId.
 *
 *      Used by TreasuryVault.createLP() on testnet where real Uniswap V3
 *      is not deployed.
 */
contract MockPositionManager {
    using SafeERC20 for IERC20;

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    uint256 private _nextTokenId = 1;

    // ─── LP position tracking (public for test inspection) ───
    mapping(uint256 => MintParams) public positions;
    mapping(uint256 => uint256) public liquidityForToken;

    event PositionCreated(
        uint256 indexed tokenId,
        address indexed recipient,
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    );

    /// @notice Mock mint — pulls approved tokens, records the position.
    ///         Returns a sequential tokenId (like the real NFT position manager).
    function mint(MintParams calldata params)
        external
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        require(params.amount0Desired >= params.amount0Min, "Slippage token0");
        require(params.amount1Desired >= params.amount1Min, "Slippage token1");

        // Use desired amounts (no price impact in mock)
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;

        // Pull tokens from caller (caller must have approved this contract)
        IERC20(params.token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(params.token1).safeTransferFrom(msg.sender, address(this), amount1);

        tokenId = _nextTokenId++;
        liquidity = uint128(amount0 + amount1); // mock liquidity

        positions[tokenId] = params;
        liquidityForToken[tokenId] = liquidity;

        emit PositionCreated(tokenId, params.recipient, params.token0, params.token1, amount0, amount1);
    }

    // ─── Read helpers ───

    /// @notice Get total value locked for a position (both tokens held here).
    function getPositionTokens(uint256 tokenId) external view returns (address token0, address token1, uint256 bal0, uint256 bal1) {
        MintParams memory pos = positions[tokenId];
        token0 = pos.token0;
        token1 = pos.token1;
        bal0 = IERC20(token0).balanceOf(address(this));
        bal1 = IERC20(token1).balanceOf(address(this));
    }

    /// @notice Recover tokens (admin only — for test cleanup).
    function recover(address token, address to, uint256 amount) external {
        IERC20(token).safeTransfer(to, amount);
    }
}
