// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MockERC6551Registry
 * @notice Minimal ERC-6551 registry for testing. Deploys ERC-1167 minimal proxies
 *         pointing to the provided implementation, with appended constant data.
 */
contract MockERC6551Registry {
    error AccountCreationFailed();

    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address account) {
        // Deterministic CREATE2 address calculation
        bytes memory initCode = abi.encodePacked(
            hex"3d60ad80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3",
            abi.encode(salt, chainId, tokenContract, tokenId)
        );

        bytes32 initCodeHash = keccak256(initCode);
        account = address(uint160(uint256(keccak256(abi.encodePacked(
            hex"ff",
            address(this),
            salt,
            initCodeHash
        )))));

        // Deploy the proxy
        assembly {
            account := create2(0, add(initCode, 0x20), mload(initCode), salt)
            if iszero(account) {
                mstore(0x00, 0x30116425) // AccountCreationFailed()
                revert(0x1c, 0x04)
            }
        }

        // Call initialize on the deployed proxy
        (bool ok, ) = account.call(
            abi.encodeWithSignature("initialize(uint256,address,uint256)", chainId, tokenContract, tokenId)
        );
        require(ok, "Initialize failed");
    }

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address) {
        bytes memory initCode = abi.encodePacked(
            hex"3d60ad80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3",
            abi.encode(salt, chainId, tokenContract, tokenId)
        );

        bytes32 initCodeHash = keccak256(initCode);
        return address(uint160(uint256(keccak256(abi.encodePacked(
            hex"ff",
            address(this),
            salt,
            initCodeHash
        )))));
    }
}
