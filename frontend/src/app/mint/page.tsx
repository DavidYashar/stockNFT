"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { keccak256, encodePacked, type Address } from "viem";
import { NFT_ABI, PLATFORM_ABI, ERC20_ABI, FAUCET_ABI, ADDRESSES } from "@/lib/contracts";
import { MINT_PRICE, MINT_PHASE, TOKEN_DECIMALS } from "@/lib/constants";
import { formatUnits, parseUnits } from "ethers";

// ====================================================================
// Helpers
// ====================================================================

function getPhaseLabel(phase: number): string {
  switch (phase) {
    case MINT_PHASE.NONE:
      return "Not Started";
    case MINT_PHASE.WHITELIST:
      return "Whitelist";
    case MINT_PHASE.PUBLIC:
      return "Public";
    case MINT_PHASE.ENDED:
      return "Ended";
    default:
      return "Unknown";
  }
}

function getPhasePrice(phase: number): number {
  return phase === MINT_PHASE.WHITELIST ? MINT_PRICE.WHITELIST : MINT_PRICE.PUBLIC;
}

// ====================================================================
// Page Component
// ====================================================================

export default function MintPage() {
  const { address, isConnected } = useAccount();

  // ---- On-chain reads ----
  const { data: phase } = useReadContract({
    address: ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: "mintPhase",
    query: { refetchInterval: 5000 },
  });

  const { data: whitelistRoot } = useReadContract({
    address: ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: "whitelistRoot",
  });

  const { data: totalSupply } = useReadContract({
    address: ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: "totalSupply",
    query: { refetchInterval: 5000 },
  });

  const { data: usdgBalance } = useBalance({
    address,
    token: ADDRESSES.usdg,
    query: { refetchInterval: 5000 },
  });

  const { data: usdgAllowance } = useReadContract({
    address: ADDRESSES.usdg,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address as Address, ADDRESSES.nft],
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  // ---- Local state ----
  const [mintCount, setMintCount] = useState(1);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState("");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [mintHash, setMintHash] = useState<`0x${string}` | undefined>();

  const phaseNum: number = Number(phase ?? 0);
  const pricePer = getPhasePrice(phaseNum);
  const totalUSDG = pricePer * mintCount;
  const totalUSDGWei = parseUnits(String(totalUSDG), TOKEN_DECIMALS.USDG);

  // ---- Auto-generate Merkle proof (single-leaf tree for address) ----
  const proof: `0x${string}`[] = [];
  let isWhitelisted = false;
  if (address && whitelistRoot && whitelistRoot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    const leaf = keccak256(encodePacked(["address"], [address]));
    isWhitelisted = leaf === whitelistRoot;
    // For a single-leaf tree, the proof is empty (root == leaf hash)
    // The contract will verify keccak256(abi.encodePacked(account)) == root
  }

  // ---- Need approval? ----
  const needApproval =
    isConnected &&
    usdgAllowance !== undefined &&
    BigInt(usdgAllowance as any) < BigInt(totalUSDGWei);

  // ---- Write hooks ----
  const {
    writeContract: approveUSDG,
    data: approveData,
    isPending: approvePending,
  } = useWriteContract();

  const {
    writeContract: doMint,
    data: mintData,
    isPending: mintPending,
  } = useWriteContract();

  // ---- Receipt tracking ----
  const { isLoading: approveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveData || approveHash });

  const { isLoading: mintConfirming, isSuccess: mintSuccess } =
    useWaitForTransactionReceipt({ hash: mintData || mintHash });

  // ---- Faucet ----
  const faucet = useCallback(async () => {
    if (!address) return;
    setFaucetLoading(true);
    setFaucetMsg("");
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (res.ok) {
        setFaucetMsg(`Sent 1000 USDG! Tx: ${data.txHash?.slice(0, 10)}...`);
      } else {
        setFaucetMsg(data.error || "Faucet failed");
      }
    } catch (e: any) {
      setFaucetMsg(e.message || "Faucet error");
    }
    setFaucetLoading(false);
  }, [address]);

  // ---- Approve USDG ----
  const handleApprove = () => {
    approveUSDG({
      address: ADDRESSES.usdg,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.nft, totalUSDGWei],
    });
  };

  // ---- Mint ----
  const handleMint = () => {
    doMint({
      address: ADDRESSES.nft,
      abi: NFT_ABI,
      functionName: "mint",
      args: [address as Address, proof],
    });
  };

  // ---- Track hashes ----
  useEffect(() => {
    if (approveData) setApproveHash(approveData);
  }, [approveData]);
  useEffect(() => {
    if (mintData) setMintHash(mintData);
  }, [mintData]);

  // ====================================================================
  // Render
  // ====================================================================

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold mb-4">Google Stock NFT</h1>
        <p className="text-gray-400 mb-8">Connect your wallet to mint</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Mint Google Stock NFT</h1>

      {/* Phase banner */}
      <div className="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Phase:</span>
          <span
            className={`font-semibold ${
              phaseNum === MINT_PHASE.WHITELIST
                ? "text-yellow-400"
                : phaseNum === MINT_PHASE.PUBLIC
                ? "text-green-400"
                : phaseNum === MINT_PHASE.ENDED
                ? "text-red-400"
                : "text-gray-500"
            }`}
          >
            {getPhaseLabel(phaseNum)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-400">Price:</span>
          <span className="font-semibold text-white">
            {pricePer} USDG
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-400">Minted:</span>
          <span className="font-semibold text-white">
            {totalSupply?.toString() ?? "0"} NFTs
          </span>
        </div>
        {isWhitelisted && phaseNum === MINT_PHASE.WHITELIST && (
          <div className="mt-2 text-center text-yellow-400 text-sm font-semibold">
            ✅ You are whitelisted
          </div>
        )}
      </div>

      {/* Mint controls */}
      {phaseNum === MINT_PHASE.WHITELIST || phaseNum === MINT_PHASE.PUBLIC ? (
        <>
          {/* Quantity selector */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Quantity</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMintCount(Math.max(1, mintCount - 1))}
                className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={10}
                value={mintCount}
                onChange={(e) =>
                  setMintCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                }
                className="w-20 text-center py-2 bg-gray-800 border border-gray-600 rounded text-white"
              />
              <button
                onClick={() => setMintCount(Math.min(10, mintCount + 1))}
                className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                +
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="mb-6 p-4 rounded-lg bg-gray-800 border border-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Total:</span>
              <span className="font-bold text-white text-lg">
                {totalUSDG} USDG
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-400">Your USDG:</span>
              <span className="text-gray-300">
                {usdgBalance ? formatUnits(usdgBalance.value, TOKEN_DECIMALS.USDG) : "0"}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            {needApproval ? (
              <button
                onClick={handleApprove}
                disabled={approvePending || approveConfirming}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold text-white transition"
              >
                {approvePending || approveConfirming
                  ? "Approving USDG..."
                  : `Approve ${totalUSDG} USDG`}
              </button>
            ) : (
              <button
                onClick={handleMint}
                disabled={mintPending || mintConfirming || (phaseNum as number) === MINT_PHASE.ENDED}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold text-white transition"
              >
                {mintPending || mintConfirming
                  ? "Minting..."
                  : `Mint ${mintCount} NFT${mintCount > 1 ? "s" : ""}`}
              </button>
            )}
          </div>

          {/* Faucet (testnet) */}
          <div className="mt-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-sm text-gray-400 mb-2">
              Need testnet USDG? Get 1,000 from the faucet.
            </p>
            <button
              onClick={faucet}
              disabled={faucetLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg text-sm font-semibold transition"
            >
              {faucetLoading ? "Sending..." : "Get Testnet USDG"}
            </button>
            {faucetMsg && (
              <p className="mt-2 text-xs text-gray-300">{faucetMsg}</p>
            )}
          </div>

          {/* Status messages */}
          {approveSuccess && (
            <div className="p-3 bg-blue-900/30 border border-blue-700 rounded text-blue-300 text-sm">
              ✅ USDG approved! You can now mint.
            </div>
          )}
          {mintSuccess && (
            <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
              🎉 NFT{ mintCount > 1 ? "s" : "" } minted successfully! Check your portfolio.
            </div>
          )}
        </>
      ) : phaseNum === MINT_PHASE.ENDED ? (
        <div className="text-center py-8">
          <p className="text-xl text-gray-400">Mint has ended</p>
          <p className="text-sm text-gray-500 mt-2">
            {totalSupply?.toString() ?? "0"} NFTs minted total
          </p>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-xl text-gray-400">Mint not yet started</p>
          <p className="text-sm text-gray-500 mt-2">Check back soon</p>
        </div>
      )}
    </div>
  );
}
