// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC6551Registry.sol";

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

/**
 * @title StockVault V2 (ERC-6551)
 * @notice Receives 80% of USDG mint fees, swaps USDG→GOOGL via Uniswap V3,
 *         and handles two-phase claims via Token Bound Accounts (TBA).
 *
 *           Phase 1 — claimOurToken → $G-Pass sent to NFT's TBA
 *           Phase 2 — claimGOOGL → GOOGL sent to NFT's TBA (minus 5% fee)
 *
 *         NFT is never burned. After both claims, NFT becomes soulbound.
 *         Users withdraw assets from TBA to wallet via withdrawFromTBA().
 */
contract StockVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error PurchaseAlreadyExecuted();
    error NotNFTOwner();
    error NothingToClaim();
    error PhaseNotOpen();
    error AlreadyClaimed();

    uint256 public constant REDEMPTION_FEE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─── Immutable tokens ───
    IERC20 public immutable usdgToken;
    IERC20 public immutable googlToken;
    IERC20 public ourToken;

    // ─── Uniswap V3 config ───
    address public immutable swapRouter;
    bytes public usdgToGooglPath;

    // ─── ERC-6551 ───
    address public erc6551Registry;
    address public erc6551Implementation;

    // ─── Admin addresses ───
    address public platformManager;
    address public googleStockNFT;
    address public treasuryEOA;
    address public feeRecipient;

    // ─── Phase 1: $G-Pass claim ───
    bool public phase1Open;
    uint256 public totalOurTokenForRedemption;
    mapping(uint256 => bool) public ourTokenClaimed;

    // ─── Phase 2: GOOGL claim ───
    bool public purchaseComplete;
    bool public googlClaimable;
    uint256 public totalGooglonHeld;
    mapping(uint256 => bool) public googlClaimed;

    // ─── Events ───
    event MintFundsReceived(uint256 amount);
    event PurchaseExecuted(uint256 usdgSpent, uint256 googlonReceived);
    event Phase1Claimed(uint256 indexed tokenId, address indexed user, address indexed tba, uint256 amount);
    event GOOGLClaimed(uint256 indexed tokenId, address indexed user, address indexed tba, uint256 toUser, uint256 fee);

    constructor(
        address _usdgToken,
        address _googlToken,
        address _swapRouter,
        address _owner,
        address _treasury
    ) Ownable(_owner) {
        require(_usdgToken != address(0) && _googlToken != address(0) && _swapRouter != address(0), "Zero addr");
        usdgToken = IERC20(_usdgToken);
        googlToken = IERC20(_googlToken);
        swapRouter = _swapRouter;
        treasuryEOA = _treasury;
        feeRecipient = _treasury;
    }

    // ─── Setup ───
    function setPlatformManager(address _a) external onlyOwner { require(platformManager == address(0)); platformManager = _a; }
    function updatePlatformManager(address _a) external onlyOwner { require(_a != address(0)); platformManager = _a; }
    function setGoogleStockNFT(address _a) external onlyOwner { require(googleStockNFT == address(0)); googleStockNFT = _a; }
    function updateGoogleStockNFT(address _a) external onlyOwner { require(_a != address(0)); googleStockNFT = _a; }
    function setOurToken(address _a) external onlyOwner { require(address(ourToken) == address(0)); ourToken = IERC20(_a); }
    function updateTreasury(address _a) external onlyOwner { require(_a != address(0)); treasuryEOA = _a; }
    function setFeeRecipient(address _a) external onlyOwner { require(_a != address(0)); feeRecipient = _a; }
    function setSwapPath(bytes calldata _path) external onlyOwner { usdgToGooglPath = _path; }

    /// @notice Set ERC-6551 registry + implementation (one-time). Called by PlatformManager.
    function setERC6551(address _registry, address _impl) external {
        require(msg.sender == platformManager || msg.sender == owner(), "Auth");
        require(erc6551Registry == address(0), "Already set");
        require(_registry != address(0) && _impl != address(0), "Zero addr");
        erc6551Registry = _registry;
        erc6551Implementation = _impl;
    }

    /// @notice Update only the TBA implementation address (for upgrades).
    function updateERC6551Implementation(address _impl) external {
        require(msg.sender == platformManager || msg.sender == owner(), "Auth");
        require(_impl != address(0), "Zero addr");
        erc6551Implementation = _impl;
    }

    // ─── Receive USDG from mints (called by GoogleStockNFT) ───
    function receiveMintFunds(uint256 amount) external {
        require(msg.sender == googleStockNFT, "Not NFT");
        emit MintFundsReceived(amount);
    }

    // ─── Fund Phase 1 (called by OurToken deployer) ───
    /// @notice OurToken pre-mints 500M to StockVault at construction. This records the amount for distribution.
    function fundPhase1(uint256 amount) external onlyOwner {
        require(address(ourToken) != address(0), "OurToken not set");
        totalOurTokenForRedemption += amount;
    }

    // ─── Phase 1: Claim $G-Pass (no burn, goes to TBA) ───
    function openPhase1() external onlyOwner { phase1Open = true; }

    function claimOurToken(uint256 tokenId) external nonReentrant {
        require(phase1Open, "Phase 1 not open");
        require(!ourTokenClaimed[tokenId], "Already claimed");
        require(_isNFTOwner(tokenId, msg.sender), "Not NFT owner");

        uint256 share = _getOurTokenShare(tokenId);
        require(share > 0, "No $G-Pass share");
        require(ourToken.balanceOf(address(this)) >= share, "Insufficient $G-Pass");

        // State update BEFORE external calls (Checks-Effects-Interactions)
        ourTokenClaimed[tokenId] = true;

        // Deploy TBA if needed, send $G-Pass to TBA (not msg.sender)
        address tba = _ensureTBA(tokenId);
        ourToken.safeTransfer(tba, share);

        // Auto-soulbound if both claimed
        _autoMarkSoulbound(tokenId);

        emit Phase1Claimed(tokenId, msg.sender, tba, share);
    }

    // ─── GOOGL Purchase ───
    function executeGooglePurchase(uint256 usdgAmount, uint256 minGooglOut)
        external returns (uint256 googlonReceived)
    {
        require(msg.sender == owner() || msg.sender == treasuryEOA || msg.sender == platformManager, "Not authorized");
        require(!purchaseComplete, "Already executed");
        require(usdgAmount > 0, "Zero");
        require(usdgToGooglPath.length > 0, "Swap path not set");
        require(usdgToken.balanceOf(address(this)) >= usdgAmount, "Insufficient USDG");

        purchaseComplete = true;

        IERC20(address(usdgToken)).approve(swapRouter, usdgAmount);
        IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router.ExactInputParams({
            path: usdgToGooglPath,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: usdgAmount,
            amountOutMinimum: minGooglOut
        });
        googlonReceived = IUniswapV3Router(swapRouter).exactInput(params);
        require(googlonReceived >= minGooglOut, "Slippage");

        totalGooglonHeld = googlonReceived;

        uint256 dust = usdgToken.balanceOf(address(this));
        if (dust > 0) usdgToken.safeTransfer(treasuryEOA, dust);

        emit PurchaseExecuted(usdgAmount, googlonReceived);
    }

    // ─── Phase 2: Claim GOOGL (no burn, goes to TBA, 5% fee → treasury) ───
    function openGOOGLClaims() external {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        require(purchaseComplete, "Purchase not done");
        googlClaimable = true;
    }

    function claimGOOGL(uint256 tokenId) external nonReentrant {
        require(purchaseComplete, "Purchase not complete");
        require(googlClaimable, "GOOGL claims not open");
        require(!googlClaimed[tokenId], "Already claimed");
        require(_isNFTOwner(tokenId, msg.sender), "Not NFT owner");

        uint256 shares = getShares(tokenId);
        require(shares > 0, "No GOOGL shares");

        // State update BEFORE external calls
        googlClaimed[tokenId] = true;

        address tba = _ensureTBA(tokenId);

        uint256 fee = (shares * REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        uint256 toUser = shares - fee;

        googlToken.safeTransfer(tba, toUser);
        googlToken.safeTransfer(feeRecipient, fee);

        _autoMarkSoulbound(tokenId);

        emit GOOGLClaimed(tokenId, msg.sender, tba, toUser, fee);
    }

    // ─── TBA Helpers ───

    /// @notice Get the deterministic TBA address for a token ID (works before deployment).
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

    /// @notice Deploy TBA for a token if not already deployed. Returns the TBA address.
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

    // Note: withdrawFromTBA removed. Users call TBA.execute() directly from their wallet.
    // The TBA's execute() only allows the NFT owner — which is the correct security model.
    // Frontend should provide a "Withdraw from TBA" button that calls:
    //   tba.execute(tokenAddress, 0, abi.encodeWithSignature("transfer(address,uint256)", userWallet, amount), 0)

    // ─── Share Calculation ───

    function getShares(uint256 tokenId) public view returns (uint256) {
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

    // ─── Internal ───

    function _isNFTOwner(uint256 tokenId, address user) internal view returns (bool) {
        require(googleStockNFT != address(0), "NFT not set");
        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        return ok && abi.decode(data, (address)) == user;
    }

    function _getOurTokenShare(uint256 tokenId) internal view returns (uint256) {
        if (totalOurTokenForRedemption == 0) return 0;
        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("mintPrincipal(uint256)", tokenId)
        );
        if (!ok) return 0;
        uint256 principal = abi.decode(data, (uint256));
        (bool ok2, bytes memory data2) = platformManager.staticcall(
            abi.encodeWithSignature("totalMintPrincipal()")
        );
        if (!ok2) return 0;
        uint256 totalPrincipal = abi.decode(data2, (uint256));
        if (totalPrincipal == 0) return 0;
        return (totalOurTokenForRedemption * principal) / totalPrincipal;
    }

    /// @notice If both claims done, mark the NFT as soulbound (non-transferable collectible).
    function _autoMarkSoulbound(uint256 tokenId) internal {
        if (ourTokenClaimed[tokenId] && googlClaimed[tokenId]) {
            // Best-effort: if this fails, NFT continues to be transferable
            (bool ok, ) = googleStockNFT.call(
                abi.encodeWithSignature("markSoulbound(uint256)", tokenId)
            );
            if (!ok) {} // silence unused warning
        }
    }
}
