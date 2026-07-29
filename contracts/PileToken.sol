// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PileToken (PILE)
 * @notice PILE Token — ERC-20 token for StockNFT V3.
 *
 *         Fully pre-minted at deploy. NOT mintable. 1B total supply, 6 decimals.
 *
 *         Allocation (constructor):
 *           - 50% (500M) → nftHoldersRecipient (TreasuryVault) — NFT holder claims
 *           - 15% (150M) → lpRecipient — DEX liquidity pairing
 *           - 15% (150M) → diamondRecipient — Diamond Hands rewards
 *           - 10% (100M) → teamRecipient — Treasury / team operations
 *           - 10% (100M) → ecosystemRecipient — Partner incentives
 */
contract PileToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e6; // 1B with 6 decimals
    uint256 public constant NFT_HOLDERS_ALLOC  = (TOTAL_SUPPLY * 50) / 100;
    uint256 public constant LP_ALLOC           = (TOTAL_SUPPLY * 15) / 100;
    uint256 public constant DIAMOND_ALLOC      = (TOTAL_SUPPLY * 15) / 100;
    uint256 public constant TEAM_ALLOC         = (TOTAL_SUPPLY * 10) / 100;
    uint256 public constant ECOSYSTEM_ALLOC    = (TOTAL_SUPPLY * 10) / 100;

    /// @notice PILE uses 6 decimals (not the ERC-20 default of 18).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // Immutable recipients (set at construction, forever)
    address public immutable nftHoldersRecipient;
    address public immutable lpRecipient;
    address public immutable diamondRecipient;
    address public immutable teamRecipient;
    address public immutable ecosystemRecipient;

    event Deployed(address indexed nftHolders, address indexed lp, address indexed diamond, address team, address ecosystem);

    /// @notice All tokens minted at construction to their respective addresses.
    ///         Supply is forever capped at TOTAL_SUPPLY — no mint() function exists.
    constructor(
        address _nftHoldersRecipient,  // TreasuryVault
        address _lpRecipient,
        address _diamondRecipient,     // DiamondHands contract (or placeholder)
        address _teamRecipient,        // Treasury EOA
        address _ecosystemRecipient    // Partner address
    ) ERC20("PILE Token", "PILE") {
        require(_nftHoldersRecipient != address(0), "Zero NFT holders");
        require(_lpRecipient != address(0), "Zero LP");
        require(_diamondRecipient != address(0), "Zero Diamond");
        require(_teamRecipient != address(0), "Zero Team");
        require(_ecosystemRecipient != address(0), "Zero Ecosystem");

        nftHoldersRecipient = _nftHoldersRecipient;
        lpRecipient = _lpRecipient;
        diamondRecipient = _diamondRecipient;
        teamRecipient = _teamRecipient;
        ecosystemRecipient = _ecosystemRecipient;

        _mint(_nftHoldersRecipient,  NFT_HOLDERS_ALLOC);
        _mint(_lpRecipient,           LP_ALLOC);
        _mint(_diamondRecipient,      DIAMOND_ALLOC);
        _mint(_teamRecipient,         TEAM_ALLOC);
        _mint(_ecosystemRecipient,    ECOSYSTEM_ALLOC);

        emit Deployed(_nftHoldersRecipient, _lpRecipient, _diamondRecipient, _teamRecipient, _ecosystemRecipient);
    }
}
