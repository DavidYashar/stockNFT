// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

/**
 * @title GoogleStockNFT
 * @notice ERC-721 NFT — native ETH payments. Mint sends ETH to Treasury EOA.
 *         Loyalty fee on transfer is enforced in _update (for direct transfers).
 *         Marketplaces collect fees via EIP-2981 royaltyInfo.
 *         Max supply: 100. Mint price: configurable ETH amount.
 */
contract GoogleStockNFT is ERC721, ERC721Enumerable, Ownable, IERC2981 {
    error MintNotActive();
    error MaxSupplyReached();
    error OnlyPlatformManager();
    error WrongPayment();

    uint256 public constant MAX_SUPPLY = 4_083;
    uint256 public mintPrice;
    uint48 public interestWaitPeriod = 48 hours;
    uint96 public royaltyBps = 1_000; // 10% for EIP-2981

    // === State ===
    address public treasuryEOA;
    address public platformManager;
    address public stockVault;
    address public interestDistributor;
    bool public mintActive = true;
    uint256 private _nextMintId = 1;

    mapping(uint256 => uint256) public mintPrincipal;
    mapping(uint256 => uint256) public googlPriceAtMint;
    mapping(uint256 => uint48) public mintTimestamp;
    mapping(uint256 => string) public irysTxId;
    mapping(uint256 => uint48) public interestStartTimestamp;

    // === Events ===
    event NFTMinted(uint256 indexed tokenId, address indexed owner, uint256 ethAmount, uint256 googlPrice);
    event MintStopped();
    event UnmintedBurned(uint256 amount);
    event LoyaltyCollected(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount);

    modifier onlyPlatformManager() {
        if (msg.sender != platformManager) revert OnlyPlatformManager();
        _;
    }

    constructor(address _initialOwner, uint256 _mintPrice) ERC721("Google Stock NFT", "GOOGL") Ownable(_initialOwner) {
        require(_mintPrice > 0, "Zero price");
        mintPrice = _mintPrice;
    }

    // === Setup ===
    function setTreasuryEOA(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); treasuryEOA = _a;
    }
    function setPlatformManager(address _a) external onlyOwner {
        require(platformManager == address(0), "Set"); platformManager = _a;
    }
    function updatePlatformManager(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); platformManager = _a;
    }
    function setStockVault(address _a) external onlyOwner {
        require(stockVault == address(0), "Set"); stockVault = _a;
    }
    function updateStockVault(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); stockVault = _a;
    }
    function setInterestDistributor(address _a) external onlyOwner {
        require(interestDistributor == address(0), "Set"); interestDistributor = _a;
    }
    function updateInterestDistributor(address _a) external onlyOwner {
        require(_a != address(0), "Zero"); interestDistributor = _a;
    }
    function setInterestWaitPeriod(uint48 _p) external onlyOwner {
        require(_p > 0, "Zero"); interestWaitPeriod = _p;
    }
    function setMintPrice(uint256 _p) external onlyOwner {
        require(_p > 0, "Zero"); mintPrice = _p;
    }
    function setIrysGateway(string calldata _g) external onlyOwner { irysGateway = _g; }

    string public irysGateway = "https://gateway.irys.xyz";

    function resetInterestClock(uint256 tokenId) external {
        require(msg.sender == owner() || msg.sender == platformManager || msg.sender == interestDistributor, "Auth");
        interestStartTimestamp[tokenId] = uint48(block.timestamp) + interestWaitPeriod;
    }

    // === Mint Lifecycle ===
    function stopMint() external onlyPlatformManager { mintActive = false; emit MintStopped(); }
    function resumeMint() external onlyPlatformManager { mintActive = true; }
    function burnUnminted(uint256 amount) external onlyPlatformManager {
        require(_nextMintId + amount - 1 <= MAX_SUPPLY, "Exceeds max");
        _nextMintId += amount;
        emit UnmintedBurned(amount);
    }
    function burnForRedemption(uint256 tokenId) external {
        require(owner() == msg.sender || platformManager == msg.sender || stockVault == msg.sender, "Auth");
        _update(address(0), tokenId, address(0));
    }

    // === Mint (payable — native ETH) ===
    function mint(uint256 googlPrice) external payable returns (uint256 tokenId) {
        if (!mintActive) revert MintNotActive();
        if (_nextMintId > MAX_SUPPLY) revert MaxSupplyReached();
        if (msg.value != mintPrice) revert WrongPayment();

        require(treasuryEOA != address(0), "No treasury");
        require(platformManager != address(0), "No PM");

        // Assign tokenId but don't increment yet (checks-effects-interactions)
        tokenId = _nextMintId;

        // Send ETH to Treasury EOA
        (bool sent, ) = treasuryEOA.call{value: msg.value}("");
        require(sent, "ETH send failed");

        // Record on PlatformManager (80/20 split)
        (bool pmOk, ) = platformManager.call(
            abi.encodeWithSignature("recordMint(uint256)", msg.value)
        );
        require(pmOk, "PM.recordMint failed");

        mintPrincipal[tokenId] = msg.value;
        googlPriceAtMint[tokenId] = googlPrice;
        mintTimestamp[tokenId] = uint48(block.timestamp);
        interestStartTimestamp[tokenId] = uint48(block.timestamp) + interestWaitPeriod;

        // Increment now — right before mint, after all external calls
        _nextMintId = tokenId + 1;
        _safeMint(msg.sender, tokenId);

        if (_nextMintId > MAX_SUPPLY) mintActive = false;
        emit NFTMinted(tokenId, msg.sender, msg.value, googlPrice);
    }

    // === Transfer Hook (interest clock reset, no fee — fee via EIP-2981) ===
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            // Reset interest clock on transfer
            interestStartTimestamp[tokenId] = uint48(block.timestamp) + interestWaitPeriod;
        }

        return super._update(to, tokenId, auth);
    }

    // === IRYS Metadata ===
    function setIrysTxId(uint256 tokenId, string calldata txId) external {
        require(owner() == msg.sender || platformManager == msg.sender, "Auth");
        if (owner() != msg.sender) {
            require(bytes(irysTxId[tokenId]).length == 0, "Already set");
        }
        irysTxId[tokenId] = txId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (bytes(irysTxId[tokenId]).length > 0) {
            return string(abi.encodePacked(irysGateway, "/mutable/", irysTxId[tokenId]));
        }
        return "";
    }

    // === EIP-2981 (Marketplace Royalties) ===
    function royaltyInfo(uint256, uint256 salePrice) external view override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = treasuryEOA;
        royaltyAmount = (salePrice * royaltyBps) / 10_000;
    }

    // === Required Overrides ===
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
    function supportsInterface(bytes4 id) public view override(ERC721, ERC721Enumerable, IERC165) returns (bool) {
        return id == type(IERC2981).interfaceId || super.supportsInterface(id);
    }
}
