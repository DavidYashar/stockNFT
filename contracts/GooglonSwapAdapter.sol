// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./interfaces/IGooglonSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IWETH
 * @notice Minimal WETH interface for wrapping/unwrapping native ETH.
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
}

/**
 * @title IUniswapV3Router
 * @notice Minimal Uniswap V3 SwapRouter interface for exactInputSingle.
 */
interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}

/**
 * @title GooglonSwapAdapter
 * @notice Production ETH→GOOGLon swap adapter using Uniswap V3.
 *         Wraps ETH→WETH, swaps WETH→GOOGLon via Uniswap V3, returns GOOGLon to caller.
 *         Only callable by the configured StockVault.
 */
contract GooglonSwapAdapter is IGooglonSwap, Ownable {
    using SafeERC20 for IERC20;

    address public immutable weth;
    address public immutable googlonToken;
    address public immutable swapRouter;
    uint24 public immutable poolFee;
    address public stockVault;

    event SwapExecuted(uint256 ethIn, uint256 googlonOut, uint256 effectivePrice);

    constructor(
        address _weth,
        address _googlonToken,
        address _swapRouter,
        uint24 _poolFee,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_weth != address(0), "Zero WETH");
        require(_googlonToken != address(0), "Zero GOOGLon");
        require(_swapRouter != address(0), "Zero router");
        weth = _weth;
        googlonToken = _googlonToken;
        swapRouter = _swapRouter;
        poolFee = _poolFee;
    }

    /// @notice Set the StockVault address (once).
    function setStockVault(address _sv) external onlyOwner {
        require(stockVault == address(0), "Already set");
        require(_sv != address(0), "Zero address");
        stockVault = _sv;
    }

    /// @notice Swap ETH → WETH → GOOGLon via Uniswap V3.
    ///         Only the StockVault may call this.
    function swapEthForGooglon(
        uint256 ethAmount,
        uint256 minGooglonOut
    ) external payable returns (uint256 googlonReceived) {
        require(msg.sender == stockVault, "Only StockVault");
        require(stockVault != address(0), "StockVault not set");
        require(msg.value == ethAmount, "Wrong ETH amount");

        // Step 1: Wrap ETH → WETH
        IWETH(weth).deposit{value: ethAmount}();
        IWETH(weth).approve(swapRouter, ethAmount);

        // Step 2: Swap WETH → GOOGLon via Uniswap V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router
            .ExactInputSingleParams({
                tokenIn: weth,
                tokenOut: googlonToken,
                fee: poolFee,
                recipient: msg.sender, // GOOGLon goes directly to StockVault
                deadline: block.timestamp + 300,
                amountIn: ethAmount,
                amountOutMinimum: minGooglonOut,
                sqrtPriceLimitX96: 0
            });

        googlonReceived = IUniswapV3Router(swapRouter).exactInputSingle(params);

        emit SwapExecuted(ethAmount, googlonReceived, 0);

        // Refund any leftover WETH
        uint256 wethLeft = IERC20(weth).balanceOf(address(this));
        if (wethLeft > 0) {
            IERC20(weth).safeTransfer(msg.sender, wethLeft);
        }
    }

    /// @notice Allow contract to receive ETH (for WETH unwrapping refunds).
    receive() external payable {}
}
