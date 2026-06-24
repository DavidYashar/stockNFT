// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IGooglonSwap
 * @notice Minimal interface for swapping ETH → GOOGLon.
 *         Testnet: MockGooglonSwap mints MockGOOGLon at fixed price.
 *         Mainnet: GooglonSwapAdapter uses Uniswap V3/V4 for real swaps.
 */
interface IGooglonSwap {
    function swapEthForGooglon(
        uint256 ethAmount,
        uint256 minGooglonOut
    ) external payable returns (uint256 googlonReceived);
}

/**
 * @title StockVault
 * @notice Executes the one-time Google (GOOGLon) purchase via a swap adapter
 *         and handles user redemptions with a 48-hour delay and 5% fee.
 */
contract StockVault is Ownable {
    using SafeERC20 for IERC20;

    // ==================== Errors ====================
    error OnlyPlatformManager();
    error PurchaseAlreadyExecuted();
    error RedemptionNotRequested();
    error RedemptionTooEarly(uint48 availableAt);
    error NotNFTOwner();
    error NothingToRedeem();

    // ==================== Constants ====================
    uint256 public constant REDEMPTION_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ==================== Configurable (set by owner) ====================
    uint48 public redemptionDelay = 48 hours;
    address public feeRecipient;                // Receives redemption fees

    // ==================== State ====================
    IERC20 public immutable usdcToken;
    IERC20 public immutable googlonToken;
    IGooglonSwap public googlonSwap;           // ETH→GOOGLon swap adapter
    address public platformManager;
    address public googleStockNFT;
    address public treasuryVault;

    /// @notice Total GOOGLon held by the vault after the one-time purchase
    uint256 public totalGooglonHeld;

    /// @notice Whether the one-time Google purchase has been completed
    bool public purchaseComplete;

    /// @notice USDC received from pool80 (TreasuryVault)
    uint256 public pool80Funds;

    /// @notice USDC received from loyalty fees (PlatformManager)
    uint256 public loyaltyFunds;

    /// @notice GOOGLon allocation per NFT token ID
    mapping(uint256 => uint256) public nftShares;

    /// @notice Timestamp when redemption was requested (0 = not requested)
    mapping(uint256 => uint48) public redemptionRequest;

    /// @notice Address that requested redemption (prevents front-running claims)
    mapping(uint256 => address) public redemptionRequester;

    // ==================== Events ====================
    event PurchaseExecuted(uint256 usdcSpent, uint256 googlonReceived);
    event RedemptionRequested(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 googlonAmount
    );
    event RedemptionClaimed(
        uint256 indexed tokenId,
        address indexed user,
        uint256 amountAfterFee,
        uint256 fee
    );

    // ==================== Modifiers ====================
    modifier onlyPlatformManager() {
        require(msg.sender == platformManager, "Not PlatformManager");
        _;
    }

    // ==================== Constructor ====================
    constructor(
        address _usdcToken,
        address _googlonToken,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_usdcToken != address(0), "Zero USDC");
        require(_googlonToken != address(0), "Zero GOOGLon");
        usdcToken = IERC20(_usdcToken);
        googlonToken = IERC20(_googlonToken);
        feeRecipient = _initialOwner;
    }

    // ==================== Initial Setup ====================

    function setPlatformManager(address _addr) external onlyOwner {
        require(platformManager == address(0), "Already set");
        platformManager = _addr;
    }

    /// @notice Update the PlatformManager address (for upgrades)
    function updatePlatformManager(address _addr) external onlyOwner {
        require(_addr != address(0), "Invalid address");
        platformManager = _addr;
    }

    function setGoogleStockNFT(address _addr) external onlyOwner {
        require(googleStockNFT == address(0), "Already set");
        googleStockNFT = _addr;
    }

    /// @notice Update the NFT address after initial setup (e.g., contract upgrade)
    function updateGoogleStockNFT(address _addr) external onlyOwner {
        require(_addr != address(0), "Zero address"); googleStockNFT = _addr;
    }

    function setTreasuryVault(address _addr) external onlyOwner {
        require(treasuryVault == address(0), "Already set");
        treasuryVault = _addr;
    }

    function updateTreasuryVault(address _addr) external onlyOwner {
        require(_addr != address(0), "Zero address"); treasuryVault = _addr;
    }

    function setRedemptionDelay(uint48 _delay) external onlyOwner {
        require(_delay > 0, "Cannot be zero");
        redemptionDelay = _delay;
    }

    function setFeeRecipient(address _addr) external onlyOwner {
        require(_addr != address(0), "Zero address");
        feeRecipient = _addr;
    }

    /// @notice Set the ETH→GOOGLon swap adapter (once). Testnet: MockGooglonSwap. Mainnet: GooglonSwapAdapter.
    function setGooglonSwap(address _swap) external onlyOwner {
        require(address(googlonSwap) == address(0), "Already set");
        require(_swap != address(0), "Zero address");
        googlonSwap = IGooglonSwap(_swap);
    }

    /// @notice Update the swap adapter address (e.g., for upgrades).
    function updateGooglonSwap(address _swap) external onlyOwner {
        require(_swap != address(0), "Zero address");
        googlonSwap = IGooglonSwap(_swap);
    }

    // ==================== Fund Reception (ETH — sent by Treasury EOA) ====================

    /**
     * @notice Receive 80% pool funds from Treasury EOA (in native ETH).
     */
    function receivePool80Funds() external payable {
        require(
            msg.sender == owner() || msg.sender == platformManager || msg.sender == treasuryVault,
            "Not authorized"
        );
        pool80Funds += msg.value;
    }

    /**
     * @notice Receive loyalty funds from Treasury EOA (in native ETH).
     */
    function receiveLoyaltyFunds() external payable {
        require(
            msg.sender == owner() || msg.sender == platformManager,
            "Not authorized"
        );
        loyaltyFunds += msg.value;
    }

    // ==================== Google Purchase ====================

    /**
     * @notice Execute the one-time GOOGLon purchase. Only PlatformManager.
     * @param totalETH Total ETH to swap (typically totalMintPrincipal)
     * @param minGooglonOut Minimum GOOGLon to receive (slippage protection)
     */
    function executeGooglePurchase(
        uint256 totalETH,
        uint256 minGooglonOut
    ) external onlyPlatformManager returns (uint256 googlonReceived) {
        require(!purchaseComplete, "Already executed");
        require(totalETH > 0, "Zero amount");
        require(address(this).balance >= totalETH, "Insufficient ETH");

        purchaseComplete = true;
        googlonReceived = _executeSwap(totalETH, minGooglonOut);
        totalGooglonHeld = googlonReceived;

        emit PurchaseExecuted(totalETH, googlonReceived);
    }

    /// @notice Calculate GOOGLon shares for a token — dynamic, no pre-assignment needed
    function getShares(uint256 tokenId) public view returns (uint256) {
        if (nftShares[tokenId] > 0) return nftShares[tokenId];
        if (totalGooglonHeld == 0) return 0;

        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("mintPrincipal(uint256)", tokenId)
        );
        if (!ok) return 0;
        uint256 principal = abi.decode(data, (uint256));
        if (principal == 0) return 0;

        (bool ok2, bytes memory data2) = platformManager.staticcall(
            abi.encodeWithSignature("totalMintPrincipal()")
        );
        if (!ok2) return 0;
        uint256 totalPrincipal = abi.decode(data2, (uint256));
        if (totalPrincipal == 0) return 0;

        return (totalGooglonHeld * principal) / totalPrincipal;
    }

    /**
     * @dev Executes ETH→GOOGLon swap via the configured adapter.
     *      The GooglonSwapAdapter wraps ETH→WETH, swaps via Uniswap V3.
     * @param ethAmount Amount of ETH to swap
     * @param minGooglonOut Minimum GOOGLon to receive (slippage protection)
     * @return googlonReceived Amount of GOOGLon received
     */
    function _executeSwap(uint256 ethAmount, uint256 minGooglonOut) private returns (uint256 googlonReceived) {
        require(address(googlonSwap) != address(0), "Swap adapter not set");

        googlonReceived = googlonSwap.swapEthForGooglon{value: ethAmount}(
            ethAmount,
            minGooglonOut
        );

        require(googlonReceived > 0, "Swap returned 0 GOOGLon");
    }

    /// @notice Withdraw surplus ETH (loyalty fees beyond what was swapped) back to treasury.
    function withdrawSurplus() external {
        require(msg.sender == owner() || msg.sender == platformManager, "Not authorized");
        require(purchaseComplete, "Purchase not yet executed");
        uint256 surplus = address(this).balance;
        require(surplus > 0, "No surplus");
        payable(owner()).transfer(surplus);
    }

    /**
     * @notice After the purchase, assign proportional GOOGLon shares to each NFT.
     *         Called by PlatformManager after executeGooglePurchase.
     * @param tokenIds Array of token IDs to assign shares to
     * @param principals Array of USDC principals for each token ID
     * @param totalPrincipal Sum of all principals
     */
    function assignShares(
        uint256[] calldata tokenIds,
        uint256[] calldata principals,
        uint256 totalPrincipal
    ) external onlyPlatformManager {
        require(purchaseComplete, "Purchase not complete");
        require(tokenIds.length == principals.length, "Length mismatch");
        require(totalPrincipal > 0, "Zero principal");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (principals[i] > 0) {
                nftShares[tokenIds[i]] =
                    (totalGooglonHeld * principals[i]) /
                    totalPrincipal;
            }
        }
    }

    // ==================== Redemption ====================

    /**
     * @notice Request redemption. Burns the NFT and starts 48h countdown.
     *         Only the current NFT owner can call this.
     * @param tokenId The NFT to redeem
     */
    function requestRedemption(uint256 tokenId) external {
        require(purchaseComplete, "Purchase not complete");
        uint256 shares = getShares(tokenId);
        require(shares > 0, "No shares to redeem");

        // Verify caller is the NFT owner (ERC-721)
        require(googleStockNFT != address(0), "NFT contract not set");
        (bool success, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(success && abi.decode(data, (address)) == msg.sender, "Not NFT owner");

        // Burn the NFT (ERC-721)
        (bool burned, ) = googleStockNFT.call(
            abi.encodeWithSignature("burnForRedemption(uint256)", tokenId)
        );
        require(burned, "Burn failed");

        redemptionRequest[tokenId] = uint48(block.timestamp);
        redemptionRequester[tokenId] = msg.sender;

        emit RedemptionRequested(tokenId, msg.sender, shares);
    }

    /**
     * @notice Claim redemption after 48h. Sends GOOGLon minus 5% fee.
     * @param tokenId The NFT token ID
     */
    function claimRedemption(uint256 tokenId) external {
        uint48 requestedAt = redemptionRequest[tokenId];
        if (requestedAt == 0) revert RedemptionNotRequested();

        require(msg.sender == redemptionRequester[tokenId], "Not the requester");

        uint48 availableAt = requestedAt + redemptionDelay;
        if (block.timestamp < availableAt)
            revert RedemptionTooEarly(availableAt);

        uint256 shares = getShares(tokenId);
        if (shares == 0) revert NothingToRedeem();

        // Calculate fees
        uint256 fee = (shares * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 toUser = shares - fee;

        // Reset state
        nftShares[tokenId] = 0;
        redemptionRequest[tokenId] = 0;

        // Transfer GOOGLon
        googlonToken.safeTransfer(msg.sender, toUser);
        googlonToken.safeTransfer(feeRecipient, fee);

        emit RedemptionClaimed(tokenId, msg.sender, toUser, fee);
    }
}
