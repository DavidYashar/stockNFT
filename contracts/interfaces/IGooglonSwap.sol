// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IGooglonSwap
 * @notice Interface for ETH → GOOGLon swap adapters.
 *         Implemented by MockGooglonSwap (testnet) and GooglonSwapAdapter (mainnet).
 */
interface IGooglonSwap {
    /**
     * @notice Swap ETH for GOOGLon tokens.
     * @param ethAmount Exact amount of ETH to swap (sent as msg.value)
     * @param minGooglonOut Minimum GOOGLon to receive (slippage protection)
     * @return googlonReceived Actual GOOGLon received
     */
    function swapEthForGooglon(
        uint256 ethAmount,
        uint256 minGooglonOut
    ) external payable returns (uint256 googlonReceived);
}
