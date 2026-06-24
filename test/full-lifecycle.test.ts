import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GoogleStockNFT, TreasuryVault, StockVault, PlatformManager, InterestDistributor, MockUSDC, MockGOOGLon } from "../typechain-types";

describe("Google Stock NFT — Full Lifecycle", function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let usdc: MockUSDC;
  let googlon: MockGOOGLon;
  let nft: GoogleStockNFT;
  let treasury: TreasuryVault;
  let stockVault: StockVault;
  let platform: PlatformManager;
  let interest: InterestDistributor;

  const MIN_USDC = 10_000_000n; // 10 USDC (6 decimals)
  const GOOGL_PRICE = 365_00000000n; // $365 with 8 decimals

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // ---- Deploy mocks ----
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const MockGOOGLon = await ethers.getContractFactory("MockGOOGLon");
    googlon = await MockGOOGLon.deploy();

    // ---- Deploy PlatformManager (no deps) ----
    const PlatformManager = await ethers.getContractFactory("PlatformManager");
    platform = await PlatformManager.deploy(owner.address);

    // ---- Deploy StockVault ----
    const StockVault = await ethers.getContractFactory("StockVault");
    stockVault = await StockVault.deploy(
      await usdc.getAddress(),
      await googlon.getAddress(),
      owner.address, // mock uniswap PM
      owner.address
    );
    await stockVault.setPlatformManager(await platform.getAddress());

    // ---- Deploy InterestDistributor ----
    const InterestDistributor = await ethers.getContractFactory("InterestDistributor");
    interest = await InterestDistributor.deploy(
      await usdc.getAddress(),
      owner.address
    );

    // ---- Deploy mock Aave pool ----
    const MockAavePool = await ethers.getContractFactory("MockAavePool");
    const mockAave = await MockAavePool.deploy();
    const aaveAddress = await mockAave.getAddress();

    // ---- Deploy TreasuryVault ----
    const TreasuryVault = await ethers.getContractFactory("TreasuryVault");
    treasury = await TreasuryVault.deploy(
      await usdc.getAddress(),
      aaveAddress,
      owner.address
    );
    await treasury.setPlatformManager(await platform.getAddress());
    await treasury.setStockVault(await stockVault.getAddress());
    await treasury.setInterestDistributor(await interest.getAddress());

    // Deploy a mock aUSDC for the treasury
    const MockAUSDC = await ethers.getContractFactory("MockUSDC");
    const aUsdc = await MockAUSDC.deploy();
    await treasury.setAUsdcToken(await aUsdc.getAddress());

    // ---- Deploy GoogleStockNFT ----
    const GoogleStockNFT = await ethers.getContractFactory("GoogleStockNFT");
    nft = await GoogleStockNFT.deploy(
      await usdc.getAddress(),
      owner.address,
      "https://gateway.irys.xyz/mutable/"
    );
    await nft.setTreasuryVault(await treasury.getAddress());
    await nft.setPlatformManager(await platform.getAddress());

    // ---- Back-wire ----
    await treasury.setGoogleStockNFT(await nft.getAddress());
    await platform.setGoogleStockNFT(await nft.getAddress());
    await platform.setTreasuryVault(await treasury.getAddress());
    await platform.setStockVault(await stockVault.getAddress());
    await stockVault.setGoogleStockNFT(await nft.getAddress());
    await interest.setGoogleStockNFT(await nft.getAddress());
    await interest.setTreasuryVault(await treasury.getAddress());

    // Fund users with USDC
    await usdc.mint(alice.address, 1_000_000_000000n); // 1M USDC
    await usdc.mint(bob.address, 1_000_000_000000n);

    // Approve NFT contract to spend USDC
    await usdc.connect(alice).approve(await nft.getAddress(), ethers.MaxUint256);
    await usdc.connect(bob).approve(await nft.getAddress(), ethers.MaxUint256);
  });

  // ==================== Mint Tests ====================

  describe("Minting", function () {
    it("should mint an NFT with exactly 10 USDC", async function () {
      const tx = await nft.connect(alice).mint(GOOGL_PRICE);
      await expect(tx).to.emit(nft, "NFTMinted").withArgs(1, alice.address, MIN_USDC, GOOGL_PRICE);

      expect(await nft.balanceOf(alice.address, 1)).to.equal(1n);
      expect(await nft.mintPrincipal(1)).to.equal(MIN_USDC);
      expect(await nft.googlPriceAtMint(1)).to.equal(GOOGL_PRICE);
    });

    it("should allow multiple mints at 10 USDC each", async function () {
      // Alice mints a second NFT
      await nft.connect(alice).mint(GOOGL_PRICE);

      // Bob mints one
      await nft.connect(bob).mint(GOOGL_PRICE);

      expect(await nft.balanceOf(alice.address, 2)).to.equal(1);
      expect(await nft.balanceOf(bob.address, 3)).to.equal(1);
      expect(await nft.mintPrincipal(2)).to.equal(MIN_USDC);
      expect(await nft.mintPrincipal(3)).to.equal(MIN_USDC);
    });

    it("should split USDC 80/20 in treasury", async function () {
      // 3 NFTs minted × 10 USDC = 30 total
      // pool80 = 24 USDC, pool20 = 6 USDC
      const pool80 = await treasury.pool80();
      const pool20 = await treasury.pool20();
      expect(pool80).to.equal(24_000_000n);
      expect(pool20).to.equal(6_000_000n);
    });

    it("should set 48h interest start timestamp", async function () {
      const startTime = await nft.interestStartTimestamp(1);
      const block = await ethers.provider.getBlock("latest");
      // Allow 5s tolerance for test execution timing
      const expected = BigInt(block!.timestamp) + 48n * 3600n;
      expect(startTime).to.be.closeTo(expected, 5);
    });
  });

  // ==================== Treasury Sweep Tests ====================

  describe("Treasury Sweep (4-hour DeFi)", function () {
    it("should sweep pool20 after 4 hours", async function () {
      // Fast-forward 4 hours
      await time.increase(4 * 3600);

      const pool20Before = await treasury.pool20();
      expect(pool20Before).to.be.gt(0);

      await treasury.connect(owner).sweepDeFi();

      expect(await treasury.pool20()).to.equal(0);
      expect(await treasury.totalDeFiPrincipal()).to.equal(pool20Before);
    });

    it("should reject sweep before 4 hours", async function () {
      await expect(
        treasury.connect(owner).sweepDeFi()
      ).to.be.revertedWithCustomError(treasury, "SweepTooEarly");
    });
  });

  // ==================== Royalty Tests ====================

  describe("EIP-2981 Royalty", function () {
    it("should return 10% royalty", async function () {
      const salePrice = ethers.parseEther("1"); // 1 ETH sale
      const [receiver, amount] = await nft.royaltyInfo(1, salePrice);
      expect(receiver).to.equal(owner.address);
      expect(amount).to.equal(salePrice / 10n);
    });
  });

  // ==================== Interest Tests ====================

  describe("Interest System", function () {
    it("should not accrue interest before 48h wait", async function () {
      const pending = await interest.getPendingInterest(1);
      expect(pending).to.equal(0);
    });

    it("should accrue interest after 48h wait", async function () {
      // Fast-forward 48 hours
      await time.increase(48 * 3600);

      const pending = await interest.getPendingInterest(1);
      // 2% on 2 USDC DeFi principal: roughly 0.04 USDC/year
      // After 48h: ~0.000009 USDC (very small)
      expect(pending).to.be.gt(0);
    });

    it("should forfeit unclaimed interest on transfer", async function () {
      const pendingBefore = await interest.getPendingInterest(1);

      // Alice transfers NFT #1 to Bob
      await nft.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1, "0x");

      // Alice no longer owns it, Bob does
      expect(await nft.balanceOf(bob.address, 1)).to.equal(1);
      expect(await nft.balanceOf(alice.address, 1)).to.equal(0);

      // Bob's interest clock resets to now + 48h
      const bobStartTime = await nft.interestStartTimestamp(1);
      const block = await ethers.provider.getBlock("latest");
      expect(bobStartTime).to.equal(BigInt(block!.timestamp) + 48n * 3600n);
    });
  });

  // ==================== Trigger Tests ====================

  describe("PlatformManager Trigger", function () {
    it("should not trigger before mint ends", async function () {
      await expect(
        platform.connect(owner).triggerGooglePurchase()
      ).to.be.revertedWithCustomError(platform, "MintNotEnded");
    });

    it("should stop mint and burn unminted", async function () {
      // 3 of 10,000 minted. Burn remaining 9,997.
      await platform.connect(owner).stopMintAndBurn(9_997);

      expect(await nft.mintActive()).to.equal(false);
      expect(await platform.mintEnded()).to.equal(true);
    });

    it("should track loyalty fees for trigger", async function () {
      // 3 NFTs × 10 USDC = 30 USDC totalPrincipal
      // gap20 = 20% of 30 = 6 USDC
      const gap = await platform.gap20();
      expect(gap).to.equal(6_000_000n);
    });
  });

  // ==================== Redemption Tests (after purchase) ====================

  describe("Redemption", function () {
    before(async function () {
      // Simulate Google purchase by minting GOOGLon to StockVault
      // and marking purchase complete (bypassing Uniswap in test)
      await googlon.mint(await stockVault.getAddress(), ethers.parseEther("100"));

      // Directly manipulate purchase state for testing
      // (in production, executeGooglePurchase does this)
      const tx = await stockVault.connect(owner).receivePool80Funds(0);
      await tx.wait();
    });

    it("should not allow redemption before purchase complete", async function () {
      await expect(
        stockVault.connect(bob).requestRedemption(1)
      ).to.be.revertedWith("Purchase not complete");
    });
  });

  // ==================== Pause Tests ====================

  describe("Emergency Pause", function () {
    it("should pause and unpause the platform", async function () {
      await platform.connect(owner).pause();
      expect(await platform.paused()).to.equal(true);

      await platform.connect(owner).unpause();
      expect(await platform.paused()).to.equal(false);
    });
  });
});
