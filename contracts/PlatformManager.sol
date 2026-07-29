// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IGoogleStockNFT_V2 {
    function stopMint() external;
    function resumeMint() external;
    function burnUnminted(uint256 amount) external;
    function mintActive() external view returns (bool);
}

/**
 * @title PlatformManager V2
 * @notice Central admin + accounting for StockNFT V2 on Robinhood Chain.
 *
 *         Payments in USDG. Tracks: phase state, 80/20 pools, loyalty fees.
 *         DeFi (Aave, sweep, harvest) REMOVED from V2.
 *         GooglonSwapAdapter REMOVED — StockVault swaps directly.
 *
 *         Access control:
 *           - Deployer (owner): set addresses, manage phases, pause, fees
 *           - Treasury EOA: trigger Google purchase, receive loyalty
 *           - GoogleStockNFT: record mint
 */
contract PlatformManager is Ownable, Pausable {
    error MintNotEnded();
    error TriggerAlreadyFired();
    error NotAuthorized();

    uint256 public constant BPS_DENOMINATOR = 10_000;

    // Phase
    enum Phase { NONE, WHITELIST, PUBLIC, ENDED }
    Phase public mintPhase = Phase.NONE;

    // Mint & loyalty
    uint256 public totalMintPrincipal;
    uint256 public totalLoyaltyFees;
    bool public mintEnded;
    uint256 public totalBurned;

    // External addresses
    address public googleStockNFT;
    address public treasuryVault;
    address public treasuryEOA;

    // ERC-6551
    address public erc6551Registry;
    address public erc6551Implementation;

    // Config
    uint96 public royaltyBps = 1_000;
    uint96 public redemptionFeeBps = 500;

    // Events
    event MintRecorded(uint256 amount);
    event LoyaltyReceived(uint256 amount, uint256 total);
    event PhaseChanged(Phase oldPhase, Phase newPhase);
    event MintEnded(uint256 burned, uint256 principal);
    event FeesUpdated(uint96 royalty, uint96 redemption);

    constructor(address _owner, address _treasury) Ownable(_owner) {
        treasuryEOA = _treasury;
    }

    // ─── Setup ───
    function setGoogleStockNFT(address _a) external onlyOwner {
        require(googleStockNFT == address(0), "Already set");
        require(_a != address(0), "Zero");
        googleStockNFT = _a;
    }
    function updateGoogleStockNFT(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); googleStockNFT = _a;
    }
    function setTreasuryVault(address _a) external onlyOwner {
        require(treasuryVault == address(0), "Already set");
        require(_a != address(0), "Zero");
        treasuryVault = _a;
    }
    function updateTreasuryVault(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); treasuryVault = _a;
    }
    function updateTreasury(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); treasuryEOA = _a;
    }

    /// @notice Set ERC-6551 registry + implementation (one-time). Also propagates to NFT.
    function setERC6551(address _registry, address _impl) external onlyOwner {
        require(erc6551Registry == address(0), "Already set");
        require(_registry != address(0) && _impl != address(0), "Zero");
        erc6551Registry = _registry;
        erc6551Implementation = _impl;
        // Propagate to GoogleStockNFT
        (bool ok, ) = googleStockNFT.call(
            abi.encodeWithSignature("setERC6551(address,address)", _registry, _impl)
        );
        require(ok, "NFT setERC6551 failed");
    }

    /// @notice Update only the TBA implementation address (for upgrades).
    function updateERC6551Implementation(address _impl) external onlyOwner {
        require(_impl != address(0), "Zero");
        erc6551Implementation = _impl;
        (bool ok, ) = googleStockNFT.call(
            abi.encodeWithSignature("updateERC6551Implementation(address)", _impl)
        );
        require(ok, "NFT update failed");
    }

    // ─── Phase ───
    function openWhitelist() external onlyTreasuryOrOwner whenNotPaused {
        require(mintPhase == Phase.NONE);
        mintPhase = Phase.WHITELIST;
        // Notify NFT contract to start WL timer
        (bool ok, ) = googleStockNFT.call(
            abi.encodeWithSignature("notifyWhitelistStart()")
        );
        require(ok, "NFT notify failed");
        emit PhaseChanged(Phase.NONE, Phase.WHITELIST);
    }
    function openPublic() external onlyTreasuryOrOwner whenNotPaused {
        require(mintPhase == Phase.WHITELIST);
        mintPhase = Phase.PUBLIC;
        emit PhaseChanged(Phase.WHITELIST, Phase.PUBLIC);
    }
    function endMint() external onlyTreasuryOrOwner whenNotPaused {
        require(!mintEnded);
        mintEnded = true;
        Phase prev = mintPhase;
        mintPhase = Phase.ENDED;
        IGoogleStockNFT_V2(googleStockNFT).stopMint();
        emit PhaseChanged(prev, Phase.ENDED);
        emit MintEnded(0, totalMintPrincipal);
    }

    modifier onlyTreasuryOrOwner() {
        require(msg.sender == owner() || msg.sender == treasuryEOA, "Not authorized");
        _;
    }

    // ─── Mint Record (called by NFT only) ───
    /// @notice V3: TreasuryVault handles 80/20 split internally. PM only tracks total.
    function recordMint(uint256 amount) external whenNotPaused {
        require(msg.sender == googleStockNFT, "Not NFT");
        totalMintPrincipal += amount;
        emit MintRecorded(amount);
    }

    // ─── Loyalty ───
    function receiveLoyalty(uint256 amount) external whenNotPaused {
        require(msg.sender == googleStockNFT || msg.sender == owner() || msg.sender == treasuryEOA, "Auth");
        totalLoyaltyFees += amount;
        emit LoyaltyReceived(amount, totalLoyaltyFees);
    }

    // ─── Lifecycle ───
    function pauseMint() external onlyOwner { IGoogleStockNFT_V2(googleStockNFT).stopMint(); }
    function resumeMint() external onlyOwner { IGoogleStockNFT_V2(googleStockNFT).resumeMint(); }
    function setTotalBurned(uint256 v) external onlyOwner { require(totalBurned == 0); totalBurned = v; }
    function setTotalMintPrincipal(uint256 v) external onlyOwner { require(v > totalMintPrincipal); totalMintPrincipal = v; }
    function stopMintAndBurn(uint256 n) external onlyOwner whenNotPaused {
        require(!mintEnded);
        mintEnded = true;
        Phase prev = mintPhase;
        mintPhase = Phase.ENDED;
        IGoogleStockNFT_V2(googleStockNFT).stopMint();
        IGoogleStockNFT_V2(googleStockNFT).burnUnminted(n);
        totalBurned += n;
        emit PhaseChanged(prev, Phase.ENDED);
        emit MintEnded(n, totalMintPrincipal);
    }

    // ─── Admin ───
    function updateFees(uint96 _r, uint96 _red) external onlyOwner {
        require(_r <= 5_000 && _red <= 2_000, "High");
        royaltyBps = _r; redemptionFeeBps = _red;
        emit FeesUpdated(_r, _red);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
