// Contract addresses — Google Stock NFT (Mainnet)
export const CONTRACT_ADDRESSES = {
  googleStockNFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || "",
  platformManager: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || "",
  stockVault: process.env.NEXT_PUBLIC_STOCK_ADDRESS || "",
  interestDistributor: process.env.NEXT_PUBLIC_INTEREST_ADDRESS || "",
  googlon: process.env.NEXT_PUBLIC_GOOGLON_ADDRESS || "",
  treasuryEOA: process.env.NEXT_PUBLIC_TREASURY_EOA || "",
  treasuryVaultAddress: process.env.NEXT_PUBLIC_TREASURY_VAULT_ADDRESS || process.env.NEXT_PUBLIC_TREASURY_EOA || "",
  deployerAddress: process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS || "",
  // DeFi (real mainnet addresses with defaults)
  aavePool: process.env.NEXT_PUBLIC_AAVE_POOL_ADDRESS || "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  aToken: process.env.NEXT_PUBLIC_AUSDC_ADDRESS || "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
  uniswapV3Router: process.env.NEXT_PUBLIC_UNISWAP_V3_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  weth: process.env.NEXT_PUBLIC_WETH_ADDRESS || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

// Minimal ABIs for the frontend (read + write operations)
export const GOOGLE_STOCK_NFT_ABI = [
  "function mint(uint256 googlPrice) payable returns (uint256)",
  "function mintActive() view returns (bool)",
  "function mintPrice() view returns (uint256)",
  "function treasuryEOA() view returns (address)",
  "function ownerOf(uint256) view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function mintPrincipal(uint256) view returns (uint256)",
  "function googlPriceAtMint(uint256) view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function royaltyInfo(uint256,uint256) view returns (address,uint256)",
  "function transferFrom(address,address,uint256) payable",
  "function safeTransferFrom(address,address,uint256) payable",
  "function setApprovalForAll(address,bool)",
  "function isApprovedForAll(address,address) view returns (bool)",
  "function interestStartTimestamp(uint256) view returns (uint48)",
];

export const STOCK_VAULT_ABI = [
  "function purchaseComplete() view returns (bool)",
  "function getShares(uint256) view returns (uint256)",
  "function nftShares(uint256) view returns (uint256)",
  "function requestRedemption(uint256)",
  "function claimRedemption(uint256)",
  "function redemptionRequest(uint256) view returns (uint48)",
  "function owner() view returns (address)",
  "function treasuryVault() view returns (address)",
  "function updateTreasuryVault(address)",
  "function receivePool80Funds() payable",
  "function receiveLoyaltyFunds() payable",
  "function executeGooglePurchase(uint256)",
  "function totalGooglonHeld() view returns (uint256)",
  "function pool80Funds() view returns (uint256)",
  "function loyaltyFunds() view returns (uint256)",
];

export const PLATFORM_MANAGER_ABI = [
  "function owner() view returns (address)",
  "function pool80() view returns (uint256)",
  "function pool20() view returns (uint256)",
  "function totalDeFiPrincipal() view returns (uint256)",
  "function totalLoyaltyFees() view returns (uint256)",
  "function totalMintPrincipal() view returns (uint256)",
  "function gap20() view returns (uint256)",
  "function canTrigger() view returns (bool)",
  "function mintEnded() view returns (bool)",
  "function triggerFired() view returns (bool)",
  "function totalBurned() view returns (uint256)",
  "function sweepInterval() view returns (uint256)",
  "function pauseMint()",
  "function resumeMint()",
  "function pauseAndBurn(uint256)",
  "function stopMintAndBurn(uint256)",
  "function triggerGooglePurchase(uint256)",
  "function recordSweep(uint256)",
  "function recordHarvest(uint256)",
  "function receiveLoyalty(uint256)",
  "function setSweepInterval(uint256)",
];

export const INTEREST_DISTRIBUTOR_ABI = [
  "function getPendingInterest(uint256) view returns (uint256)",
  "function claimInterest(uint256)",
  "function interestPool() view returns (uint256)",
  "function distributionPerToken() view returns (uint256)",
  "function distributionPerTokenForRound(uint256) view returns (uint256)",
  "function distributionRound() view returns (uint256)",
  "function lastClaimedRound(uint256) view returns (uint256)",
  "function claimsAllowed() view returns (bool)",
  "function owner() view returns (address)",
  "function treasuryVault() view returns (address)",
  "function updateTreasuryVault(address)",
  "function fundEqualDistribution() payable",
  "function allowClaims()",
];


export const AAVE_V3_POOL_ABI_EXTENDED = [
  // Full getReserveData for reading liquidityIndex
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)",
];

export const ATOKEN_ABI = [
  "function scaledBalanceOf(address user) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
];

export const WETH_ABI = [
  "function deposit() payable",
  "function withdraw(uint256)",
  "function approve(address,uint256) returns (bool)",
];

export const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
