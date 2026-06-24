// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InterestDistributor
 * @notice Receives DeFi yield from MockAavePool (via Treasury Vault) and
 *         distributes it equally among all NFT holders after minting ends.
 *
 *         Flow: Treasury Vault harvests Aave yield → calls fundEqualDistribution()
 *         → ETH split equally per NFT → holders call claimInterest() after mint ends.
 */
contract InterestDistributor is Ownable {
    error ClaimsNotAllowed();
    error NotNFTHolder();
    error NothingToClaim();
    error OnlyTreasuryVault();
    error InsufficientPool();

    // === State ===
    address public googleStockNFT;
    address public treasuryVault;
    address public platformManager;

    /// @notice Total ETH in the distribution pool
    uint256 public interestPool;

    /// @notice Equal ETH share each NFT holder can claim (per distribution round)
    /// @dev DEPRECATED — kept for backward compatibility, use distributionPerTokenForRound
    uint256 public distributionPerToken;

    /// @notice Per-round distribution amount per token (round => perToken)
    mapping(uint256 => uint256) public distributionPerTokenForRound;

    /// @notice Whether claims are allowed (set after mint ends)
    bool public claimsAllowed;

    /// @notice Tracks which distribution round each token last claimed
    mapping(uint256 => uint256) public lastClaimedRound;

    /// @notice Total distribution rounds (incremented each fundEqualDistribution)
    uint256 public distributionRound;

    // === Events ===
    event DistributionFunded(uint256 amount, uint256 perToken, uint256 round);
    event ClaimsAllowed();
    event InterestClaimed(uint256 indexed tokenId, address indexed holder, uint256 amount);

    modifier onlyTreasuryVault() {
        require(msg.sender == treasuryVault, "Not TreasuryVault");
        _;
    }

    constructor(address _initialOwner) Ownable(_initialOwner) {}

    // === Setup ===
    function setGoogleStockNFT(address _a) external onlyOwner {
        require(googleStockNFT == address(0), "Already set"); googleStockNFT = _a;
    }
    function updateGoogleStockNFT(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); googleStockNFT = _a;
    }
    function setTreasuryVault(address _a) external onlyOwner {
        require(treasuryVault == address(0), "Already set"); treasuryVault = _a;
    }
    function updateTreasuryVault(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); treasuryVault = _a;
    }
    function setPlatformManager(address _a) external onlyOwner {
        require(platformManager == address(0), "Already set"); platformManager = _a;
    }
    function updatePlatformManager(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); platformManager = _a;
    }

    // === Admin: Allow claims (call after mint ends) ===
    function allowClaims() external onlyOwner {
        require(!claimsAllowed, "Already allowed");
        claimsAllowed = true;
        emit ClaimsAllowed();
    }

    // === Fund: Equal distribution from harvested Aave yield ===
    function fundEqualDistribution() external payable onlyTreasuryVault {
        require(msg.value > 0, "Zero amount");
        require(googleStockNFT != address(0), "NFT not set");

        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("totalSupply()")
        );
        require(ok, "NFT read failed");
        uint256 totalSupply = abi.decode(data, (uint256));
        require(totalSupply > 0, "No NFTs minted");

        distributionRound++;
        uint256 perToken = msg.value / totalSupply;
        distributionPerToken = perToken; // backward compatibility
        distributionPerTokenForRound[distributionRound] = perToken;
        interestPool += msg.value;

        emit DistributionFunded(msg.value, perToken, distributionRound);
    }

    // === Claim: Accumulated share across all unclaimed rounds ===
    function claimInterest(uint256 tokenId) external {
        require(claimsAllowed, "Claims not yet allowed - mint must end first");
        require(googleStockNFT != address(0), "NFT not set");

        // Verify caller is current NFT holder
        (bool ok, bytes memory data) = googleStockNFT.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(ok && abi.decode(data, (address)) == msg.sender, "Not NFT holder");

        // Check if already claimed all rounds
        uint256 lastClaimed = lastClaimedRound[tokenId];
        require(lastClaimed < distributionRound, "Already claimed all rounds");

        // Accumulate across all unclaimed rounds
        uint256 totalAmount = 0;
        for (uint256 r = lastClaimed + 1; r <= distributionRound; r++) {
            totalAmount += distributionPerTokenForRound[r];
        }
        require(totalAmount > 0, "Nothing to claim");
        require(totalAmount <= interestPool, "Insufficient pool");

        lastClaimedRound[tokenId] = distributionRound;
        interestPool -= totalAmount;

        (bool sent, ) = msg.sender.call{value: totalAmount}("");
        require(sent, "ETH send failed");

        emit InterestClaimed(tokenId, msg.sender, totalAmount);
    }

    // === View: Accumulated pending interest across all unclaimed rounds ===
    function getPendingInterest(uint256 tokenId) external view returns (uint256 total) {
        if (!claimsAllowed) return 0;
        uint256 lastClaimed = lastClaimedRound[tokenId];
        if (lastClaimed >= distributionRound) return 0;
        for (uint256 r = lastClaimed + 1; r <= distributionRound; r++) {
            total += distributionPerTokenForRound[r];
        }
    }

    // === Admin: Withdraw excess (dust from division remainder, not claimable funds) ===
    function withdrawExcess(uint256 amount) external onlyOwner {
        uint256 excess = address(this).balance - interestPool;
        require(amount <= excess, "Exceeds excess above interestPool");
        (bool sent, ) = owner().call{value: amount}("");
        require(sent, "ETH send failed");
    }

    receive() external payable {}
}
