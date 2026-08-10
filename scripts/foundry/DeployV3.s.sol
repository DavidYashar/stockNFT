// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "contracts/ERC6551Account.sol";
import "contracts/TreasuryVault.sol";
import "contracts/PileToken.sol";
import "contracts/PlatformManager.sol";
import "contracts/GoogleStockNFT.sol";

contract DeployV3 is Script {
    address constant USDG             = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant GOOGL            = 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3;
    address constant UNI_ROUTER       = 0xCaf681a66D020601342297493863E78C959E5cb2;
    address constant UNI_POSMGR       = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address constant QUOTER_V2        = 0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7;
    address constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    address constant GOOGL_PRICE_FEED = 0xF6f373a037c30F0e5010d854385cA89185AE638b;

    bytes32 constant GTD_ROOT  = 0xdeaa34595de952a39f235e13a2793b823388b6a3f55aee90527c39e9df5af623;
    bytes32 constant FCFS_ROOT = 0x8935527301038bc4102b1b29997af9b212bc18eb0933a06aad5feb8fa1486cf9;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envOr("TREASURY_EOA", deployer);

        console.log("=== Deploying V3 - 5 contracts ===");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerKey);

        StockNFTAccount acc = new StockNFTAccount();
        console.log("1. StockNFTAccount:", address(acc));

        TreasuryVault tv = new TreasuryVault(
            USDG, GOOGL, UNI_ROUTER, UNI_POSMGR, QUOTER_V2, deployer, treasury
        );
        console.log("2. TreasuryVault:", address(tv));

        PileToken pile = new PileToken(
            address(tv), address(tv), address(tv), address(tv), address(tv)
        );
        console.log("3. PileToken:", address(pile));

        PlatformManager pm = new PlatformManager(deployer, treasury);
        console.log("4. PlatformManager:", address(pm));

        GoogleStockNFT nft = new GoogleStockNFT(
            deployer, USDG, GOOGL_PRICE_FEED, treasury, address(tv)
        );
        console.log("5. GoogleStockNFT:", address(nft));

        // Wiring
        tv.setPileToken(address(pile));
        tv.setGoogleStockNFT(address(nft));
        tv.setPlatformManager(address(pm));
        tv.setERC6551(ERC6551_REGISTRY, address(acc));

        pm.setGoogleStockNFT(address(nft));
        pm.setTreasuryVault(address(tv));

        nft.setPlatformManager(address(pm));
        nft.setERC6551(ERC6551_REGISTRY, address(acc));

        // Merkle roots
        nft.setGtdRoot(GTD_ROOT);
        nft.setFcfsRoot(FCFS_ROOT);

        vm.stopBroadcast();

        console.log("");
        console.log("=== V3 Mainnet Deployment Complete ===");
        console.log("StockNFTAccount: ", address(acc));
        console.log("TreasuryVault:   ", address(tv));
        console.log("PileToken:       ", address(pile));
        console.log("PlatformManager: ", address(pm));
        console.log("GoogleStockNFT:  ", address(nft));
    }
}
