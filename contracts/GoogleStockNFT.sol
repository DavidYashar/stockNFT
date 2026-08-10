// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./interfaces/IERC6551Registry.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title GoogleStockNFT V3
 * @notice ERC-721 NFT — USDG payments, three-phase mint (GTD / FCFS / Public).
 *
 *         GTD (Phase 1):  Merkle proof required, 4 USDG, 2h window
 *         FCFS (Phase 2): Merkle proof required, 4 USDG, 2h window, 1500 WL cap shared
 *         Public (Phase 3): Open to all, 6 USDG
 *         Total: 4,083 NFTs.
 *
 *         GOOGL price at mint is read from the Chainlink oracle on-chain.
 *         100% USDG → TreasuryVault. TBA deployed at mint (ERC-6551).
 */
contract GoogleStockNFT is ERC721, ERC721Enumerable, Ownable, IERC2981 {
    using SafeERC20 for IERC20;

    error MintNotActive();
    error MaxSupplyReached();
    error WrongPayment();
    error WrongPhase();

    uint256 public constant MAX_SUPPLY = 4_083;
    uint256 public constant WL_PRICE = 4_000_000;    // 4 USDG (6 decimals)
    uint256 public constant PUBLIC_PRICE = 6_000_000; // 6 USDG (6 decimals)
    uint256 public constant WL_CAP = 1_500;           // Max 1,500 NFTs across GTD + FCFS
    uint256 public constant STOCK_BPS = 8_000;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint96 public royaltyBps = 1_000;

    // ─── Immutable ───
    IERC20 public immutable usdgToken;
    AggregatorV3Interface public immutable googlPriceFeed;  // Chainlink oracle for GOOGL price at mint

    // ─── Admin addresses ───
    address public treasuryEOA;
    address public treasuryVault;     // V3: receives 100% of mint USDG
    address public platformManager;

    // ─── ERC-6551 ───
    address public erc6551Registry;
    address public erc6551Implementation;

    // ─── V3 Merkle roots (GTD + FCFS) ───
    bytes32 public gtdRoot;
    bytes32 public fcfsRoot;

    // ─── Mint state ───
    bool public mintActive = false; // starts paused — PlatformManager enables via notifyPhaseStart()
    uint256 private _nextMintId = 1;

    // ─── WL tracking ──
    uint256 public gtdMintCount;
    uint256 public fcfsMintCount;
    mapping(address => bool) public wlMinted;  // any WL address that minted (GTD or FCFS)

    // ─── Per-token metadata ───
    mapping(uint256 => uint256) public mintPrincipal;   // USDG paid
    mapping(uint256 => uint256) public googlPriceAtMint; // GOOGL oracle price at mint
    mapping(uint256 => uint48) public mintTimestamp;
    mapping(uint256 => bool) public soulbound;           // true when fully redeemed
    mapping(uint256 => address) public tbaForToken;      // TBA smart account address (set at mint)
    mapping(uint256 => address) public minterOf;          // Original minter address

    // ─── Contract URI ───
    string public contractURI;

    // ─── Events ───
    event NFTMinted(uint256 indexed tokenId, address indexed owner, uint256 usdgAmount, uint256 googlPrice);
    event MintStopped();
    event UnmintedBurned(uint256 amount);

    constructor(address _owner, address _usdgToken, address _googlPriceFeed, address _treasury, address _treasuryVault)
        ERC721("Google Stock NFT", "GSNFT")
        Ownable(_owner)
    {
        require(_usdgToken != address(0) && _treasury != address(0), "Zero addr");
        require(_googlPriceFeed != address(0), "Zero oracle");
        require(_treasuryVault != address(0), "Zero TV");
        usdgToken = IERC20(_usdgToken);
        googlPriceFeed = AggregatorV3Interface(_googlPriceFeed);
        treasuryEOA = _treasury;
        treasuryVault = _treasuryVault;
    }

    // ─── Setup (one-time) ───
    function setPlatformManager(address _a) external onlyOwner { require(platformManager == address(0)); platformManager = _a; }
    function updatePlatformManager(address _a) external onlyOwner { require(_a != address(0)); platformManager = _a; }
    function setTreasuryVault(address _a) external onlyOwner { require(treasuryVault == address(0)); treasuryVault = _a; }
    function updateTreasuryVault(address _a) external onlyOwner { require(_a != address(0)); treasuryVault = _a; }
    function setGtdRoot(bytes32 _r) external onlyOwner { gtdRoot = _r; }
    function setFcfsRoot(bytes32 _r) external onlyOwner { fcfsRoot = _r; }
    function updateTreasury(address _a) external onlyOwner { require(_a != address(0)); treasuryEOA = _a; }
    function setContractURI(string calldata _u) external onlyOwner { contractURI = _u; }
    function setRoyaltyBps(uint96 _b) external onlyOwner { require(_b <= 5_000); royaltyBps = _b; }

    /// @notice Set ERC-6551 registry + implementation (one-time). Called by owner or PlatformManager.
    function setERC6551(address _registry, address _impl) external {
        require(msg.sender == owner() || msg.sender == platformManager, "Auth");
        require(erc6551Registry == address(0), "Already set");
        require(_registry != address(0) && _impl != address(0), "Zero");
        erc6551Registry = _registry;
        erc6551Implementation = _impl;
    }

    /// @notice Update only the TBA implementation address (for upgrades).
    function updateERC6551Implementation(address _impl) external {
        require(msg.sender == platformManager || msg.sender == owner(), "Auth");
        require(_impl != address(0), "Zero");
        erc6551Implementation = _impl;
    }

    /// @notice Called by PlatformManager when GTD phase opens. Enables minting.
    function notifyPhaseStart() external {
        require(msg.sender == platformManager, "Not PM");
        mintActive = true;
    }

    // ─── Mint Lifecycle ───
    function stopMint() external {
        require(msg.sender == platformManager || msg.sender == owner(), "Auth");
        mintActive = false;
        emit MintStopped();
    }
    function resumeMint() external {
        require(msg.sender == platformManager || msg.sender == owner(), "Auth");
        mintActive = true;
    }
    function burnUnminted(uint256 amount) external {
        require(msg.sender == platformManager || msg.sender == owner(), "Auth");
        require(_nextMintId + amount - 1 <= MAX_SUPPLY, "Exceeds max");
        _nextMintId += amount;
        emit UnmintedBurned(amount);
    }

    // ─── Soulbound (ERC-6551) ───
    /// @notice Called by TreasuryVault when both PILE and GOOGL have been claimed.
    ///         Makes the NFT non-transferable — a permanent collectible.
    function markSoulbound(uint256 tokenId) external {
        require(msg.sender == treasuryVault, "Not TreasuryVault");
        soulbound[tokenId] = true;
    }

    /// @notice Whether this NFT has been fully redeemed and is now a soulbound collectible.
    function isFullyRedeemed(uint256 tokenId) external view returns (bool) {
        return soulbound[tokenId];
    }

    // ─── Mint ───
    /// @notice Mint an NFT. Phase-aware: GTD (Merkle), FCFS (Merkle), Public (open).
    ///         GOOGL price is read from Chainlink oracle on-chain, with user-provided fallback.
    /// @param googlPrice User-supplied GOOGL price from frontend (used if oracle is stale)
    /// @param proof Merkle proof (empty for public phase)
    function mint(uint256 googlPrice, bytes32[] calldata proof) external returns (uint256 tokenId) {
        if (!mintActive) revert MintNotActive();
        if (_nextMintId > MAX_SUPPLY) revert MaxSupplyReached();
        require(platformManager != address(0) && treasuryVault != address(0), "Not set up");

        // Read phase + deadline from PlatformManager
        (bool phaseOk, bytes memory phaseData) = platformManager.staticcall(
            abi.encodeWithSignature("mintPhase()")
        );
        require(phaseOk, "PM read failed");
        uint8 phase = abi.decode(phaseData, (uint8));

        // Enforce phase deadline for GTD + FCFS (2h window)
        if (phase == 1 || phase == 2) {
            (bool dlOk, bytes memory dlData) = platformManager.staticcall(
                abi.encodeWithSignature("phaseDeadline()")
            );
            require(dlOk && abi.decode(dlData, (uint256)) > block.timestamp, "Phase deadline passed");
        }

        uint256 price;
        if (phase == 1) {
            // ── GTD phase ──
            require(gtdRoot != bytes32(0), "GTD root not set");
            require(!wlMinted[msg.sender], "Already minted WL");
            _verifyMerkle(gtdRoot, proof);

            price = WL_PRICE;
            wlMinted[msg.sender] = true;
            gtdMintCount++;
        } else if (phase == 2) {
            // ── FCFS phase ──
            require(fcfsRoot != bytes32(0), "FCFS root not set");
            require(gtdMintCount + fcfsMintCount < WL_CAP, "WL cap reached");
            require(!wlMinted[msg.sender], "Already minted WL");
            _verifyMerkle(fcfsRoot, proof);

            price = WL_PRICE;
            wlMinted[msg.sender] = true;
            fcfsMintCount++;
        } else if (phase == 3) {
            // ── Public phase ──
            price = PUBLIC_PRICE;
        } else {
            revert WrongPhase();
        }

        // Pull USDG from minter
        usdgToken.safeTransferFrom(msg.sender, address(this), price);

        // V3: 100% → TreasuryVault (auto-splits 80/20 internally)
        usdgToken.safeTransfer(treasuryVault, price);
        (bool tvOk, ) = treasuryVault.call(
            abi.encodeWithSignature("receiveMintFunds(uint256)", price)
        );
        require(tvOk, "TV receive failed");

        // Record on PlatformManager
        (bool pmOk, ) = platformManager.call(
            abi.encodeWithSignature("recordMint(uint256)", price)
        );
        require(pmOk, "PM record failed");

        // Assign & mint
        tokenId = _nextMintId;
        mintPrincipal[tokenId] = price;
        // Read GOOGL price from Chainlink oracle; fallback to frontend-supplied price if stale
        (, int256 oraclePrice,, uint256 updatedAt,) = googlPriceFeed.latestRoundData();
        if (updatedAt > 0 && block.timestamp - updatedAt < 12 hours && oraclePrice > 0) {
            googlPriceAtMint[tokenId] = uint256(oraclePrice);
        } else {
            googlPriceAtMint[tokenId] = googlPrice; // fallback: frontend price from Robinhood API
        }
        mintTimestamp[tokenId] = uint48(block.timestamp);
        minterOf[tokenId] = msg.sender;

        _nextMintId = tokenId + 1;
        _safeMint(msg.sender, tokenId);

        // V3: Deploy TBA at mint time and store the address on-chain
        if (erc6551Registry != address(0) && erc6551Implementation != address(0)) {
            address tba = IERC6551Registry(erc6551Registry).createAccount(
                erc6551Implementation,
                bytes32(0),
                block.chainid,
                address(this),
                tokenId
            );
            tbaForToken[tokenId] = tba;
        }

        if (_nextMintId > MAX_SUPPLY) mintActive = false;
        emit NFTMinted(tokenId, msg.sender, price, googlPriceAtMint[tokenId]);
    }

    // ─── Merkle verification ───
    function _verifyMerkle(bytes32 root, bytes32[] calldata proof) internal view {
        require(root != bytes32(0), "Root not set");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(proof, root, leaf), "Not whitelisted");
    }

    // ─── Transfer hook (blocks soulbound NFTs) ───
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        address from = _ownerOf(tokenId);
        // Block transfers of fully-redeemed NFTs (they become permanent collectibles)
        if (soulbound[tokenId] && from != address(0)) {
            revert("NFT fully redeemed - soulbound");
        }
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory json = string(abi.encodePacked(
            '{"name":"Google Stock NFT #', _toString(tokenId),
            '","description":"On-chain certificate representing fractional ownership of Alphabet Class A (GOOGL) via Google Stock Passport. ERC-6551 smart account backed by Google shares and PILE tokens.",',
            '"image":"data:image/svg+xml;base64,', _svgBase64(tokenId), '",',
            '"external_url":"https://robinhoodchain.blockscout.com/address/', _toHexString(tbaForToken[tokenId]), '",',
            '"attributes":[',
            '{"trait_type":"Certificate ID","value":"#', _toString(tokenId), '"},',
            '{"trait_type":"GOOGL Share","value":', _googlShareString(tokenId), '},',
            '{"trait_type":"$PILE Share","value":1},',
            '{"trait_type":"Stock Value (USD)","value":5},',
            '{"trait_type":"GOOGL Price at Mint (USD)","value":', _googlPriceString(tokenId), '},',
            '{"trait_type":"Mint Date","value":"', _mintDateString(tokenId), '"},',
            '{"trait_type":"TBA Smart Account","value":"', _toHexString(tbaForToken[tokenId]), '"},',
            '{"trait_type":"Minter","value":"', _toHexString(minterOf[tokenId]), '"}',
            ']}'
        ));
        return string(abi.encodePacked("data:application/json;base64,", _base64Encode(bytes(json))));
    }

    // ─── SVG Certificate Generator ───
    function _svgBase64(uint256 tokenId) internal view returns (string memory) {
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">',
            '<defs><linearGradient id="f" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9edd3e"/><stop offset="100%" stop-color="#6ab520"/></linearGradient></defs>',
            '<rect width="600" height="800" fill="#000000" rx="16"/>',
            '<rect x="12" y="12" width="576" height="776" fill="none" stroke="url(#f)" stroke-width="2" rx="12"/>',
            '<rect x="20" y="20" width="560" height="760" fill="none" stroke="url(#f)" stroke-width="0.5" rx="8" opacity="0.3"/>',
            '<text x="300" y="50" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="url(#f)" font-weight="bold" letter-spacing="3">IN CHAIN WE TRUST</text>',
            '<text x="300" y="100" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#ffffff" font-weight="bold">Google Stock Passport</text>',
            '<text x="300" y="125" text-anchor="middle" font-family="Courier New,monospace" font-size="12" fill="#8888aa">ERC-6551 Token Bound Account</text>',
            '<line x1="80" y1="140" x2="520" y2="140" stroke="url(#f)" stroke-width="1" opacity="0.5"/>',
            '<text x="300" y="180" text-anchor="middle" font-family="Courier New,monospace" font-size="48" fill="url(#f)" font-weight="bold">#', _padTokenId(tokenId), '</text>',
            '<text x="90" y="255" font-family="Courier New,monospace" font-size="13" fill="#667799">ALPHABET (GOOGLE) SHARES</text>',
            _svgRowColor(290, "GOOGL Share", string(abi.encodePacked(_googlShareString(tokenId), " GOOGL")), "#ffffff"),
            _svgRowColor(335, "$PILE Share", "$1.00", "#9edd3e"),
            _svgRowColor(380, "Stock Value (USD)", "$5.00", "#ffffff"),
            _svgRowColor(425, "GOOGL Price at Mint", string(abi.encodePacked("$", _googlPriceString(tokenId))), "#9edd3e"),
            _svgRowColor(470, "Mint Date", _mintDateString(tokenId), "#ffffff"),
            '<text x="90" y="530" font-family="Courier New,monospace" font-size="12" fill="#667799">ERC-6551 SMART ACCOUNT</text>',
            '<text x="90" y="560" font-family="Courier New,monospace" font-size="14" fill="#ffffff">', _toHexString(tbaForToken[tokenId]), '</text>',
            '<text x="90" y="583" font-family="Courier New,monospace" font-size="11" fill="#667799">Assets (PILE + GOOGL) held in this smart account</text>',
            '<text x="90" y="642" font-family="Courier New,monospace" font-size="12" fill="#8888aa">Network</text>',
            '<text x="510" y="642" text-anchor="end" font-family="Courier New,monospace" font-size="13" fill="#ffffff">Robinhood Chain</text>',
            '<text x="90" y="685" font-family="Courier New,monospace" font-size="11" fill="#8888aa">Minter</text>',
            '<text x="510" y="685" text-anchor="end" font-family="Courier New,monospace" font-size="10" fill="#ffffff">', _toHexString(minterOf[tokenId]), '</text>',
            '<line x1="80" y1="710" x2="520" y2="710" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>',
            '<text x="300" y="750" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#555577">NFT created by: @StocksNFT_ | stock shares tokenized by Robinhood Chain</text>',
            '<circle cx="30" cy="30" r="4" fill="url(#f)" opacity="0.5"/><circle cx="570" cy="30" r="4" fill="url(#f)" opacity="0.5"/><circle cx="30" cy="770" r="4" fill="url(#f)" opacity="0.5"/><circle cx="570" cy="770" r="4" fill="url(#f)" opacity="0.5"/>',
            '</svg>'
        ));
        return _base64Encode(bytes(svg));
    }

    function _svgRowColor(uint y, string memory label, string memory value, string memory color) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<text x="90" y="', _toString(y), '" font-family="Georgia,serif" font-size="15" fill="#8888aa">', label, '</text>',
            '<text x="510" y="', _toString(y), '" text-anchor="end" font-family="Courier New,monospace" font-size="18" fill="', color, '" font-weight="bold">', value, '</text>',
            '<line x1="90" y1="', _toString(y+12), '" x2="510" y2="', _toString(y+12), '" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>'
        ));
    }

    // ─── Helpers ───
    function _toString(uint256 val) internal pure returns (string memory) {
        if (val == 0) return "0";
        uint256 temp = val;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (val != 0) { buf[--digits] = bytes1(uint8(48 + (val % 10))); val /= 10; }
        return string(buf);
    }

    function _padTokenId(uint256 tokenId) internal pure returns (string memory) {
        if (tokenId < 10) return string(abi.encodePacked("00", _toString(tokenId)));
        if (tokenId < 100) return string(abi.encodePacked("0", _toString(tokenId)));
        return _toString(tokenId);
    }

    function _googlShareString(uint256 tokenId) internal view returns (string memory) {
        uint256 price = googlPriceAtMint[tokenId];
        if (price == 0) return "0.0000";
        uint256 shares = (4_00000000 * 1e18) / price; // $4 worth of GOOGL, 8 decimals precision
        uint256 whole = shares / 1e18;
        uint256 frac = (shares % 1e18) / 1e14;
        return string(abi.encodePacked(_toString(whole), ".", _toString4(frac)));
    }

    function _googlPriceString(uint256 tokenId) internal view returns (string memory) {
        uint256 price = googlPriceAtMint[tokenId];
        uint256 whole = price / 1e8;
        uint256 frac = (price % 1e8) / 1e6;
        return string(abi.encodePacked(_toString(whole), ".", _toString2(frac)));
    }

    function _mintDateString(uint256 tokenId) internal view returns (string memory) {
        uint48 ts = mintTimestamp[tokenId];
        if (ts == 0) return "Unknown";
        // Convert unix timestamp to YYYY-MM-DD
        (uint year, uint month, uint day) = _timestampToDate(ts);
        return string(abi.encodePacked(_toString(year), "-", _toString2(month), "-", _toString2(day)));
    }

    function _toString2(uint256 val) internal pure returns (string memory) {
        return string(abi.encodePacked(bytes1(uint8(48 + (val/10)%10)), bytes1(uint8(48 + val%10))));
    }

    function _toString4(uint256 val) internal pure returns (string memory) {
        return string(abi.encodePacked(
            bytes1(uint8(48 + (val/1000)%10)),
            bytes1(uint8(48 + (val/100)%10)),
            bytes1(uint8(48 + (val/10)%10)),
            bytes1(uint8(48 + val%10))
        ));
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0"; s[1] = "x";
        for (uint i = 0; i < 20; i++) {
            uint8 b = uint8(uint160(addr) / (16**(2*(19-i))));
            uint8 hi = b / 16; uint8 lo = b % 16;
            s[2+i*2] = _hexChar(hi); s[2+i*2+1] = _hexChar(lo);
        }
        return string(s);
    }

    function _hexChar(uint8 b) internal pure returns (bytes1) {
        return b < 10 ? bytes1(uint8(48 + b)) : bytes1(uint8(87 + b));
    }

    // ─── Simple timestamp → date (approximate, good enough for display) ───
    function _timestampToDate(uint48 ts) internal pure returns (uint year, uint month, uint day) {
        // Simplified: works for dates between 1970-2100
        uint256 daysSince1970 = ts / 86400;
        year = 1970;
        while (daysSince1970 >= 365 + (_isLeap(year) ? 1 : 0)) {
            daysSince1970 -= 365 + (_isLeap(year) ? 1 : 0);
            year++;
        }
        uint8[12] memory monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
        if (_isLeap(year)) monthDays[1] = 29;
        month = 1;
        for (uint i = 0; i < 12; i++) {
            if (daysSince1970 < monthDays[i]) { day = daysSince1970 + 1; break; }
            daysSince1970 -= monthDays[i];
            month++;
        }
        if (day == 0) day = 1;
    }
    
    function _isLeap(uint256 y) internal pure returns (bool) {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    // ─── Base64 Encoder ───
    string internal constant _TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        uint256 len = data.length;
        if (len == 0) return "";
        uint256 encodedLen = ((len + 2) / 3) * 4;
        bytes memory result = new bytes(encodedLen);
        uint256 ptr;
        for (uint256 i = 0; i < len; i += 3) {
            uint256 input = (uint256(uint8(data[i])) << 16)
                | (i + 1 < len ? uint256(uint8(data[i+1])) << 8 : 0)
                | (i + 2 < len ? uint256(uint8(data[i+2])) : 0);
            result[ptr++] = bytes(_TABLE)[(input >> 18) & 0x3F];
            result[ptr++] = bytes(_TABLE)[(input >> 12) & 0x3F];
            result[ptr++] = i + 1 < len ? bytes(_TABLE)[(input >> 6) & 0x3F] : bytes1("=");
            result[ptr++] = i + 2 < len ? bytes(_TABLE)[input & 0x3F] : bytes1("=");
        }
        return string(result);
    }

    // ─── EIP-2981 ───
    function royaltyInfo(uint256, uint256 salePrice) external view override
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = treasuryEOA;
        royaltyAmount = (salePrice * royaltyBps) / 10_000;
    }

    // ─── Required overrides ───
    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable) { super._increaseBalance(account, value); }
    function supportsInterface(bytes4 id) public view override(ERC721, ERC721Enumerable, IERC165) returns (bool) {
        return id == type(IERC2981).interfaceId || super.supportsInterface(id);
    }
}
