"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { type Address, formatUnits } from "viem";
import { NFT_ABI, STOCK_ABI, DIAMOND_HANDS_ABI, ERC20_ABI, ADDRESSES } from "@/lib/contracts";
import { TOKEN_DECIMALS } from "@/lib/constants";

// Helper to cast const ABIs for wagmi compatibility
const nftAbi = NFT_ABI as any;
const stockAbi = STOCK_ABI as any;
const diamondHandsAbi = DIAMOND_HANDS_ABI as any;

// ====================================================================
// NFT Info type
// ====================================================================

interface NFTInfo {
  tokenId: bigint;
  usdgPaid?: bigint;
  ourTokenClaimed?: bigint;
  googlClaimed?: bigint;
  soulbound?: boolean;
  tba?: Address;
  diamondClaimable?: bigint;
}

// ====================================================================
// Single NFT Card
// ====================================================================

function NFTCard({
  nft,
  onRefresh,
}: {
  nft: NFTInfo;
  onRefresh: () => void;
}) {
  const { address } = useAccount();
  const [claimMode, setClaimMode] = useState<"ourToken" | "googl" | "diamond" | null>(null);

  const {
    writeContract,
    data: txHash,
    isPending,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess: done } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleClaim = (mode: "ourToken" | "googl" | "diamond") => {
    setClaimMode(mode);
    if (mode === "ourToken") {
      writeContract({
        address: ADDRESSES.stock,
        abi: stockAbi,
        functionName: "claimOurToken",
        args: [nft.tokenId],
      });
    } else if (mode === "googl") {
      writeContract({
        address: ADDRESSES.stock,
        abi: stockAbi,
        functionName: "claimGOOGL",
        args: [nft.tokenId],
      });
    } else if (mode === "diamond") {
      writeContract({
        address: ADDRESSES.diamondHands,
        abi: diamondHandsAbi,
        functionName: "claim",
        args: [nft.tokenId],
      });
    }
  };

  // Reset after success
  if (done && claimMode) {
    setTimeout(onRefresh, 1000);
  }

  return (
    <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-white text-lg">NFT #{nft.tokenId.toString()}</h3>
        {nft.soulbound && (
          <span className="text-xs px-2 py-1 bg-purple-900/40 text-purple-300 rounded">
            Soulbound
          </span>
        )}
      </div>

      {/* TBA */}
      {nft.tba && nft.tba !== "0x0000000000000000000000000000000000000000" && (
        <div className="mb-3 text-xs text-gray-400">
          <span>TBA: </span>
          <span className="font-mono text-gray-500">
            {nft.tba.slice(0, 6)}...{nft.tba.slice(-4)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-1 text-sm mb-4">
        {nft.usdgPaid !== undefined && nft.usdgPaid > 0n && (
          <div className="flex justify-between">
            <span className="text-gray-400">USDG Paid:</span>
            <span className="text-white">
              {formatUnits(nft.usdgPaid, TOKEN_DECIMALS.USDG)} USDG
            </span>
          </div>
        )}
        {nft.ourTokenClaimed !== undefined && nft.ourTokenClaimed > 0n && (
          <div className="flex justify-between">
            <span className="text-gray-400">$G-Pass Claimed:</span>
            <span className="text-green-400">
              {formatUnits(nft.ourTokenClaimed, TOKEN_DECIMALS.OUR_TOKEN)}
            </span>
          </div>
        )}
        {nft.googlClaimed !== undefined && nft.googlClaimed > 0n && (
          <div className="flex justify-between">
            <span className="text-gray-400">GOOGL Claimed:</span>
            <span className="text-blue-400">
              {formatUnits(nft.googlClaimed, TOKEN_DECIMALS.GOOGL)}
            </span>
          </div>
        )}
        {nft.diamondClaimable !== undefined && nft.diamondClaimable > 0n && (
          <div className="flex justify-between">
            <span className="text-gray-400">💎 Rewards:</span>
            <span className="text-yellow-400">
              {formatUnits(nft.diamondClaimable, TOKEN_DECIMALS.OUR_TOKEN)} $G-Pass
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleClaim("ourToken")}
          disabled={isPending || confirming}
          className="flex-1 px-3 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded text-sm font-semibold transition"
        >
          {claimMode === "ourToken" && isPending
            ? "Claiming..."
            : claimMode === "ourToken" && confirming
            ? "Confirming..."
            : "Claim $G-Pass"}
        </button>

        <button
          onClick={() => handleClaim("googl")}
          disabled={isPending || confirming}
          className="flex-1 px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 rounded text-sm font-semibold transition"
        >
          {claimMode === "googl" && isPending
            ? "Claiming..."
            : claimMode === "googl" && confirming
            ? "Confirming..."
            : "Claim GOOGL"}
        </button>

        {nft.diamondClaimable !== undefined && nft.diamondClaimable > 0n && (
          <button
            onClick={() => handleClaim("diamond")}
            disabled={isPending || confirming}
            className="flex-1 px-3 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-600 rounded text-sm font-semibold transition"
          >
            {claimMode === "diamond" && isPending
              ? "Claiming..."
              : claimMode === "diamond" && confirming
              ? "Confirming..."
              : "Claim 💎"}
          </button>
        )}
      </div>

      {done && (
        <p className="mt-2 text-xs text-green-400">✅ Success!</p>
      )}
    </div>
  );
}

// ====================================================================
// Dashboard Page
// ====================================================================

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  // ---- Get user's NFT balance ----
  const { data: balance } = useReadContract({
    address: ADDRESSES.nft,
    abi: nftAbi,
    functionName: "balanceOf",
    args: [address as Address],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const balanceNum = balance ? Number(balance) : 0;

  // ---- Build token IDs array ----
  const tokenIds = Array.from({ length: balanceNum }, (_, i) => i);

  // ---- Read token IDs owned by user ----
  const { data: ownedIds } = useReadContracts({
    contracts: tokenIds.map((i) => ({
      address: ADDRESSES.nft,
      abi: nftAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [address as Address, BigInt(i)],
    })),
    query: { enabled: !!address && balanceNum > 0 },
  });

  const nftIds: bigint[] =
    ownedIds?.map((r) => (r.result as bigint) ?? 0n).filter((id) => id !== 0n) ?? [];

  // ---- Read TBA for each NFT ----
  const { data: tbas } = useReadContracts({
    contracts: nftIds.map((id) => ({
      address: ADDRESSES.stock,
      abi: stockAbi,
      functionName: "tbaForToken",
      args: [id],
    })),
    query: { enabled: nftIds.length > 0 },
  });

  // ---- Build NFT info list ----
  const nfts: NFTInfo[] = nftIds.map((id, idx) => ({
    tokenId: id,
    tba: (tbas?.[idx]?.result as Address) ?? "0x0000000000000000000000000000000000000000",
    soulbound: true, // Default — NFTs are soulbound while mint is active
  }));

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold mb-4">My Portfolio</h1>
        <p className="text-gray-400">Connect your wallet to view your NFTs</p>
      </div>
    );
  }

  if (balanceNum === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold mb-4">My Portfolio</h1>
        <p className="text-gray-400 mb-4">You don't own any Google Stock NFTs yet.</p>
        <a
          href="/mint"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition"
        >
          Go Mint
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Portfolio</h1>
        <span className="text-gray-400">
          {balanceNum} NFT{balanceNum !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nfts.map((nft) => (
          <NFTCard key={nft.tokenId.toString()} nft={nft} onRefresh={refresh} />
        ))}
      </div>
    </div>
  );
}
