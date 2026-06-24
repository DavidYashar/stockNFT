// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IGoogleStockNFT {
    function stopMint() external;
    function resumeMint() external;
    function burnUnminted(uint256 amount) external;
    function mintActive() external view returns (bool);
}

/**
 * @title PlatformManager
 * @notice Central admin + accounting contract. All ETH is held by a Treasury EOA.
 *         This contract tracks: pool80/20 split, DeFi position, loyalty fees,
 *         trigger conditions, mint lifecycle, and fee parameters.
 */
contract PlatformManager is Ownable, Pausable {
    error MintNotEnded();
    error InsufficientLoyalty(uint256 required, uint256 available);
    error TriggerAlreadyFired();
    error SweepTooEarly(uint256 nextAvailable);

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant GAP_PERCENT = 2_000;
    uint256 public constant POOL80_BPS = 8_000;
    uint256 public constant POOL20_BPS = 2_000;

    // === Mint & Loyalty ===
    uint256 public totalMintPrincipal;
    uint256 public totalLoyaltyFees;
    bool public triggerFired;
    bool public mintEnded;
    uint256 public totalBurned;

    // === Treasury Accounting ===
    uint256 public pool80;
    uint256 public pool20;
    uint256 public totalDeFiPrincipal;
    uint48 public lastSweepTimestamp;
    uint48 public lastHarvestTimestamp;
    uint256 public sweepInterval = 4 hours;

    // === External Addresses ===
    address public googleStockNFT;
    address public stockVault;
    address public sweepOperator; // Treasury vault for DeFi operations

    // === Configurable ===
    uint96 public royaltyBps = 1_000;
    uint96 public redemptionFeeBps = 500;
    uint96 public interestRateBps = 390;

    // === Events ===
    event MintRecorded(uint256 amount, uint256 toPool80, uint256 toPool20);
    event LoyaltyReceived(uint256 amount, uint256 total);
    event SweepRecorded(uint256 amount, uint256 timestamp);
    event HarvestRecorded(uint256 yield, uint256 timestamp);
    event TriggerExecuted(uint256 totalETH, uint256 googlon, uint256 timestamp);
    event MintEnded(uint256 burned, uint256 principal);
    event FeesUpdated(uint96 royalty, uint96 redemption, uint96 interest);

    constructor(address _initialOwner) Ownable(_initialOwner) {}

    // === Setup ===
    function setGoogleStockNFT(address _a) external onlyOwner {
        require(googleStockNFT == address(0), "Already set"); googleStockNFT = _a;
    }
    function updateGoogleStockNFT(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); googleStockNFT = _a;
    }
    function setStockVault(address _a) external onlyOwner {
        require(stockVault == address(0), "Already set"); stockVault = _a;
    }
    function updateStockVault(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); stockVault = _a;
    }
    function setSweepInterval(uint256 _i) external onlyOwner {
        require(_i > 0, "Zero"); sweepInterval = _i;
    }
    function setSweepOperator(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); sweepOperator = _a;
    }

    modifier onlySweepOrOwner() {
        require(msg.sender == owner() || msg.sender == sweepOperator, "Not authorized");
        _;
    }

    // === Mint (called by NFT) ===
    function recordMint(uint256 amount) external {
        require(msg.sender == googleStockNFT, "Not NFT");
        uint256 to80 = (amount * POOL80_BPS) / BPS_DENOMINATOR;
        uint256 to20 = amount - to80;
        pool80 += to80; pool20 += to20;
        totalMintPrincipal += amount;
        emit MintRecorded(amount, to80, to20);
    }

    // === Loyalty (called by NFT, owner, sweepOperator, or marketplace) ===
    function receiveLoyalty(uint256 amount) external {
        require(msg.sender == googleStockNFT || msg.sender == owner() || msg.sender == sweepOperator, "Auth");
        totalLoyaltyFees += amount;
        emit LoyaltyReceived(amount, totalLoyaltyFees);
    }

    // === DeFi Sweep (called by sweepOperator or owner) ===
    function recordSweep(uint256 amount) external onlySweepOrOwner {
        uint256 next = uint256(lastSweepTimestamp) + sweepInterval;
        if (block.timestamp < next) revert SweepTooEarly(next);
        require(amount > 0 && amount <= pool20, "Bad amount");
        pool20 -= amount;
        totalDeFiPrincipal += amount;
        lastSweepTimestamp = uint48(block.timestamp);
        if (lastHarvestTimestamp == 0) lastHarvestTimestamp = uint48(block.timestamp);
        emit SweepRecorded(amount, block.timestamp);
    }

    // === DeFi Harvest (called by sweepOperator or owner) ===
    function recordHarvest(uint256 yieldAmount) external onlySweepOrOwner {
        require(yieldAmount > 0, "Zero");
        lastHarvestTimestamp = uint48(block.timestamp);
        emit HarvestRecorded(yieldAmount, block.timestamp);
    }

    // === Mint Lifecycle ===
    function pauseMint() external onlyOwner {
        IGoogleStockNFT(googleStockNFT).stopMint();
    }
    function resumeMint() external onlyOwner {
        IGoogleStockNFT(googleStockNFT).resumeMint();
    }
    function setTotalBurned(uint256 v) external onlyOwner {
        require(totalBurned == 0, "Set"); totalBurned = v;
    }
    function setTotalMintPrincipal(uint256 v) external onlyOwner {
        require(v > totalMintPrincipal, "Low"); totalMintPrincipal = v;
    }
    function pauseAndBurn(uint256 n) external onlyOwner {
        require(!mintEnded, "Ended");
        IGoogleStockNFT(googleStockNFT).stopMint();
        IGoogleStockNFT(googleStockNFT).burnUnminted(n);
        totalBurned += n;
        emit MintEnded(n, totalMintPrincipal);
    }
    function stopMintAndBurn(uint256 n) external onlyOwner {
        require(!mintEnded, "Ended");
        mintEnded = true;
        IGoogleStockNFT(googleStockNFT).stopMint();
        IGoogleStockNFT(googleStockNFT).burnUnminted(n);
        totalBurned += n;
        emit MintEnded(n, totalMintPrincipal);
    }
    function markMintEnded() external onlyOwner {
        require(!mintEnded, "Ended"); mintEnded = true;
        emit MintEnded(0, totalMintPrincipal);
    }

    // === Trigger ===
    function gap20() public view returns (uint256) {
        return (totalMintPrincipal * GAP_PERCENT) / BPS_DENOMINATOR;
    }
    function canTrigger() public view returns (bool) {
        return mintEnded && !triggerFired && totalLoyaltyFees >= gap20();
    }

    function triggerGooglePurchase(uint256 minGooglonOut) external onlySweepOrOwner whenNotPaused {
        if (!mintEnded) revert MintNotEnded();
        if (triggerFired) revert TriggerAlreadyFired();
        uint256 gap = gap20();
        if (totalLoyaltyFees < gap) revert InsufficientLoyalty(gap, totalLoyaltyFees);
        triggerFired = true;
        require(stockVault != address(0), "No SV");
        (bool ok, bytes memory data) = stockVault.call(
            abi.encodeWithSignature("executeGooglePurchase(uint256,uint256)", totalMintPrincipal, minGooglonOut)
        );
        require(ok, "Swap failed");
        emit TriggerExecuted(totalMintPrincipal, abi.decode(data, (uint256)), block.timestamp);
    }

    // === Admin ===
    function updateFees(uint96 _r, uint96 _red, uint96 _int) external onlyOwner {
        require(_r <= 5_000 && _red <= 2_000, "High");
        royaltyBps = _r; redemptionFeeBps = _red; interestRateBps = _int;
        emit FeesUpdated(_r, _red, _int);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
