import { ethers } from "ethers";
import { config } from "./config";

// GoogleStockNFT ABI (for IRYS event listening)
const GOOGLE_STOCK_NFT_ABI = [
  "event NFTMinted(uint256 indexed tokenId, address indexed owner, uint256 ethAmount, uint256 googlPrice)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function setIrysTxId(uint256,string) external",
  "function mintPrincipal(uint256) view returns (uint256)",
  "function googlPriceAtMint(uint256) view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
];

let provider: ethers.JsonRpcProvider;
let wallet: ethers.Wallet;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) provider = new ethers.JsonRpcProvider(config.rpcUrl);
  return provider;
}

export function getWallet(): ethers.Wallet {
  if (!wallet) {
    if (!config.privateKey) throw new Error("PRIVATE_KEY not set in .env");
    wallet = new ethers.Wallet(config.privateKey, getProvider());
  }
  return wallet;
}

export function getGoogleStockNFT(): ethers.Contract {
  if (!config.contracts.googleStockNFT) throw new Error("GOOGLE_STOCK_NFT address not configured");
  return new ethers.Contract(config.contracts.googleStockNFT, GOOGLE_STOCK_NFT_ABI, getProvider());
}

export function getProviderOnly(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.rpcUrl);
}
