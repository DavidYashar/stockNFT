import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);
  const treasuryEOA = process.env.TREASURY_EOA || deployerAddr;

  // ─── Mainnet Token Addresses ───
  const USDG   = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";  // USDG on Robinhood Chain (from plan doc)
  const GOOGL  = "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3";  // GOOGL on Robinhood Chain (from plan doc)
  const UNI_ROUTER = "0xCaf681a66D020601342297493863E78C959E5cb2"; // SwapRouter02 on Robinhood Chain
  const UNI_POSMGR = "0x73991a25c818bf1f1128deaab1492d45638de0d3"; // NonfungiblePositionManager on Robinhood Chain mainnet
  const QUOTER_V2 = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7"; // QuoterV2 on Robinhood Chain
  const GOOGL_PRICE_FEED = "0xF6f373a037c30F0e5010d854385cA89185AE638b"; // Chainlink GOOGL/USD (8 decimals)
  const ERC6551_REGISTRY = "0x000000006551c19487814612e58FE06813775758";

  // ─── Merkle roots ───
  const GTD_ROOT  = "0xdeaa34595de952a39f235e13a2793b823388b6a3f55aee90527c39e9df5af623";
  const FCFS_ROOT = "0x8935527301038bc4102b1b29997af9b212bc18eb0933a06aad5feb8fa1486cf9";

  console.log("\n═══ Deploying V3 — 5 contracts ═══\n");

  // ─── 1. ERC6551Account (implementation) ───
  console.log("1. Deploying StockNFTAccount...");
  const AccF = await ethers.getContractFactory("StockNFTAccount");
  const accImpl = await AccF.deploy();
  await accImpl.waitForDeployment();
  const accImplAddr = await accImpl.getAddress();
  console.log("   StockNFTAccount:", accImplAddr);

  // ─── 2. TreasuryVault ───
  console.log("\n2. Deploying TreasuryVault...");
  const TVF = await ethers.getContractFactory("TreasuryVault");
  const tv = await TVF.deploy(
    ethers.getAddress(USDG), ethers.getAddress(GOOGL),
    ethers.getAddress(UNI_ROUTER), ethers.getAddress(UNI_POSMGR),
    ethers.getAddress(QUOTER_V2), deployerAddr, treasuryEOA
  );
  await tv.waitForDeployment();
  const tvAddr = await tv.getAddress();
  console.log("   TreasuryVault:", tvAddr);

  // ─── 3. PileToken — all 1B PILE → TreasuryVault ───
  console.log("\n3. Deploying PileToken (all supply → TreasuryVault)...");
  const PileF = await ethers.getContractFactory("PileToken");
  const pile = await PileF.deploy(tvAddr, tvAddr, tvAddr, tvAddr, tvAddr);
  await pile.waitForDeployment();
  const pileAddr = await pile.getAddress();
  console.log("   PileToken:", pileAddr);
  console.log("   All 1B PILE sent to TreasuryVault");

  // ─── 4. PlatformManager ───
  console.log("\n4. Deploying PlatformManager...");
  const PMF = await ethers.getContractFactory("PlatformManager");
  const pm = await PMF.deploy(deployerAddr, treasuryEOA);
  await pm.waitForDeployment();
  const pmAddr = await pm.getAddress();
  console.log("   PlatformManager:", pmAddr);

  // ─── 5. GoogleStockNFT ───
  console.log("\n5. Deploying GoogleStockNFT...");
  const NFTF = await ethers.getContractFactory("GoogleStockNFT");
  const nft = await NFTF.deploy(
    deployerAddr, ethers.getAddress(USDG), ethers.getAddress(GOOGL_PRICE_FEED), treasuryEOA, tvAddr
  );
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("   GoogleStockNFT:", nftAddr);

  // ─── 6. Wiring ───
  console.log("\n6. Wiring contracts...");

  // TreasuryVault: set PileToken address
  await tv.setPileToken(pileAddr);
  console.log("   TV.setPileToken:", pileAddr);

  // TreasuryVault: set NFT address
  await tv.setGoogleStockNFT(nftAddr);
  console.log("   TV.setGoogleStockNFT:", nftAddr);

  // TreasuryVault: set PlatformManager (needed for openPileClaims → mintEnded check)
  await tv.setPlatformManager(pmAddr);
  console.log("   TV.setPlatformManager:", pmAddr);

  // TreasuryVault: set ERC6551 (needed for claimPILE/claimGOOGL → TBA deployment)
  await tv.setERC6551(ERC6551_REGISTRY, accImplAddr);
  console.log("   TV.setERC6551 done");

  // PlatformManager: set NFT + TV
  await pm.setGoogleStockNFT(nftAddr);
  await pm.setTreasuryVault(tvAddr);
  console.log("   PM.setGoogleStockNFT:", nftAddr);
  console.log("   PM.setTreasuryVault:", tvAddr);

  // NFT: set PlatformManager + ERC6551
  await nft.setPlatformManager(pmAddr);
  await nft.setERC6551(ERC6551_REGISTRY, accImplAddr);
  console.log("   NFT.setPlatformManager:", pmAddr);
  console.log("   NFT.setERC6551 done");

  // ─── 7. Set Merkle roots ───
  console.log("\n7. Setting Merkle roots...");
  await nft.setGtdRoot(GTD_ROOT);
  await nft.setFcfsRoot(FCFS_ROOT);
  console.log("   GTD root set");
  console.log("   FCFS root set");

  // ─── Summary ───
  console.log("\n═══════════════════════════════");
  console.log("  V3 Mainnet Deployment Done");
  console.log("═══════════════════════════════");
  console.log("PileToken:         ", pileAddr);
  console.log("ERC6551Account:    ", accImplAddr);
  console.log("TreasuryVault:     ", tvAddr);
  console.log("PlatformManager:   ", pmAddr);
  console.log("GoogleStockNFT:    ", nftAddr);
  console.log("\nUpdate .env.local:");
  console.log(`NEXT_PUBLIC_NFT_ADDRESS=${nftAddr}`);
  console.log(`NEXT_PUBLIC_PLATFORM_ADDRESS=${pmAddr}`);
  console.log(`NEXT_PUBLIC_TREASURY_ADDRESS=${tvAddr}`);
  console.log(`NEXT_PUBLIC_PILE_ADDRESS=${pileAddr}`);
  console.log(`NEXT_PUBLIC_ERC6551_ACCOUNT_ADDRESS=${accImplAddr}`);
  console.log("\nAdmin flow:");
  console.log("1. Set GTD + FCFS roots on NFT (already done above)");
  console.log("2. pm.openGTD()  — starts GTD mint");
  console.log("3. pm.openFCFS() — after 2h or cap met");
  console.log("4. pm.openPublic() — open mint at 6 USDG");
}

main().catch(e => { console.error(e); process.exit(1); });
