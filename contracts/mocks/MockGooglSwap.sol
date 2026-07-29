// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockGooglSwap
 * @dev Mock swap for Robinhood testnet. Takes any ERC-20 token as input,
 *      mints MockGOOGL at a fixed rate. Simulates Uniswap V3 exactInput.
 *
 *      Used by StockVault.executeGooglePurchase() on testnet where
 *      real Uniswap V3 GOOGL pools don't exist.
 */
contract MockGooglSwap is Ownable {
    IERC20 public immutable googlToken;

    /// @notice GOOGL tokens received per 1 input token (in GOOGL wei, 18 decimals)
    uint256 public exchangeRate; // e.g., 1 USDG → 0.2 GOOGL = 200000000000000000

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    event Swap(address indexed caller, uint256 amountIn, uint256 googlOut, address recipient);

    constructor(address _googlToken, uint256 _exchangeRate, address _owner) Ownable(_owner) {
        googlToken = IERC20(_googlToken);
        exchangeRate = _exchangeRate;
    }

    function setExchangeRate(uint256 _rate) external onlyOwner { exchangeRate = _rate; }

    /// @notice Mock exactInput — pulls USDG from caller, sends GOOGL at fixed rate.
    function exactInput(ExactInputParams calldata params) external returns (uint256 amountOut) {
        // Extract input token from path (first 20 bytes of encoded path)
        bytes memory pathBytes = params.path;
        address tokenIn;
        assembly {
            tokenIn := shr(96, mload(add(pathBytes, 32)))
        }

        // Pull the input tokens from the caller (must be pre-approved)
        IERC20(tokenIn).transferFrom(params.recipient, address(this), params.amountIn);

        // Normalize: amountIn (6 dec) * rate (18 dec) * 1e12 / 1e18 → GOOGL (18 dec)
        amountOut = (params.amountIn * exchangeRate * 1e12) / 1e18;
        require(amountOut >= params.amountOutMinimum, "Slippage exceeded");

        // Send GOOGL to recipient
        IERC20(googlToken).transfer(params.recipient, amountOut);

        emit Swap(msg.sender, params.amountIn, amountOut, params.recipient);
    }

    function fund(uint256 amount) external {
        IERC20(googlToken).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
