/**
 * IRYS Metadata Service
 *
 * Uploads NFT metadata to IRYS devnet (Arweave) and stores txId on-chain.
 * Generates self-contained PNG certificates via sharp (no external refs — works everywhere).
 * Uses polling to detect new mints/transfers.
 */

import { ethers } from "ethers";
import { config } from "../config";
import { getProviderOnly, getWallet } from "../contracts";
import { resolve } from "path";
import sharp from "sharp";

import { getETHPrice } from "./eth-price";

// Template PNG path (loaded at generation time, not embedded in source)
const TEMPLATE_PATH = resolve(__dirname, "../../../frontend/public/certificate-template.png");

let lastCheckedBlock = 0;

// ----- IRYS Upload (network-aware: devnet or mainnet) -----
async function getIrys() {
  const { Uploader } = await import("@irys/upload");
  const { Ethereum } = await import("@irys/upload-ethereum");
  const irys = Uploader(Ethereum)
    .withWallet(config.irys.privateKey || config.privateKey)
    .withRpc(config.irys.rpcUrl);
  return config.irys.network === "mainnet" ? irys : irys.devnet();
}

function irysUrl(txId: string): string {
  return `${config.irysGateway}/${txId}`;
}

async function fundIrysIfNeeded(irys: Awaited<ReturnType<typeof getIrys>>) {
  try {
    const bal = await irys.getBalance();
    const minBal = irys.utils.toAtomic(config.irys.minBalance);
    if (bal < minBal) {
      console.log(`  💰 IRYS balance low (${irys.utils.fromAtomic(bal)}), funding ${config.irys.fundAmount} ${irys.token}...`);
      const fundTx = await irys.fund(irys.utils.toAtomic(config.irys.fundAmount), config.irys.fundMultiplier);
      console.log(`  ✅ IRYS funded: ${irys.utils.fromAtomic(fundTx.quantity)} ${irys.token}`);
    }
  } catch (err: any) {
    console.error(`  ⚠️ IRYS fund check failed: ${err.message?.slice(0, 100)}`);
  }
}

async function uploadToIrys(data: string | Buffer, tags?: { name: string; value: string }[]): Promise<string> {
  try {
    const irys = await getIrys();
    await fundIrysIfNeeded(irys);
    const receipt = await irys.upload(data, { tags });
    console.log(`  ✅ IRYS: ${irysUrl(receipt.id)}`);
    return receipt.id;
  } catch (err: any) {
    console.error(`  ⚠️ IRYS upload failed: ${err.message?.slice(0, 100)}`);
    return "";
  }
}

// ----- Certificate PNG Generator (Sharp — self-contained, no external refs) -----
// Composites text onto the template PNG using sharp.
// Produces a flat PNG that works in <img> tags, wallets, marketplaces — everywhere.
// Layout coordinates: config.certificate (shared with frontend/src/lib/constants.ts)

const CERT = config.certificate;

async function generateCertificatePNG(params: {
  tokenId: string;
  owner: string;
  shares: string;
  valueUSDC: string;
  issueDate: string;
  network: string;
  googlPrice: string;
}): Promise<Buffer> {
  // Build an SVG overlay with just the text elements (transparent background)
  const textOverlay = `<svg width="${CERT.width}" height="${CERT.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${CERT.valueX}" y="${CERT.fieldY.certificateNo}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">#${params.tokenId}</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.owner}" font-family="Courier New,monospace" font-size="22" fill="#334155" font-weight="bold">${params.owner}</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.share}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">${params.shares}</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.value}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">$${params.valueUSDC}</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.issueDate}" font-family="Courier New,monospace" font-size="22" fill="#334155" font-weight="bold">${params.issueDate}</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.network}" font-family="Courier New,monospace" font-size="22" fill="#334155" font-weight="bold">${params.network}</text>
    <text x="${CERT.valueX}" y="${CERT.fieldY.googlPrice}" font-family="Georgia,serif" font-size="28" fill="#1e293b" font-weight="bold">$${params.googlPrice}</text>
  </svg>`;

  // Composite: template PNG + text overlay → self-contained PNG
  return sharp(TEMPLATE_PATH)
    .composite([{ input: Buffer.from(textOverlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

// ----- Event Handlers -----

async function handleNFTMinted(tokenId: bigint, owner: string, ethAmount: bigint, googlPrice: bigint) {
  console.log(`\n[NFTMinted] Token #${tokenId} → ${owner}`);
  console.log(`  ETH: ${ethers.formatEther(ethAmount)} | GOOGL: ${ethers.formatUnits(googlPrice, 8)}`);

  const ethNum = Number(ethers.formatEther(ethAmount));
  const googlNum = Number(ethers.formatUnits(googlPrice, 8));
  const ethPriceUsd = await getETHPrice();
  const dollarValue = ethNum * ethPriceUsd;
  const shares = (dollarValue / googlNum).toFixed(6);
  const now = new Date();

  // Generate self-contained PNG certificate (sharp — no external refs)
  const png = await generateCertificatePNG({
    tokenId: tokenId.toString(),
    owner,
    shares,
    valueUSDC: dollarValue.toFixed(2),
    issueDate: now.toISOString().split("T")[0],
    network: "Ethereum Mainnet",
    googlPrice: googlNum.toFixed(2),
  });

  // Upload certificate PNG to IRYS
  const certTxId = await uploadToIrys(png, [
    { name: "Content-Type", value: "image/png" },
    { name: "App-Name", value: "GoogleStockNFT" },
  ]);

  const imageUrl = certTxId ? irysUrl(certTxId) : "";

  const metadata = {
    name: `Google Stock NFT #${tokenId}`,
    description: "On-chain certificate representing fractional ownership of Alphabet Class A (GOOGL) via Ondo Finance GOOGLon",
    image: imageUrl,
    attributes: [
      { trait_type: "Google Shares (GOOGLon)", value: Number(shares) },
      { trait_type: "ETH Paid at Mint", value: ethNum },
      { trait_type: "GOOGL Price at Mint (USD)", value: googlNum },
      { trait_type: "Mint Date", value: now.toISOString() },
      { trait_type: "Current Owner", value: owner },
    ],
  }; 

  const txId = await uploadToIrys(JSON.stringify(metadata), [
    { name: "Content-Type", value: "application/json" },
    { name: "App-Name", value: "GoogleStockNFT" },
  ]);

  if (txId) {
    const nft = new ethers.Contract(config.contracts.googleStockNFT, ["function setIrysTxId(uint256,string)"], getWallet());
    try {
      const tx = await nft.setIrysTxId(tokenId, txId);
      await tx.wait();
      console.log(`  ✅ On-chain txId set: ${txId}`);
    } catch (err: any) {
      console.error(`  ❌ setIrysTxId failed: ${err.message?.slice(0, 100)}`);
    }
  }
}

async function handleTransfer(from: string, to: string, tokenId: bigint) {
  console.log(`\n[Transfer] Token #${tokenId}: ${from.slice(0, 8)}... → ${to.slice(0, 8)}...`);

  const provider = getProviderOnly();
  const nftData = new ethers.Contract(config.contracts.googleStockNFT, [
    "function mintPrincipal(uint256) view returns (uint256)",
    "function googlPriceAtMint(uint256) view returns (uint256)",
  ], provider);

  try {
    const principal = await nftData.mintPrincipal(tokenId);
    const googlPrice = await nftData.googlPriceAtMint(tokenId);
    const ethNum = Number(ethers.formatEther(principal));
    const googlNum = Number(ethers.formatUnits(googlPrice, 8));
    const ethPriceUsd = await getETHPrice();
    const dollarValue = ethNum * ethPriceUsd;
    const shares = (dollarValue / googlNum).toFixed(6);

    // Generate self-contained PNG certificate for the NEW owner
    const png = await generateCertificatePNG({
      tokenId: tokenId.toString(),
      owner: to,
      shares,
      valueUSDC: dollarValue.toFixed(2),
      issueDate: new Date().toISOString().split("T")[0],
      network: "Ethereum Mainnet",
      googlPrice: googlNum.toFixed(2),
    });

    const certTxId = await uploadToIrys(png, [
      { name: "Content-Type", value: "image/png" },
      { name: "App-Name", value: "GoogleStockNFT" },
    ]);

    const imageUrl = certTxId ? irysUrl(certTxId) : "";
    const metadata = {
      name: `Google Stock NFT #${tokenId}`,
      description: "On-chain certificate representing fractional ownership of Alphabet Class A (GOOGL) via Ondo Finance GOOGLon",
      image: imageUrl,
      attributes: [
        { trait_type: "Google Shares (GOOGLon)", value: Number(shares) },
        { trait_type: "ETH Paid at Mint", value: ethNum },
        { trait_type: "GOOGL Price at Mint (USD)", value: googlNum },
        { trait_type: "Current Owner", value: to },
      ],
    };

    const txId = await uploadToIrys(JSON.stringify(metadata), [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "GoogleStockNFT" },
    ]);

    if (txId) {
      const nft = new ethers.Contract(config.contracts.googleStockNFT, ["function setIrysTxId(uint256,string)"], getWallet());
      const tx = await nft.setIrysTxId(tokenId, txId);
      await tx.wait();
      console.log(`  ✅ Metadata updated for new owner`);
    }
  } catch (err: any) {
    console.error(`  ❌ Transfer metadata update failed: ${err.message?.slice(0, 100)}`);
  }
}

// ----- Polling-based Event Detection -----

async function pollEvents() {
  const provider = getProviderOnly();
  const nftAddr = config.contracts.googleStockNFT;
  if (!nftAddr) return;

  try {
    const nft = new ethers.Contract(nftAddr, [
      "event NFTMinted(uint256 indexed tokenId, address indexed owner, uint256 ethAmount, uint256 googlPrice)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    ], provider);
    const currentBlock = await provider.getBlockNumber();
    // First run: look back far enough to catch recent mints (5000 blocks ≈ 16h on mainnet)
    if (lastCheckedBlock === 0) lastCheckedBlock = currentBlock - 5000;
    if (currentBlock <= lastCheckedBlock) return;

    const mintFilter = nft.filters.NFTMinted;
    const mintEvents = await nft.queryFilter(mintFilter, lastCheckedBlock + 1, currentBlock);
    for (const ev of mintEvents) {
      const e = ev as ethers.EventLog;
      await handleNFTMinted(e.args[0], e.args[1], e.args[2], e.args[3]);
    }

    const transferFilter = nft.filters.Transfer;
    const transferEvents = await nft.queryFilter(transferFilter, lastCheckedBlock + 1, currentBlock);
    for (const ev of transferEvents) {
      const e = ev as ethers.EventLog;
      // ERC-721 Transfer: from, to, tokenId (all indexed)
      const from = e.args[0], to = e.args[1], id = e.args[2];
      if (from !== ethers.ZeroAddress && to !== ethers.ZeroAddress) {
        await handleTransfer(from, to, id);
      }
    }

    lastCheckedBlock = currentBlock;
  } catch (err: any) {
    console.log(`  ⚠️ Poll error: ${err.message?.slice(0, 80)}`);
  }
}

async function start() {
  console.log("IRYS Metadata Service — polling every 30s, storing metadata on-chain");

  // Skip if contracts haven't been deployed yet
  if (!config.contracts.googleStockNFT) {
    console.log("  ⏸️  IRYS service paused — GOOGLE_STOCK_NFT address not configured");
    return;
  }
  
  // One-time catchup: generate metadata for any token that lacks it
  await catchupMissingMetadata();
  
  pollEvents();
  setInterval(pollEvents, 30_000);
}

async function catchupMissingMetadata() {
  try {
    const provider = getProviderOnly();
    const nft = new ethers.Contract(config.contracts.googleStockNFT, [
      "function totalSupply() view returns (uint256)",
      "function tokenByIndex(uint256) view returns (uint256)",
      "function ownerOf(uint256) view returns (address)",
      "function mintPrincipal(uint256) view returns (uint256)",
      "function googlPriceAtMint(uint256) view returns (uint256)",
      "function irysTxId(uint256) view returns (string)",
    ], provider);
    
    const totalSupply = Number(await nft.totalSupply());
    console.log(`  📋 Catchup: ${totalSupply} tokens exist`);
    
    for (let i = 0; i < totalSupply; i++) {
      let tokenId: number;
      try {
        tokenId = Number(await nft.tokenByIndex(i));
      } catch { continue; }
      try {
        const existingTxId = await nft.irysTxId(tokenId);
        if (existingTxId) continue; // Already has metadata
        
        const owner = await nft.ownerOf(tokenId);
        const principal = await nft.mintPrincipal(tokenId);
        const googlPrice = await nft.googlPriceAtMint(tokenId);
        
        if (principal === 0n) continue;
        
        console.log(`  🔄 Generating missing metadata for token #${tokenId}...`);
        await handleNFTMinted(BigInt(tokenId), owner, principal, googlPrice);
      } catch (tokenErr: any) {
        console.log(`  ⚠️ Token #${tokenId} catchup failed: ${tokenErr.message?.slice(0, 80)}`);
      }
    }
    console.log(`  ✅ Catchup complete`);
    
    // Prevent poll from re-processing tokens already handled by catchup
    lastCheckedBlock = await provider.getBlockNumber();
  } catch (err: any) {
    console.log(`  ⚠️ Catchup error: ${err.message?.slice(0, 80)}`);
  }
}

start();
