"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { keccak256, encodePacked, type Address } from "viem";
import { PLATFORM_ABI, NFT_ABI, ERC20_ABI, ADDRESSES } from "@/lib/contracts";
import { MINT_PHASE } from "@/lib/constants";

// ====================================================================
// Admin Page — PlatformManager owner operations
// ====================================================================

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  const { data: owner } = useReadContract({
    address: ADDRESSES.platform,
    abi: PLATFORM_ABI,
    functionName: "owner",
  });

  const { data: phase } = useReadContract({
    address: ADDRESSES.platform,
    abi: PLATFORM_ABI,
    functionName: "mintPhase",
    query: { refetchInterval: 3000 },
  });

  const { data: whitelistRoot } = useReadContract({
    address: ADDRESSES.platform,
    abi: PLATFORM_ABI,
    functionName: "whitelistRoot",
  });

  const { data: totalSupply } = useReadContract({
    address: ADDRESSES.nft,
    abi: NFT_ABI,
    functionName: "totalSupply",
    query: { refetchInterval: 3000 },
  });

  const isOwner = isConnected && address && owner && address.toLowerCase() === (owner as string).toLowerCase();

  // ---- Write hooks ----
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess: done } = useWaitForTransactionReceipt({ hash: txHash });

  // ---- Local state ----
  const [wlAddresses, setWlAddresses] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  // ---- Actions ----
  const setPhase = (p: number) => {
    writeContract({
      address: ADDRESSES.platform,
      abi: PLATFORM_ABI,
      functionName: "setPhase",
      args: [p],
    });
    setStatusMsg(`Setting phase to ${p}...`);
  };

  const setWhitelist = () => {
    const addrs = wlAddresses
      .split(/[\n,]+/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (addrs.length === 0) {
      setStatusMsg("Enter at least one address");
      return;
    }
    // Build Merkle root: single-leaf tree has root = keccak256(address)
    // For multi-address, we'd need a proper tree builder; for now, single address
    if (addrs.length === 1) {
      const leaf = keccak256(encodePacked(["address"], [addrs[0] as Address]));
      writeContract({
        address: ADDRESSES.platform,
        abi: PLATFORM_ABI,
        functionName: "setWhitelistRoot",
        args: [leaf],
      });
      setStatusMsg("Setting single-address whitelist...");
    } else {
      setStatusMsg("Multi-address Merkle tree not yet supported in admin UI");
    }
  };

  const triggerEnd = () => {
    writeContract({
      address: ADDRESSES.platform,
      abi: PLATFORM_ABI,
      functionName: "triggerMintEnd",
    });
    setStatusMsg("Triggering mint end...");
  };

  const togglePause = () => {
    writeContract({
      address: ADDRESSES.platform,
      abi: PLATFORM_ABI,
      functionName: "pause",
    });
    setStatusMsg("Pausing...");
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
        <p className="text-gray-400">Connect wallet to continue</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
        <p className="text-red-400">Access denied — not the contract owner</p>
        <p className="text-gray-500 text-sm mt-2">
          Your: {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
        <p className="text-gray-500 text-sm">
          Owner: {typeof owner === "string" ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : "..."}
        </p>
      </div>
    );
  }

  const phaseNum = Number(phase ?? 0);
  const phaseNames = ["NONE", "WHITELIST", "PUBLIC", "ENDED"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

      {/* Status */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold mb-3">Contract Status</h2>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Phase:</span>
            <span className="font-semibold text-white">{phaseNames[phaseNum] ?? phaseNum}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Minted:</span>
            <span className="font-semibold text-white">{totalSupply?.toString() ?? "0"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Whitelist Root:</span>
            <span className="font-mono text-xs text-gray-500">
              {typeof whitelistRoot === "string" ? `${whitelistRoot.slice(0, 10)}...` : "not set"}
            </span>
          </div>
        </div>
      </div>

      {/* Phase Controls */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold mb-3">Phase Management</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "None", value: MINT_PHASE.NONE, color: "bg-gray-600 hover:bg-gray-500" },
            { label: "Whitelist", value: MINT_PHASE.WHITELIST, color: "bg-yellow-600 hover:bg-yellow-500" },
            { label: "Public", value: MINT_PHASE.PUBLIC, color: "bg-green-600 hover:bg-green-500" },
            { label: "Ended", value: MINT_PHASE.ENDED, color: "bg-red-600 hover:bg-red-500" },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPhase(p.value)}
              disabled={isPending || confirming || phaseNum === p.value}
              className={`px-4 py-2 ${p.color} disabled:opacity-50 disabled:cursor-not-allowed rounded font-semibold text-sm transition`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button
            onClick={triggerEnd}
            disabled={isPending || confirming || phaseNum === MINT_PHASE.ENDED}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded font-semibold text-sm transition"
          >
            Trigger Mint End
          </button>
        </div>
      </div>

      {/* Whitelist */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold mb-3">Whitelist</h2>
        <textarea
          value={wlAddresses}
          onChange={(e) => setWlAddresses(e.target.value)}
          placeholder="Enter addresses (one per line or comma-separated)"
          rows={4}
          className="w-full p-3 bg-gray-900 border border-gray-600 rounded text-white text-sm font-mono"
        />
        <button
          onClick={setWhitelist}
          disabled={isPending || confirming}
          className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded font-semibold text-sm transition"
        >
          Set Whitelist Root
        </button>
      </div>

      {/* Emergency */}
      <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold mb-3 text-red-400">Emergency</h2>
        <button
          onClick={togglePause}
          disabled={isPending || confirming}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded font-semibold text-sm transition"
        >
          Pause Contracts
        </button>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="p-3 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300">
          {statusMsg}
        </div>
      )}
      {done && (
        <div className="mt-2 p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
          ✅ Transaction confirmed
        </div>
      )}
      {(isPending || confirming) && (
        <div className="mt-2 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-sm">
          ⏳ {isPending ? "Waiting for wallet..." : "Confirming on chain..."}
        </div>
      )}
    </div>
  );
}
