// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IERC6551Registry
 * @notice Canonical ERC-6551 Registry interface per EIP-6551.
 *         Deployed at 0x000000006551c19487814612e58FE06813775758 on Robinhood Chain.
 */
interface IERC6551Registry {
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );

    error AccountCreationFailed();

    /**
     * @notice Deploy a Token Bound Account (ERC-1167 minimal proxy with appended constant data).
     * @param implementation The TBA implementation contract
     * @param salt Usually bytes32(0) for standard deployment
     * @param chainId The chain ID
     * @param tokenContract The NFT contract address
     * @param tokenId The NFT token ID
     * @return account The deployed TBA address
     */
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address account);

    /**
     * @notice Get the deterministic TBA address for an NFT (works before deployment).
     * @param implementation The TBA implementation contract
     * @param salt Usually bytes32(0)
     * @param chainId The chain ID
     * @param tokenContract The NFT contract address
     * @param tokenId The NFT token ID
     * @return account The deterministic TBA address
     */
    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address account);
}
