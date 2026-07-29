// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC6551Registry.sol";

// ─── Uniswap V3 Interfaces ───

interface IUniswapV3Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface INonfungiblePositionManager {
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
    function mint(MintParams calldata params)
        external payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

/**
 * @title TreasuryVault V3
 * @notice Central hub for StockNFT V3 on Robinhood Chain.
 *
 *         Receives 100% of mint fees (USDG). Splits 80/20 internally.
 *         Three admin sections:
 *           A) LP Creation — PILE + USDG → Uniswap V3 full-range position
 *           B) PILE Airdrop — 50% supply → claimable by NFT holders via TBA
 *           C) GOOGL Purchase — swap pool80 USDG → GOOGL → claimable by holders via TBA
 *
 *         ERC-6551 TBA: deployed at mint time by GoogleStockNFT V3.
 *         Assets always sent to NFT's TBA, never to holder's EOA directly.
 *
 *         Access control:
 *           - Owner (deployer): set addresses, open phases
 *           - Treasury EOA: trigger LP, airdrop, GOOGL purchase
 */
contract TreasuryVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ───
    error NotAuthorized();
    error PurchaseAlreadyExecuted();
    error NotNFTOwner();
    error NothingToClaim();
    error PhaseNotOpen();
    error AlreadyClaimed();
    error InsufficientBalance();

    // ─── Constants ───
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant STOCK_BPS = 8_000;       // 80% → GOOGL purchase
    uint256 public constant REDEMPTION_FEE_BPS = 500; // 5% fee on GOOGL claim

    // ─── Immutable tokens ───
    IERC20 public immutable usdgToken;
    IERC20 public immutable googlToken;
    IERC20 public pileToken;

    // ─── Uniswap V3 addresses ───
    address public immutable swapRouter;                // SwapRouter02
    address public immutable positionManager;           // NonfungiblePositionManager

    // ─── ERC-6551 ───
    address public erc6551Registry;
    address public erc6551Implementation;

    // ─── External contracts ───
    address public googleStockNFT;
    address public platformManager;

    // ─── Admin wallets ───
    address public treasuryEOA;
    address public feeRecipient;

    // ─── Pools (USDG, 6 decimals) ───
    uint256 public pool80;       // 80% — reserved for GOOGL purchase
    uint256 public pool20;       // 20% — LP pairing / platform revenue

    // ═══════════════════════════════════════════
    //  SECTION A: LP Creation
    // ═══════════════════════════════════════════

    uint256 public pileForLP;            // PILE allocated to LP (set by admin)
    uint256 public usdgForLP;            // USDG allocated to LP (set by admin)
    bool public lpCreated;               // Has LP position been created?

    // ═══════════════════════════════════════════
    //  SECTION B: PILE Airdrop (50% to holders)
    // ═══════════════════════════════════════════

    bool public pileClaimsOpen;
    uint256 public totalPileForAirdrop;  // Total PILE allocated to NFT holders
    mapping(uint256 => bool) public pileClaimed; // tokenId → claimed?

    // ═══════════════════════════════════════════
    //  SECTION C: GOOGL Purchase & Claims
    // ═══════════════════════════════════════════

    bool public purchaseComplete;
    bool public googlClaimsOpen;
    uint256 public totalGooglHeld;       // GOOGL purchased (18 decimals)
    uint256 public totalMintPrincipal;   // Total USDG from all mints
    mapping(uint256 => bool) public googlClaimed; // tokenId → claimed?

    // ─── Events ───
    event MintFundsReceived(uint256 amount, uint256 toPool80, uint256 toPool20);
    event LpAmountsSet(uint256 pileAmount, uint256 usdgAmount);
    event LpCreated(uint256 tokenId, uint256 pileUsed, uint256 usdgUsed);
    event AirdropRecorded(uint256 pileAmount);
    event PileClaimed(uint256 indexed tokenId, address indexed user, address indexed tba, uint256 amount);
    event PurchaseExecuted(uint256 usdgSpent, uint256 googlReceived);
    event GooglClaimed(uint256 indexed tokenId, address indexed user, address indexed tba, uint256 toUser, uint256 fee);
    event PileSent(address indexed to, uint256 amount, string label);
    event UsdgSent(address indexed to, uint256 amount, string label);

    // ─── Constructor ───
    constructor(
        address _usdgToken,
        address _googlToken,
        address _swapRouter,
        address _positionManager,
        address _owner,
        address _treasury
    ) Ownable(_owner) {
        require(_usdgToken != address(0) && _googlToken != address(0), "Zero token");
        require(_swapRouter != address(0) && _positionManager != address(0), "Zero router");
        require(_treasury != address(0), "Zero treasury");
        usdgToken = IERC20(_usdgToken);
        googlToken = IERC20(_googlToken);
        swapRouter = _swapRouter;
        positionManager = _positionManager;
        treasuryEOA = _treasury;
        feeRecipient = _treasury;
    }

    // ═══════════════════════════════════════════
    //  SETUP (one-time)
    // ═══════════════════════════════════════════

    function setGoogleStockNFT(address _a) external onlyOwner {
        require(googleStockNFT == address(0), "Already set");
        require(_a != address(0), "Zero");
        googleStockNFT = _a;
    }
    function updateGoogleStockNFT(address _a) external onlyOwner {
        require(_a != address(0), "Zero");
        googleStockNFT = _a;
    }
    function setPlatformManager(address _a) external onlyOwner {
        require(platformManager == address(0), "Already set");
        require(_a != address(0), "Zero");
        platformManager = _a;
    }
    function updatePlatformManager(address _a) external onlyOwner {
        require(_a != address(0), "Zero");
        platformManager = _a;
    }
    function setPileToken(address _a) external onlyOwner {
        require(address(pileToken) == address(0), "Already set");
        pileToken = IERC20(_a);
    }
    function updatePileToken(address _a) external onlyOwner {
        require(_a != address(0), "Zero");
        pileToken = IERC20(_a);
    }
    function updateTreasury(address _a) external onlyOwner {
        require(_a != address(0), "Zero");
        treasuryEOA = _a;
    }
    function setFeeRecipient(address _a) external onlyOwner {
        require(_a != address(0), "Zero");
        feeRecipient = _a;
    }

    /// @notice Set ERC-6551 registry + implementation (one-time).
    function setERC6551(address _registry, address _impl) external onlyOwner {
        require(erc6551Registry == address(0), "Already set");
        require(_registry != address(0) && _impl != address(0), "Zero");
        erc6551Registry = _registry;
        erc6551Implementation = _impl;
    }

    // ═══════════════════════════════════════════
    //  FUND RECEPTION (called by GoogleStockNFT V3)
    // ═══════════════════════════════════════════

    /// @notice Receive 100% of mint USDG. Splits 80/20 internally.
    function receiveMintFunds(uint256 amount) external {
        require(msg.sender == googleStockNFT, "Not NFT");
        // Split into 2 statements to prevent viaIR from reordering mul/div as amount*(bps/denom)=0
        uint256 to80 = amount * STOCK_BPS;
        to80 = to80 / BPS_DENOMINATOR;
        uint256 to20 = amount - to80;
        pool80 = pool80 + to80;
        pool20 = pool20 + to20;
        totalMintPrincipal = totalMintPrincipal + amount;
        emit MintFundsReceived(amount, to80, to20);
    }

    /// @notice Send PILE tokens to any address (diamond hands, team, collaborators, etc.)
    /// @param to Recipient address
    /// @param amount Amount of PILE (6 decimals)
    /// @param label Human-readable label for the transfer (e.g. "Diamond Hands", "Team", "Ecosystem")
    function sendPILE(address to, uint256 amount, string calldata label) external {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(to != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        require(address(pileToken) != address(0), "PILE not set");
        pileToken.safeTransfer(to, amount);
        emit PileSent(to, amount, label);
    }

    /// @notice Send USDG tokens to any address (team payments, expenses, etc.)
    ///         Draws from pool20 first, then pool80. Full access to all mint USDG.
    function sendUSDG(address to, uint256 amount, string calldata label) external nonReentrant {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(to != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        uint256 available = pool20 + pool80;
        require(amount <= available, "Insufficient USDG in vault");
        if (amount <= pool20) {
            pool20 -= amount;
        } else {
            pool80 -= (amount - pool20);
            pool20 = 0;
        }
        usdgToken.safeTransfer(to, amount);
        emit UsdgSent(to, amount, label);
    }

    // ═══════════════════════════════════════════
    //  SECTION A: LP Creation
    // ═══════════════════════════════════════════

    /// @notice Admin sets the PILE + USDG amounts for the LP pair.
    ///         Frontend reads these to display marketcap calculator.
    ///         PILE for LP must be in the contract; it is separate from the airdrop pool.
    function setLpAmounts(uint256 _pileAmount, uint256 _usdgAmount) external {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(!lpCreated, "LP already created");
        require(_pileAmount > 0 && _usdgAmount > 0, "Zero amount");
        // LP PILE must be in the vault before setting amounts
        require(_pileAmount <= pileToken.balanceOf(address(this)),
            "Insufficient PILE in vault");
        pileForLP = _pileAmount;
        usdgForLP = _usdgAmount;
        emit LpAmountsSet(_pileAmount, _usdgAmount);
    }

    /// @notice Returns the implied marketcap based on LP amounts.
    ///         PILE price = usdgForLP / pileForLP
    ///         FDV = price × 1,000,000,000 (1B total supply)
    function getMarketCap() external view returns (uint256 pilePrice, uint256 fdv) {
        if (pileForLP == 0 || usdgForLP == 0) return (0, 0);
        // PILE has 6 decimals, USDG has 6 decimals
        // pilePrice = usdgForLP * 1e12 / pileForLP  → price per PILE in USDG (6 decimals)
        pilePrice = (usdgForLP * 1e12) / pileForLP;
        // FDV = pilePrice * 1B (1_000_000_000 * 1e6) / 1e12 → adjusted for display
        fdv = (pilePrice * 1_000_000_000) / 1e6;
    }

    /// @notice Create Uniswap V3 full-range LP position for PILE/USDG.
    ///         USDG for LP is drawn from pool20. PILE must already be in this contract.
    ///         The LP NFT is sent to treasuryEOA (trusted admin wallet).
    function createLP(uint256 minPileOut, uint256 minUsdgOut)
        external nonReentrant returns (uint256 lpTokenId)
    {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(!lpCreated, "LP already created");
        require(pileForLP > 0 && usdgForLP > 0, "Set LP amounts first");
        require(address(pileToken) != address(0), "PILE not set");

        // Guard: USDG for LP must not exceed pool20 allocation
        require(usdgForLP <= pool20, "Insufficient pool20 for LP");
        // Guard: vault must actually hold the PILE committed to LP
        require(pileForLP <= pileToken.balanceOf(address(this)), "Insufficient PILE in vault");

        lpCreated = true;

        // Determine token0/token1 (lower address = token0)
        bool pileIsToken0 = address(pileToken) < address(usdgToken);
        address token0 = pileIsToken0 ? address(pileToken) : address(usdgToken);
        address token1 = pileIsToken0 ? address(usdgToken) : address(pileToken);
        uint256 amount0 = pileIsToken0 ? pileForLP : usdgForLP;
        uint256 amount1 = pileIsToken0 ? usdgForLP : pileForLP;
        uint256 min0 = pileIsToken0 ? minPileOut : minUsdgOut;
        uint256 min1 = pileIsToken0 ? minUsdgOut : minPileOut;

        // Approve both tokens
        pileToken.approve(positionManager, pileForLP);
        usdgToken.approve(positionManager, usdgForLP);

        // Create full-range position
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: 10_000,            // 1% fee tier (new volatile token)
            tickLower: -887272,     // MIN_TICK for full range
            tickUpper: 887272,      // MAX_TICK for full range
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: min0,
            amount1Min: min1,
            recipient: treasuryEOA,  // LP NFT goes to treasury
            deadline: block.timestamp + 300
        });
        uint128 liquidity;
        uint256 used0; uint256 used1;
        (lpTokenId, liquidity, used0, used1) = INonfungiblePositionManager(positionManager).mint(params);

        // Refund unused approvals
        uint256 unusedPile = pileIsToken0 ? (pileForLP - used0) : (pileForLP - used1);
        uint256 unusedUsdg = pileIsToken0 ? (usdgForLP - used1) : (usdgForLP - used0);
        if (unusedPile > 0) pileToken.safeTransfer(treasuryEOA, unusedPile);
        if (unusedUsdg > 0) usdgToken.safeTransfer(treasuryEOA, unusedUsdg);

        // Deduct actual USDG used from pool20
        uint256 usedUsdg = usdgForLP - unusedUsdg;
        if (usedUsdg > 0) pool20 -= usedUsdg;

        emit LpCreated(lpTokenId, pileForLP - unusedPile, usdgForLP - unusedUsdg);
    }

    // ═══════════════════════════════════════════
    //  SECTION B: PILE Airdrop
    // ═══════════════════════════════════════════

    /// @notice Records the PILE amount for airdrop to NFT holders.
    ///         Call after PileToken has transferred PILE to this contract.
    ///         Vault's actual PILE balance is the source of truth.
    function airdropPILE(uint256 pileAmount) external {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(pileAmount > 0, "Zero");
        require(pileAmount <= pileToken.balanceOf(address(this)),
            "Insufficient PILE in vault");
        require(totalPileForAirdrop == 0, "Already recorded"); // one-shot
        totalPileForAirdrop = pileAmount;
        emit AirdropRecorded(pileAmount);
    }

    /// @notice Open PILE claims for NFT holders.
    ///         Requires mint to have ended so totalMintPrincipal is frozen.
    function openPileClaims() external {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(totalPileForAirdrop > 0, "Airdrop not recorded");
        // Ensure mint has ended so totalMintPrincipal cannot change during claims
        (bool ok, bytes memory data) = platformManager.staticcall(
            abi.encodeWithSignature("mintEnded()")
        );
        require(ok && abi.decode(data, (bool)), "Mint not ended");
        pileClaimsOpen = true;
    }

    /// @notice NFT holder claims their proportional PILE share.
    ///         PILE sent to the NFT's TBA.
    function claimPILE(uint256 tokenId) external nonReentrant {
        require(pileClaimsOpen, "PILE claims not open");
        require(!pileClaimed[tokenId], "Already claimed");
        require(_isNFTOwner(tokenId, msg.sender), "Not NFT owner");

        uint256 share = _getPileShare(tokenId);
        require(share > 0, "No PILE share");

        pileClaimed[tokenId] = true;

        address tba = _ensureTBA(tokenId);
        pileToken.safeTransfer(tba, share);

        _autoMarkSoulbound(tokenId);

        emit PileClaimed(tokenId, msg.sender, tba, share);
    }

    function _getPileShare(uint256 tokenId) internal view returns (uint256) {
        if (totalPileForAirdrop == 0 || totalMintPrincipal == 0) return 0;
        uint256 principal = _getMintPrincipal(tokenId);
        if (principal == 0) return 0;
        return (totalPileForAirdrop * principal) / totalMintPrincipal;
    }

    // ═══════════════════════════════════════════
    //  SECTION C: GOOGL Purchase & Claims
    // ═══════════════════════════════════════════

    /// @notice Swap pool80 USDG for GOOGL via Uniswap V3.
    /// @param usdgAmount Amount of USDG to spend (≤ pool80)
    /// @param minGooglOut Minimum GOOGL expected (slippage protection)
    function purchaseGOOGL(uint256 usdgAmount, uint256 minGooglOut)
        external nonReentrant returns (uint256 googlReceived)
    {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(!purchaseComplete, "Already executed");
        require(usdgAmount > 0 && usdgAmount <= pool80, "Invalid amount");

        purchaseComplete = true;
        pool80 -= usdgAmount;

        // Approve & swap USDG → GOOGL
        usdgToken.approve(swapRouter, usdgAmount);

        // Path: USDG → GOOGL (direct pool, or via WETH)
        bytes memory path = _getUsdgToGooglPath();

        IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router.ExactInputParams({
            path: path,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: usdgAmount,
            amountOutMinimum: minGooglOut
        });
        googlReceived = IUniswapV3Router(swapRouter).exactInput(params);
        require(googlReceived >= minGooglOut, "Slippage");

        totalGooglHeld = googlReceived;

        // Refund any extra USDG (slippage surplus) — only if balance exceeds both pools
        uint256 balanceNow = usdgToken.balanceOf(address(this));
        uint256 totalPools = pool80 + pool20;
        if (balanceNow > totalPools) {
            pool20 += (balanceNow - totalPools);
        }

        emit PurchaseExecuted(usdgAmount, googlReceived);
    }

    /// @notice Returns the swap path for USDG → GOOGL.
    ///         Encoded as: [tokenIn, fee, tokenOut] — 43 bytes if direct pool exists.
    ///         Override with setSwapPath if routing through WETH.
    function _getUsdgToGooglPath() internal view returns (bytes memory) {
        // Direct path: USDG → GOOGL (0.3% pool assumed)
        return abi.encodePacked(address(usdgToken), uint24(3000), address(googlToken));
    }

    /// @notice Open GOOGL claims for NFT holders.
    function openGOOGLClaims() external {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(purchaseComplete, "Purchase not done");
        googlClaimsOpen = true;
    }

    /// @notice NFT holder claims their proportional GOOGL share.
    ///         GOOGL sent to TBA. 5% fee taken and sent to feeRecipient.
    function claimGOOGL(uint256 tokenId) external nonReentrant {
        require(purchaseComplete, "Purchase not complete");
        require(googlClaimsOpen, "GOOGL claims not open");
        require(!googlClaimed[tokenId], "Already claimed");
        require(_isNFTOwner(tokenId, msg.sender), "Not NFT owner");

        uint256 shares = _getGooglShare(tokenId);
        require(shares > 0, "No GOOGL shares");

        googlClaimed[tokenId] = true;

        address tba = _ensureTBA(tokenId);

        uint256 fee = (shares * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 toUser = shares - fee;

        googlToken.safeTransfer(tba, toUser);
        googlToken.safeTransfer(feeRecipient, fee);

        _autoMarkSoulbound(tokenId);

        emit GooglClaimed(tokenId, msg.sender, tba, toUser, fee);
    }

    function _getGooglShare(uint256 tokenId) internal view returns (uint256) {
        if (totalGooglHeld == 0 || totalMintPrincipal == 0) return 0;
        uint256 principal = _getMintPrincipal(tokenId);
        if (principal == 0) return 0;
        return (totalGooglHeld * principal) / totalMintPrincipal;
    }

    // ═══════════════════════════════════════════
    //  ERC-6551 TBA Helpers
    // ═══════════════════════════════════════════

    /// @notice Get the deterministic TBA address for a token ID.
    function tbaForToken(uint256 tokenId) public view returns (address) {
        if (erc6551Registry == address(0) || erc6551Implementation == address(0)) return address(0);
        return IERC6551Registry(erc6551Registry).account(
            erc6551Implementation,
            bytes32(0),
            block.chainid,
            googleStockNFT,
            tokenId
        );
    }

    /// @notice Deploy TBA if not already deployed. Returns the TBA address.
    function _ensureTBA(uint256 tokenId) internal returns (address tba) {
        tba = tbaForToken(tokenId);
        if (tba.code.length == 0) {
            tba = IERC6551Registry(erc6551Registry).createAccount(
                erc6551Implementation,
                bytes32(0),
                block.chainid,
                googleStockNFT,
                tokenId
            );
        }
    }

    /// @notice Returns the TBA address for a token and the recommended way to withdraw.
    ///         Assets live in the NFT's Token Bound Account (TBA).
    ///         To withdraw, the NFT owner calls execute() on the TBA directly:
    ///           tba.execute(token, 0, abi.encodeWithSignature("transfer(address,uint256)", to, amount), 0)
    ///         TreasuryVault does NOT hold user assets — it only distributes to TBAs.
    function getTBA(uint256 tokenId) external view returns (address tba) {
        return tbaForToken(tokenId);
    }

    // ═══════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═══════════════════════════════════════════

    function _getMintPrincipal(uint256 tokenId) internal view returns (uint256) {
        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("mintPrincipal(uint256)", tokenId)
        );
        if (!ok) return 0;
        return abi.decode(data, (uint256));
    }

    function _isNFTOwner(uint256 tokenId, address user) internal view returns (bool) {
        require(googleStockNFT != address(0), "NFT not set");
        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        return ok && abi.decode(data, (address)) == user;
    }

    /// @notice If both PILE and GOOGL claimed, mark NFT as soulbound.
    function _autoMarkSoulbound(uint256 tokenId) internal {
        if (pileClaimed[tokenId] && googlClaimed[tokenId]) {
            (bool ok, ) = googleStockNFT.call(
                abi.encodeWithSignature("markSoulbound(uint256)", tokenId)
            );
            if (!ok) {} // best-effort
        }
    }

    // ═══════════════════════════════════════════
    //  ADMIN: Emergency / Recovery
    // ═══════════════════════════════════════════

    /// @notice Recover mistakenly sent tokens (not PILE/USDG/GOOGL).
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(pileToken), "Cannot recover PILE");
        require(token != address(usdgToken), "Cannot recover USDG");
        require(token != address(googlToken), "Cannot recover GOOGL");
        IERC20(token).safeTransfer(treasuryEOA, amount);
    }
}
