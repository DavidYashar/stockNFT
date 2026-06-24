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
 * @notice Minimal Uniswap V3 SwapRouter interface for exactInput (multi-hop).
 */
interface IUniswapV3Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(
        ExactInputParams calldata params
    ) external payable returns (uint256 amountOut);
}

/**
 * @title GooglonSwapAdapter
 * @notice Production ETH→GOOGLon swap adapter using Uniswap V3 multi-hop.
 *
 *         Route: ETH → WETH → USDC → GOOGLon
 *         - WETH/USDC pool: 0.05% fee (most liquid)
 *         - GOOGLon/USDC pool: 1% fee (only pool)
 *
 *         Only callable by the configured StockVault.
 */
contract GooglonSwapAdapter is IGooglonSwap, Ownable {
    using SafeERC20 for IERC20;

    address public immutable weth;
    address public immutable usdc;
    address public immutable googlonToken;
    address public immutable swapRouter;
    uint24 public immutable wethUsdcFee;
    uint24 public immutable usdcGooglonFee;
    address public stockVault;

    event SwapExecuted(uint256 ethIn, uint256 googlonOut, uint256 effectivePrice);

    constructor(
        address _weth,
        address _usdc,
        address _googlonToken,
        address _swapRouter,
        uint24 _wethUsdcFee,
        uint24 _usdcGooglonFee,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_weth != address(0), "Zero WETH");
        require(_usdc != address(0), "Zero USDC");
        require(_googlonToken != address(0), "Zero GOOGLon");
        require(_swapRouter != address(0), "Zero router");
        weth = _weth;
        usdc = _usdc;
        googlonToken = _googlonToken;
        swapRouter = _swapRouter;
        wethUsdcFee = _wethUsdcFee;
        usdcGooglonFee = _usdcGooglonFee;
    }

    /// @notice Set the StockVault address (once).
    function setStockVault(address _sv) external onlyOwner {
        require(stockVault == address(0), "Already set");
        require(_sv != address(0), "Zero address");
        stockVault = _sv;
    }

    /// @notice Swap ETH → WETH → USDC → GOOGLon via Uniswap V3 multi-hop.
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

        // Step 2: Build multi-hop path: WETH → fee1 → USDC → fee2 → GOOGLon
        // Path encoding: tokenIn(20) + fee(3) + tokenOut(20) [+ fee(3) + tokenOut(20)]...
        bytes memory path = abi.encodePacked(
            weth,
            wethUsdcFee,
            usdc,
            usdcGooglonFee,
            googlonToken
        );

        // Step 3: Swap via Uniswap V3 exactInput (multi-hop)
        IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router
            .ExactInputParams({
                path: path,
                recipient: msg.sender, // GOOGLon goes directly to StockVault
                deadline: block.timestamp + 300,
                amountIn: ethAmount,
                amountOutMinimum: minGooglonOut
            });

        googlonReceived = IUniswapV3Router(swapRouter).exactInput(params);
        require(googlonReceived >= minGooglonOut, "Slippage exceeded");

        emit SwapExecuted(ethAmount, googlonReceived, 0);

        // Refund any leftover WETH / USDC dust
        uint256 wethLeft = IERC20(weth).balanceOf(address(this));
        if (wethLeft > 0) {
            IERC20(weth).safeTransfer(msg.sender, wethLeft);
        }
        uint256 usdcLeft = IERC20(usdc).balanceOf(address(this));
        if (usdcLeft > 0) {
            IERC20(usdc).safeTransfer(msg.sender, usdcLeft);
        }
    }

    /// @notice Allow contract to receive ETH (for WETH unwrapping refunds).
    receive() external payable {}
}
