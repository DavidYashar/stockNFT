// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IUniswapV4PoolManager
 * @notice Minimal Uniswap V4 Pool Manager interface for swap operations.
 */
interface IUniswapV4PoolManager {
    struct SwapParams {
        address pool;
        bool zeroForOne; // true = USDC→GOOGLon, false = GOOGLon→USDC
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    function swap(
        SwapParams calldata params,
        bytes calldata hookData
    ) external returns (int256 amount0, int256 amount1);
}

/**
 * @title StockVault
 * @notice Executes the one-time Google (GOOGLon) purchase via Uniswap V4
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
    uint48 public constant REDEMPTION_DELAY = 48 hours;
    uint256 public constant REDEMPTION_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ==================== State ====================
    IERC20 public immutable usdcToken;
    IERC20 public immutable googlonToken;
    IUniswapV4PoolManager public immutable uniswapPoolManager;
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
        address _uniswapPoolManager,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_usdcToken != address(0), "Zero USDC");
        require(_googlonToken != address(0), "Zero GOOGLon");
        require(_uniswapPoolManager != address(0), "Zero Uniswap PM");
        usdcToken = IERC20(_usdcToken);
        googlonToken = IERC20(_googlonToken);
        uniswapPoolManager = IUniswapV4PoolManager(_uniswapPoolManager);
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

    // ==================== Fund Reception ====================

    /**
     * @notice Receive 80% pool funds from TreasuryVault.
     */
    function receivePool80Funds(uint256 amount) external {
        require(
            msg.sender == owner() || msg.sender == platformManager || msg.sender == treasuryVault,
            "Not authorized"
        );
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        pool80Funds += amount;
    }

    /**
     * @notice Receive loyalty funds from PlatformManager.
     */
    function receiveLoyaltyFunds(uint256 amount) external {
        require(
            msg.sender == owner() || msg.sender == platformManager,
            "Not authorized"
        );
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        loyaltyFunds += amount;
    }

    // ==================== Google Purchase ====================

    /**
     * @notice Execute the one-time GOOGLon purchase on Uniswap V4.
     *         Only PlatformManager. Can only be called once.
     * @param totalUSDC Total USDC to spend (pool80 + loyalty)
     * @return googlonReceived Amount of GOOGLon purchased
     */
    function executeGooglePurchase(
        uint256 totalUSDC
    ) external onlyPlatformManager returns (uint256 googlonReceived) {
        require(!purchaseComplete, "Already executed");
        require(totalUSDC > 0, "Zero amount");
        require(
            usdcToken.balanceOf(address(this)) >= totalUSDC,
            "Insufficient USDC"
        );

        purchaseComplete = true;

        // Approve USDC to Uniswap Pool Manager
        usdcToken.safeIncreaseAllowance(
            address(uniswapPoolManager),
            totalUSDC
        );

        // Execute swap: USDC → GOOGLon via Uniswap V4.
        // Pool address and parameters are configured by the keeper bot
        // before calling this function.
        // For testnet, we simulate the swap result.
        googlonReceived = _simulateSwap(totalUSDC);

        totalGooglonHeld = googlonReceived;

        emit PurchaseExecuted(totalUSDC, googlonReceived);
    }

    /**
     * @dev Placeholder swap simulation. In production, this calls Uniswap V4.
     *      The actual swap logic will be implemented when integrating with
     *      the live Uniswap V4 GOOGLon/USDC pool.
     */
    function _simulateSwap(uint256 usdcAmount) private returns (uint256) {
        // Placeholder: assume 1 GOOGLon ≈ 365 USDC
        // Real implementation: call uniswapPoolManager.swap()
        uint256 googlonAmount = (usdcAmount * 1e18) / 365_00000000; // ~365 USD with 8 decimals
        return googlonAmount;
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
        require(nftShares[tokenId] > 0, "No shares to redeem");

        // Verify caller is the NFT owner
        require(googleStockNFT != address(0), "NFT contract not set");
        (bool success, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature(
                "balanceOf(address,uint256)",
                msg.sender,
                tokenId
            )
        );
        require(success && abi.decode(data, (uint256)) > 0, "Not NFT owner");

        // Burn the NFT
        (bool burned, ) = googleStockNFT.call(
            abi.encodeWithSignature(
                "burn(address,uint256,uint256)",
                msg.sender,
                tokenId,
                1
            )
        );
        require(burned, "Burn failed");

        redemptionRequest[tokenId] = uint48(block.timestamp);

        emit RedemptionRequested(tokenId, msg.sender, nftShares[tokenId]);
    }

    /**
     * @notice Claim redemption after 48h. Sends GOOGLon minus 5% fee.
     * @param tokenId The NFT token ID
     */
    function claimRedemption(uint256 tokenId) external {
        uint48 requestedAt = redemptionRequest[tokenId];
        if (requestedAt == 0) revert RedemptionNotRequested();

        uint48 availableAt = requestedAt + REDEMPTION_DELAY;
        if (block.timestamp < availableAt)
            revert RedemptionTooEarly(availableAt);

        uint256 shares = nftShares[tokenId];
        if (shares == 0) revert NothingToRedeem();

        // Calculate fees
        uint256 fee = (shares * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 toUser = shares - fee;

        // Reset state
        nftShares[tokenId] = 0;
        redemptionRequest[tokenId] = 0;

        // Transfer GOOGLon
        googlonToken.safeTransfer(msg.sender, toUser);
        googlonToken.safeTransfer(owner(), fee);

        emit RedemptionClaimed(tokenId, msg.sender, toUser, fee);
    }
}
