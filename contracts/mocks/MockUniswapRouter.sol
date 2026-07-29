// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUniswapRouter
 * @dev Mock Uniswap V3 SwapRouter for Robinhood testnet.
 *
 * Implements exactInput() with a fixed exchange rate:
 *   1 WETH = RATE * 1 GOOGL
 *
 * Used to simulate the ETH → WETH → USDC → GOOGL swap path
 * since Uniswap V3 is not deployed on Robinhood testnet.
 */
contract MockUniswapRouter is Ownable {
    /// @notice GOOGL tokens received per 1 WETH (in GOOGL wei, 18 decimals)
    uint256 public exchangeRate;

    /// @notice GOOGL token address
    address public immutable googlToken;

    /// @notice WETH token address
    address public immutable weth;

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    event Swap(address indexed caller, uint256 wethIn, uint256 googlOut, address recipient);

    constructor(
        address _googlToken,
        address _weth,
        uint256 _exchangeRate,
        address _owner
    ) Ownable(_owner) {
        googlToken = _googlToken;
        weth = _weth;
        exchangeRate = _exchangeRate; // e.g., 1 WETH → 0.2 GOOGL = 200000000000000000
    }

    /// @notice Set the exchange rate (GOOGL per 1 WETH, in 18-decimal wei)
    function setExchangeRate(uint256 _rate) external onlyOwner {
        exchangeRate = _rate;
    }

    /// @notice Mock exactInput — transfers WETH from caller, sends GOOGL to recipient
    function exactInput(
        ExactInputParams calldata params
    ) external payable returns (uint256 amountOut) {
        // Transfer WETH from caller to this contract
        IERC20(weth).transferFrom(msg.sender, address(this), params.amountIn);

        // Calculate GOOGL output at fixed rate
        amountOut = (params.amountIn * exchangeRate) / 1 ether;

        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");

        // Send GOOGL to the recipient
        IERC20(googlToken).transfer(params.recipient, amountOut);

        emit Swap(msg.sender, params.amountIn, amountOut, params.recipient);
    }

    /// @notice Fund this contract with GOOGL so it can fulfill swaps
    function fund(uint256 amount) external {
        IERC20(googlToken).transferFrom(msg.sender, address(this), amount);
    }

    /// @notice Allow owner to withdraw any tokens
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
