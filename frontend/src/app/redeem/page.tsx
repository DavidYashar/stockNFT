"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { type Address, formatUnits, parseUnits } from "viem";
import { NFT_ABI, STOCK_ABI, ERC20_ABI, ADDRESSES } from "@/lib/contracts";
import { TOKEN_DECIMALS } from "@/lib/constants";

// ====================================================================
// Redeem Page — Claim GOOGL from your NFT's TBA
// ====================================================================

export default function RedeemPage() {
  const { address, isConnected } = useAccount();

  // ---- Get user's NFT count ----
  const { data: balance } = useReadContract({
    address: ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: "balanceOf",
    args: [address as Address],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const balanceNum = balance ? Number(balance) : 0;

  // ---- Get all owned token IDs ----
  const tokenIds: number[] = [];
  for (let i = 0; i < balanceNum; i++) {
    tokenIds.push(i);
  }

  // ---- Local state ----
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [mode, setMode] = useState<"claim" | "swap">("claim");
  const [swapAmount, setSwapAmount] = useState("");
  const [status, setStatus] = useState("");

  // ---- Selected NFT info ----
  const { data: tba } = useReadContract({
    address: ADDRESSES.stock,
    abi: STOCK_ABI,
    functionName: "tbaForToken",
    args: [selectedTokenId ? BigInt(selectedTokenId) : 0n],
    query: { enabled: selectedTokenId !== null },
  });

  const { data: googlBalance } = useBalance({
    address: (tba as Address) ?? undefined,
    token: ADDRESSES.googl,
    query: { enabled: !!tba && tba !== "0x0000000000000000000000000000000000000000" },
  });

  const { data: googlPerNFT } = useReadContract({
    address: ADDRESSES.stock,
    abi: STOCK_ABI,
    functionName: "googlPerNFT",
  });

  // ---- Write hooks ----
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess: done } = useWaitForTransactionReceipt({ hash: txHash });

  // ---- Actions ----
  const handleClaimGOOGL = () => {
    if (selectedTokenId === null) return;
    writeContract({
      address: ADDRESSES.stock,
      abi: STOCK_ABI,
      functionName: "claimGOOGL",
      args: [BigInt(selectedTokenId)],
    });
    setStatus(`Claiming GOOGL for NFT #${selectedTokenId}...`);
  };

  const handleSwap = () => {
    if (!swapAmount) return;
    writeContract({
      address: ADDRESSES.stock,
      abi: STOCK_ABI,
      functionName: "purchaseViaUniswap",
      args: [ADDRESSES.usdg, parseUnits(swapAmount, TOKEN_DECIMALS.USDG), 0n],
    });
    setStatus(`Swapping ${swapAmount} USDG for GOOGL...`);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold mb-4">Redeem GOOGL</h1>
        <p className="text-gray-400">Connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Redeem GOOGL</h1>
      <p className="text-gray-400 mb-8">
        Claim your GOOGL tokens from your NFT or swap USDG for GOOGL
      </p>

      {/* NFT Selector */}
      {balanceNum > 0 ? (
        <>
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Select NFT</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: balanceNum }, (_, i) => i).map((idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTokenId(idx)}
                  className={`px-4 py-2 rounded font-semibold text-sm transition ${
                    selectedTokenId === idx
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  NFT #{idx}
                </button>
              ))}
            </div>
          </div>

          {/* TBA Info */}
          {selectedTokenId !== null && tba && (tba as string) !== "0x0000000000000000000000000000000000000000" && (
            <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 mb-6">
              <h3 className="font-semibold mb-2">NFT #{selectedTokenId}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">TBA:</span>
                  <span className="font-mono text-xs text-gray-500">
                    {(tba as string).slice(0, 8)}...{(tba as string).slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">GOOGL in TBA:</span>
                  <span className="text-blue-400">
                    {googlBalance ? formatUnits(googlBalance.value, TOKEN_DECIMALS.GOOGL) : "0"} GOOGL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">GOOGL per NFT (target):</span>
                  <span className="text-white">
                    {googlPerNFT ? formatUnits(googlPerNFT as bigint, TOKEN_DECIMALS.GOOGL) : "..."} GOOGL
                  </span>
                </div>
              </div>

              <button
                onClick={handleClaimGOOGL}
                disabled={isPending || confirming}
                className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-semibold text-sm transition"
              >
                {isPending || confirming ? "Claiming..." : "Claim GOOGL from TBA"}
              </button>
            </div>
          )}

          {/* Swap USDG for GOOGL */}
          <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 mb-6">
            <h3 className="font-semibold mb-3">Swap USDG → GOOGL</h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                placeholder="USDG amount"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
              />
              <button
                onClick={handleSwap}
                disabled={isPending || confirming || !swapAmount}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-semibold text-sm transition"
              >
                {isPending || confirming ? "Swapping..." : "Swap"}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Swaps USDG for GOOGL via Uniswap V3 on-chain
            </p>
          </div>

          {/* Status */}
          {status && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300">
              {status}
            </div>
          )}
          {done && (
            <div className="mt-2 p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
              ✅ Transaction confirmed!
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">You don't own any NFTs yet.</p>
          <a
            href="/mint"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition"
          >
            Go Mint
          </a>
        </div>
      )}
    </div>
  );
}
