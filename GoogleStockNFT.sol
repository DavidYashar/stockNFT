// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title GoogleStockNFT
 * @notice ERC-721 NFT representing fractional Google stock ownership.
 *         Each mint sends 10 USDC to TreasuryVault. 10% loyalty fee
 *         collected on every transfer. Interest clock resets on transfer.
 *         Max supply: 100.
 */
contract GoogleStockNFT is ERC721, ERC721Enumerable, Ownable, IERC2981 {
    // ==================== Errors ====================
    error MintNotActive();
    error MaxSupplyReached();
    error OnlyPlatformManager();
    error LoyaltyFeeFailed();

    // ==================== Constants ====================
    uint256 public constant MAX_SUPPLY = 100;
    uint256 public constant MIN_USDC_PAYMENT = 10_000_000; // 10 USDC (6 decimals)
    uint48 public interestWaitPeriod = 48 hours;
    uint96 public constant ROYALTY_BPS = 1_000; // 10% in basis points

    // ==================== State ====================
    IERC20 public immutable usdcToken;
    address public treasuryVault;
    address public platformManager;
    bool public mintActive = true;

    /// @notice Next token ID to mint. Skipped forward when burning unminted supply.
    uint256 private _nextMintId = 1;

    /// @notice USDC paid by the original minter for each token ID
    mapping(uint256 => uint256) public mintPrincipal;

    /// @notice GOOGL price (in USD, 8 decimals) at the time of minting
    mapping(uint256 => uint256) public googlPriceAtMint;

    /// @notice Unix timestamp when the NFT was minted
    mapping(uint256 => uint48) public mintTimestamp;

    /// @notice IRYS transaction ID for mutable metadata (set by backend)
    mapping(uint256 => string) public irysTxId;

    /// @notice Timestamp after which interest can begin accruing for the current holder
    mapping(uint256 => uint48) public interestStartTimestamp;

    // ==================== Events ====================
    event NFTMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 usdcAmount,
        uint256 googlPrice
    );

    event MintStopped();
    event UnmintedBurned(uint256 amount);
    event LoyaltyCollected(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    // ==================== Modifiers ====================
    modifier onlyPlatformManager() {
        if (msg.sender != platformManager) revert OnlyPlatformManager();
        _;
    }

    // ==================== Constructor ====================
    constructor(
        address _usdcToken,
        address _initialOwner
    ) ERC721("Google Stock NFT", "GOOGL") Ownable(_initialOwner) {
        require(_usdcToken != address(0), "USDC address cannot be zero");
        usdcToken = IERC20(_usdcToken);
    }

    // ==================== Admin Functions ====================

    function setTreasuryVault(address _treasuryVault) external onlyOwner {
        require(_treasuryVault != address(0), "Invalid treasury address");
        require(treasuryVault == address(0), "Treasury already set");
        treasuryVault = _treasuryVault;
    }

    function updateTreasuryVault(address _newTV) external onlyOwner {
        require(_newTV != address(0), "Invalid treasury address");
        treasuryVault = _newTV;
    }

    function setPlatformManager(address _pm) external onlyOwner {
        require(_pm != address(0), "Invalid PM");
        require(platformManager == address(0), "PM already set");
        platformManager = _pm;
    }

    function updatePlatformManager(address _newPM) external onlyOwner {
        require(_newPM != address(0), "Invalid PM");
        platformManager = _newPM;
    }

    function setInterestWaitPeriod(uint48 _period) external onlyOwner {
        require(_period > 0, "Cannot be zero");
        interestWaitPeriod = _period;
    }

    function resetInterestClock(uint256 tokenId) external {
        interestStartTimestamp[tokenId] = uint48(block.timestamp) + interestWaitPeriod;
    }

    function stopMint() external onlyPlatformManager {
        mintActive = false;
        emit MintStopped();
    }

    function resumeMint() external onlyPlatformManager {
        mintActive = true;
    }

    function burnUnminted(uint256 amount) external onlyPlatformManager {
        require(
            _nextMintId + amount - 1 <= MAX_SUPPLY,
            "Exceeds max supply"
        );
        _nextMintId += amount;
        emit UnmintedBurned(amount);
    }

    // ==================== Mint ====================

    function mint(
        uint256 googlPrice
    ) external returns (uint256 tokenId) {
        if (!mintActive) revert MintNotActive();
        if (_nextMintId > MAX_SUPPLY) revert MaxSupplyReached();

        require(treasuryVault != address(0), "Treasury not configured");

        tokenId = _nextMintId++;
        uint256 usdcAmount = MIN_USDC_PAYMENT;

        require(
            usdcToken.transferFrom(msg.sender, treasuryVault, usdcAmount),
            "USDC transfer failed"
        );

        (bool tvOk, ) = treasuryVault.call(
            abi.encodeWithSignature("receiveUSDC(uint256)", usdcAmount)
        );
        require(tvOk, "TreasuryVault.receiveUSDC failed");

        (bool pmOk, ) = platformManager.call(
            abi.encodeWithSignature("recordMint(uint256)", usdcAmount)
        );
        require(pmOk, "PlatformManager.recordMint failed");

        mintPrincipal[tokenId] = usdcAmount;
        googlPriceAtMint[tokenId] = googlPrice;
        mintTimestamp[tokenId] = uint48(block.timestamp);
        interestStartTimestamp[tokenId] = uint48(block.timestamp) + interestWaitPeriod;

        _safeMint(msg.sender, tokenId);

        emit NFTMinted(tokenId, msg.sender, usdcAmount, googlPrice);
    }

    // ==================== Transfer Hook (Loyalty Fee) ====================

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0) && platformManager != address(0)) {
            uint256 loyaltyFee = (mintPrincipal[tokenId] * ROYALTY_BPS) / 10_000;
            if (loyaltyFee > 0) {
                require(
                    usdcToken.transferFrom(from, platformManager, loyaltyFee),
                    "Loyalty fee failed"
                );
                (bool pmOk, ) = platformManager.call(
                    abi.encodeWithSignature("receiveLoyalty(uint256)", loyaltyFee)
                );
                if (pmOk) {
                    emit LoyaltyCollected(tokenId, from, to, loyaltyFee);
                }
            }
            // Reset interest clock on transfer — new holder gets fresh cooldown
            interestStartTimestamp[tokenId] = uint48(block.timestamp) + interestWaitPeriod;
        }

        return super._update(to, tokenId, auth);
    }

    // ==================== IRYS Metadata ====================

    function setIrysTxId(uint256 tokenId, string calldata txId) external {
        require(owner() == msg.sender || platformManager == msg.sender, "Not authorized");
        if (owner() != msg.sender) {
            require(bytes(irysTxId[tokenId]).length == 0, "IRYS txId already set");
        }
        irysTxId[tokenId] = txId;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId);

        if (bytes(irysTxId[tokenId]).length > 0) {
            return
                string(
                    abi.encodePacked(
                        "https://gateway.irys.xyz/mutable/",
                        irysTxId[tokenId]
                    )
                );
        }

        return "";
    }

    // ==================== EIP-2981 Royalty ====================

    function royaltyInfo(
        uint256,
        uint256 salePrice
    ) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = owner();
        royaltyAmount = (salePrice * ROYALTY_BPS) / 10_000;
    }

    // ==================== Required Overrides ====================

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}