"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAccount, useWriteContract, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { ethers } from "ethers";
import { Toaster, toast } from "sonner";

// ─── Types ───
interface PortfolioNFT {
  id: string;
  tokenId: number;
  symbol: string;
  shares: number;
  date: string;
  value: string;
  imageUrl: string;
  tbaAddress: string;
  pileStatus: "Not Distributed" | "Distributed" | "Claimed" | "Withdrew";
  googlStatus: "Not Distributed" | "Distributed" | "Claimed" | "Withdrew";
  pileClaimed: boolean;
  googlClaimed: boolean;
}

// ─── Constants ───
const TABS = [
  { id: "mint", label: "Mint", icon: "add_circle", badge: "New" },
  { id: "portfolio", label: "Portfolio", icon: "account_balance_wallet" },
  { id: "whitelist", label: "Whitelist", icon: "checklist" },
  { id: "admin", label: "Admin", icon: "admin_panel_settings" },
];

const TIER_PRICES: Record<string, number> = { whitelist: 4, public: 6 };

const STOCK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  GOOGL: { bg: "rgba(66,133,244,0.12)", border: "rgba(66,133,244,0.3)", text: "#4285F4" },
  AAPL: { bg: "rgba(160,160,160,0.12)", border: "rgba(160,160,160,0.3)", text: "#A0A0A0" },
  TSLA: { bg: "rgba(224,64,64,0.12)", border: "rgba(224,64,64,0.3)", text: "#E04040" },
  MSFT: { bg: "rgba(0,163,96,0.12)", border: "rgba(0,163,96,0.3)", text: "#00A360" },
};

// ─── Page Component ───

/** Custom wallet button — replaces RainbowKit ConnectButton.
 *  Uses RainbowKit's modal but renders our own DOM, so it always shows. */
function WalletButton() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <button className="btn-wallet-connect connected" onClick={() => disconnect()} title="Click to disconnect">
        <span className="wallet-dot" />
        {short}
      </button>
    );
  }

  return (
    <button className="btn-wallet-connect" onClick={openConnectModal}>
      Connect Wallet
    </button>
  );
}

export default function AppPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState("whitelist");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ── Mint state ──
  const [quantity, setQuantity] = useState(1);
  const [activeTier, setActiveTier] = useState<"whitelist" | "public">("public");
  const [tierLabel, setTierLabel] = useState("Connect wallet to see your tier");
  const [tierLabelColor, setTierLabelColor] = useState("var(--text-muted)");
  const [googlePrice, setGooglePrice] = useState("198.45");
  const [googleChange, setGoogleChange] = useState({ text: "▲ 2.34 (1.19%)", cls: "up" });

  // ── Portfolio state ──
  const [selectedNFT, setSelectedNFT] = useState<PortfolioNFT | null>(null);
  const [userNFTs, setUserNFTs] = useState<PortfolioNFT[]>([]);
  const [portfolioRefresh, setPortfolioRefresh] = useState(0);
  const [adminRefresh, setAdminRefresh] = useState(0);

  // ── Ethers providers (direct — bypasses wagmi chain issues) ──
  const RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC || "https://rpc.testnet.chain.robinhood.com";
  const readProvider = useRef(new ethers.JsonRpcProvider(RPC_URL));
  const NFT_ADDR = process.env.NEXT_PUBLIC_NFT_ADDRESS || "0xD50936Ac0E7f5Eb72FaEF0B88E90a99C0ade3358";
  const USDG_ADDR = process.env.NEXT_PUBLIC_USDG_ADDRESS || "0xcD3246a7E37eDFBd29113EB84c997D5859Fc2677";
  const TV_ADDR = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "0x533aAF9AdA77423b889026250af3463C31C7076b";  // V3: TreasuryVault
  const PM_ADDR = process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || "0x0301E19FBc01fB7933859866aC0155BfC604589A";

  const pmContract = useRef(new ethers.Contract(PM_ADDR, [
    "function mintPhase() view returns (uint8)",
    "function mintEnded() view returns (bool)",
    "function owner() view returns (address)",
  ], readProvider.current));

  // whitelistRoot is on GoogleStockNFT, NOT PlatformManager
  const nftContract = useRef(new ethers.Contract(NFT_ADDR, [
    "function whitelistRoot() view returns (bytes32)",
    "function balanceOf(address) view returns (uint256)",
    "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
    "function mintPrincipal(uint256) view returns (uint256)",
    "function googlPriceAtMint(uint256) view returns (uint256)",
    "function mintTimestamp(uint256) view returns (uint48)",
    "function soulbound(uint256) view returns (bool)",
    "function tokenURI(uint256) view returns (string)",
    "function wlMinted(address) view returns (bool)",
    "function mintActive() view returns (bool)",
  ], readProvider.current));

  // TreasuryVault reads (V3 — replaces StockVault)
  // Uses useMemo so it updates when TV_ADDR changes (not stale after env updates)
  const tvContract = useMemo(() =>
    TV_ADDR ? new ethers.Contract(TV_ADDR, [
      // Claim state (for portfolio)
      "function pileClaimed(uint256) view returns (bool)",
      "function googlClaimed(uint256) view returns (bool)",
      "function pileClaimsOpen() view returns (bool)",
      "function purchaseComplete() view returns (bool)",
      "function googlClaimsOpen() view returns (bool)",
      "function tbaForToken(uint256) view returns (address)",
      // Admin: pools
      "function pool80() view returns (uint256)",
      "function pool20() view returns (uint256)",
      // Admin: LP
      "function pileForLP() view returns (uint256)",
      "function usdgForLP() view returns (uint256)",
      "function lpCreated() view returns (bool)",
      "function getMarketCap() view returns (uint256,uint256)",
      // Admin: Airdrop
      "function totalPileForAirdrop() view returns (uint256)",
      // Admin: GOOGL
      "function totalGooglHeld() view returns (uint256)",
      "function totalMintPrincipal() view returns (uint256)",
    ], readProvider.current) : null,
  [TV_ADDR]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [totalSupply, setTotalSupply] = useState<number | null>(null);
  const MAX_SUPPLY = 4083;

  // ── Admin state ──
  const [adminPhase, setAdminPhase] = useState<number | null>(null);
  const [mintPhaseNum, setMintPhaseNum] = useState<number>(0); // 0=NONE,1=WL,2=PUBLIC,3=ENDED
  const [wlAlreadyMinted, setWlAlreadyMinted] = useState(false);
  const [mintIsActive, setMintIsActive] = useState(true);
  const [wlCount, setWlCount] = useState<number | null>(null);
  const [wlStartTime, setWlStartTime] = useState<number | null>(null);
  const [wlRoot, setWlRoot] = useState<string>("");
  const [wlRootInput, setWlRootInput] = useState("");
  const [adminBusy, setAdminBusy] = useState<string | null>(null);

  // ── V3 Admin: LP ──
  const [lpPileInput, setLpPileInput] = useState("");
  const [lpUsdgInput, setLpUsdgInput] = useState("");
  const [lpMinPileInput, setLpMinPileInput] = useState("");
  const [lpMinUsdgInput, setLpMinUsdgInput] = useState("");
  const [lpPileOnChain, setLpPileOnChain] = useState("0");
  const [lpUsdgOnChain, setLpUsdgOnChain] = useState("0");
  const [lpCreated, setLpCreated] = useState(false);
  const [lpMarketCap, setLpMarketCap] = useState<{ price: string; fdv: string } | null>(null);
  // ── V3 Admin: Pools ──
  const [pool80Val, setPool80Val] = useState("0");
  const [pool20Val, setPool20Val] = useState("0");
  // ── V3 Admin: Airdrop ──
  const [airdropAmount, setAirdropAmount] = useState("");
  const [airdropOnChain, setAirdropOnChain] = useState("0");
  const [pileClaimsOpen, setPileClaimsOpen] = useState(false);
  // ── V3 Admin: GOOGL ──
  const [googlHeld, setGooglHeld] = useState("0");
  const [purchaseDone, setPurchaseDone] = useState(false);
  const [googlClaimsOpenVal, setGooglClaimsOpenVal] = useState(false);
  const [mintEnded, setMintEnded] = useState(false);
  const [purchaseMinGoogl, setPurchaseMinGoogl] = useState("");
  const [purchaseUsdgAmount, setPurchaseUsdgAmount] = useState("");
  // ── V3 Admin: Send PILE ──
  const [sendPileTo, setSendPileTo] = useState("");
  const [sendPileAmount, setSendPileAmount] = useState("");
  const [sendPileLabel, setSendPileLabel] = useState("");
  // ── V3 Admin: Send USDG ──
  const [sendUsdgTo, setSendUsdgTo] = useState("");
  const [sendUsdgAmount, setSendUsdgAmount] = useState("");
  const [sendUsdgLabel, setSendUsdgLabel] = useState("");
  // ── Whitelist state ──
  const [wlTwitterUsername, setWlTwitterUsername] = useState("");
  const [wlRetweetUrl, setWlRetweetUrl] = useState("");
  const [wlTweetUrl, setWlTweetUrl] = useState("");
  const [wlSubmitted, setWlSubmitted] = useState(false);
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const [appUnlocked, setAppUnlocked] = useState(false); // admin toggle to show mint + portfolio
  const [wlTweetId] = useState(process.env.NEXT_PUBLIC_TWITTER_TWEET_ID || "2081218513512083852");
  const [wlFollowAccount] = useState(process.env.NEXT_PUBLIC_TWITTER_FOLLOW_ACCOUNT || "naiivememe");
  const WL_API = process.env.NEXT_PUBLIC_BACKEND_API || ""; // empty = same origin (proxy handles it)

  useEffect(() => setMounted(true), []);

  // Redirect to whitelist if app is locked and user lands on a hidden tab
  useEffect(() => {
    if (!appUnlocked && activeTab !== "whitelist" && activeTab !== "admin") {
      setActiveTab("whitelist");
    }
  }, [appUnlocked, activeTab]);

  // ── Fetch totalSupply ──
  useEffect(() => {
    if (!mounted) return;
    const nft = new ethers.Contract(NFT_ADDR, ["function totalSupply() view returns (uint256)"], readProvider.current);
    nft.totalSupply().then((v: bigint) => setTotalSupply(Number(v))).catch(() => {});
    const iv = setInterval(() => {
      nft.totalSupply().then((v: bigint) => setTotalSupply(Number(v))).catch(() => {});
    }, 15000);
    return () => clearInterval(iv);
  }, [mounted]);

  // ── Admin data fetch ──
  useEffect(() => {
    if (!mounted || !isAdmin || !TV_ADDR) return;
    const pm = new ethers.Contract(PM_ADDR, [
      "function mintPhase() view returns (uint8)",
    ], readProvider.current);
    const nft = new ethers.Contract(NFT_ADDR, [
      "function wlMintCount() view returns (uint256)",
      "function whitelistStartTime() view returns (uint256)",
      "function whitelistRoot() view returns (bytes32)",
      "function WL_CAP() view returns (uint256)",
    ], readProvider.current);
    async function fetch() {
      try {
        const [phase, count, start, root, ended] = await Promise.all([
          pm.mintPhase(), nft.wlMintCount(), nft.whitelistStartTime(), nft.whitelistRoot(),
          pm.mintEnded().catch(() => false),
        ]);
        setAdminPhase(Number(phase));
        setWlCount(Number(count));
        setWlStartTime(Number(start));
        setWlRoot(root);
        setMintEnded(ended);
        // V3: TreasuryVault reads
        if (!tvContract) return;
        const [p80, p20, pFLP, uFLP, lpc, mc, tpfa, tgh, pco, pclo, gclo] = await Promise.all([
          tvContract.pool80(),
          tvContract.pool20(),
          tvContract.pileForLP(),
          tvContract.usdgForLP(),
          tvContract.lpCreated(),
          tvContract.getMarketCap().catch(() => [0n,0n]),
          tvContract.totalPileForAirdrop(),
          tvContract.totalGooglHeld(),
          tvContract.purchaseComplete(),
          tvContract.pileClaimsOpen(),
          tvContract.googlClaimsOpen(),
        ]);
        setPool80Val(ethers.formatUnits(p80, 6));
        setPool20Val(ethers.formatUnits(p20, 6));
        setLpPileOnChain(ethers.formatUnits(pFLP, 6));
        setLpUsdgOnChain(ethers.formatUnits(uFLP, 6));
        setLpCreated(lpc);
        setLpMarketCap({
          price: ethers.formatUnits(mc[0], 6),
          fdv: Number(ethers.formatUnits(mc[1], 6)).toFixed(2),
        });
        setAirdropOnChain(ethers.formatUnits(tpfa, 6));
        setGooglHeld(ethers.formatUnits(tgh, 18));
        setPurchaseDone(pco);
        setPileClaimsOpen(pclo);
        setGooglClaimsOpenVal(gclo);
      } catch {}
    }
    fetch();
    const iv = setInterval(fetch, 10000);
    return () => clearInterval(iv);
  }, [mounted, isAdmin, TV_ADDR]);

  // ── Admin actions (uses wagmi wallet) ──
  const doAdmin = async (label: string, contractAddr: string, abi: any[], fn: string, args: any[] = []) => {
    if (!address) { toast.warning("Connect wallet first"); return; }
    setAdminBusy(label);
    try {
      const hash = await writeContractAsync({ address: contractAddr as `0x${string}`, abi, functionName: fn, args });
      await readProvider.current.waitForTransaction(hash);
      toast.success(`${label} done`);
      setPortfolioRefresh(p => p + 1);
    } catch (err: any) {
      toast.error(`${label} failed: ${err?.shortMessage || err?.message?.slice(0, 60)}`);
    } finally {
      setAdminBusy(null);
    }
  };

  // ── Withdraw from TBA (calls TBA.execute directly — TV can't auth) ──
  const handleWithdraw = async (label: string, tokenAddr: `0x${string}`, tbaAddr: `0x${string}`) => {
    if (!address) { toast.warning("Connect wallet first"); return; }
    setAdminBusy(label);
    try {
      const erc20 = new ethers.Contract(tokenAddr, ["function balanceOf(address) view returns (uint256)"], readProvider.current);
      const bal = await erc20.balanceOf(tbaAddr);
      if (bal === 0n) { toast.info("Nothing to withdraw"); setAdminBusy(null); return; }
      const iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);
      const transferData = iface.encodeFunctionData("transfer", [address, bal]);
      const hash = await writeContractAsync({
        address: tbaAddr as `0x${string}`,
        abi: [{type:"function",name:"execute",inputs:[{type:"address"},{type:"uint256"},{type:"bytes"},{type:"uint8"}],outputs:[{type:"bytes"}],stateMutability:"payable"}],
        functionName: "execute",
        args: [tokenAddr as `0x${string}`, 0n, transferData as `0x${string}`, 0],
      });
      await readProvider.current.waitForTransaction(hash);
      toast.success(`${label} withdrawn to wallet`);
      setPortfolioRefresh(p => p + 1);
    } catch (err: any) {
      toast.error(`${label} failed: ${err?.shortMessage || err?.message?.slice(0, 60)}`);
    } finally {
      setAdminBusy(null);
    }
  };

  // ── Fetch user NFTs for Portfolio ──
  useEffect(() => {
    if (!mounted || !address) { setUserNFTs([]); return; }
    let cancelled = false;

    async function fetchNFTs() {
      try {
        const balance = await nftContract.current.balanceOf(address);
        const count = Number(balance);
        const nfts: PortfolioNFT[] = [];

        for (let i = 0; i < count; i++) {
          if (cancelled) return;
          const tokenId = await nftContract.current.tokenOfOwnerByIndex(address, i);
          const tid = Number(tokenId);
          const [principal, googlPrice, ts, sb, tokenUri] = await Promise.all([
            nftContract.current.mintPrincipal(tid),
            nftContract.current.googlPriceAtMint(tid),
            nftContract.current.mintTimestamp(tid),
            nftContract.current.soulbound(tid),
            nftContract.current.tokenURI(tid).catch(() => ""),
          ]);
          const googlAtMint = Number(ethers.formatUnits(googlPrice, 8));
          // Certificate uses fixed $4 GOOGL / $1 PILE / $5 total regardless of mint price
          const googlShares = googlAtMint > 0 ? 4.0 / googlAtMint : 0;
          const dateStr = ts ? new Date(Number(ts) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown";

          // Read claim state from TreasuryVault (V3)
          let [pileClaimed, googlClaimed, pileOpen, purchaseDone, googlClaimsOpen] = [false, false, false, false, false];
          try {
            if (tvContract) {
              [pileClaimed, googlClaimed, pileOpen, purchaseDone, googlClaimsOpen] = await Promise.all([
                tvContract.pileClaimed(tid),
                tvContract.googlClaimed(tid),
                tvContract.pileClaimsOpen(),
                tvContract.purchaseComplete(),
                tvContract.googlClaimsOpen(),
              ]);
            }
          } catch {}

          // Compute PILE + GOOGL statuses from on-chain data
          let pileStatus: PortfolioNFT["pileStatus"] = "Not Distributed";
          let googlStatus: PortfolioNFT["googlStatus"] = "Not Distributed";

          if (pileOpen) {
            pileStatus = pileClaimed ? "Claimed" : "Distributed";
          }
          if (purchaseDone && googlClaimsOpen) {
            googlStatus = googlClaimed ? "Claimed" : "Distributed";
          }

          // Read TBA address
          let tbaAddr = "";
          try {
            if (tvContract) {
              tbaAddr = await tvContract.tbaForToken(tid);
            }
          } catch {}

          // Check if tokens have been withdrawn from TBA
          if (tbaAddr && pileStatus === "Claimed") {
            try {
              const PILE_ADDR = process.env.NEXT_PUBLIC_PILE_ADDRESS || "0x18c52d59b90Abc15E7aB1856ab3357990603F26f";
              const pileToken = new ethers.Contract(PILE_ADDR, ["function balanceOf(address) view returns (uint256)"], readProvider.current);
              const pileBal = await pileToken.balanceOf(tbaAddr);
              if (pileBal === 0n) pileStatus = "Withdrew";
            } catch {}
          }
          if (tbaAddr && googlStatus === "Claimed") {
            try {
              const GOOGL_ADDR = process.env.NEXT_PUBLIC_GOOGL_ADDRESS || "0x6b39A032211bF51D4E166B60E4C30b2F9a2500dD";
              const googlToken = new ethers.Contract(GOOGL_ADDR, ["function balanceOf(address) view returns (uint256)"], readProvider.current);
              const googlBal = await googlToken.balanceOf(tbaAddr);
              if (googlBal === 0n) googlStatus = "Withdrew";
            } catch {}
          }
          let imageUrl = "/app/assets/google-certificate.png"; // fallback
          try {
            if (tokenUri && tokenUri.startsWith("data:application/json")) {
              // On-chain metadata: decode base64 data URI
              const jsonStr = atob(tokenUri.replace("data:application/json;base64,", ""));
              const meta = JSON.parse(jsonStr);
              if (meta.image) imageUrl = meta.image; // SVG data URI
            } else if (tokenUri && tokenUri.startsWith("http")) {
              const metaRes = await fetch(tokenUri);
              const meta = await metaRes.json();
              if (meta.image) imageUrl = meta.image;
            }
          } catch { /* use fallback */ }

          nfts.push({
            tokenId: tid,
            id: `#${tid.toString().padStart(3, "0")}`,
            symbol: "GOOGL",
            shares: parseFloat(googlShares.toFixed(6)),
            date: dateStr,
            value: "$5.00",
            imageUrl,
            tbaAddress: tbaAddr,
            pileStatus,
            googlStatus,
            pileClaimed,
            googlClaimed: googlClaimed,
          });
        }
        if (!cancelled) setUserNFTs(nfts);
      } catch (err: any) {
        if (!cancelled) console.warn("Portfolio fetch failed:", err.message?.slice(0, 80));
      }
    }

    fetchNFTs();
    const iv = setInterval(fetchNFTs, 15000);
    return () => clearInterval(iv);
  }, [address, mounted, portfolioRefresh]);

  // ── Tier detection — reads PlatformManager + GoogleStockNFT directly via RPC ──
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function detect() {
      try {
        const phaseVal = await pmContract.current.mintPhase();
        const rootVal = await nftContract.current.whitelistRoot();
        const ownerVal = await pmContract.current.owner();

        if (!cancelled && address) {
          const treasuryVal = process.env.NEXT_PUBLIC_TREASURY_EOA || "0x982698483F08F99b9354878fFFf5A600b63f5145";
          setIsAdmin(
            address.toLowerCase() === ownerVal.toLowerCase() ||
            address.toLowerCase() === treasuryVal.toLowerCase()
          );
        }

        if (!address || cancelled) {
          if (!cancelled) {
            setTierLabel("Connect wallet to see your tier");
            setTierLabelColor("var(--text-muted)");
            setActiveTier("public");
          }
          return;
        }

        const phaseNum = Number(phaseVal);
        setMintPhaseNum(phaseNum);

        // Check if already minted WL
        if (address && phaseNum === 1) {
          try {
            const alreadyMinted = await nftContract.current.wlMinted(address);
            if (!cancelled) setWlAlreadyMinted(alreadyMinted);
          } catch { if (!cancelled) setWlAlreadyMinted(false); }
        } else {
          if (!cancelled) setWlAlreadyMinted(false);
        }

        // Read mint active
        try {
          const active = await nftContract.current.mintActive();
          if (!cancelled) setMintIsActive(active);
        } catch {}

        if (cancelled) return;

        if (phaseNum === 1) {
          if (rootVal && rootVal !== ethers.ZeroHash) {
            // Contract uses keccak256(abi.encodePacked(address)) — 20 address bytes, NOT hex string
            const userLeaf = ethers.solidityPackedKeccak256(["address"], [address]);
            const isWL = userLeaf.toLowerCase() === rootVal.toLowerCase();
            setActiveTier(isWL ? "whitelist" : "public");
            setTierLabel(isWL ? "Whitelist · 4 USDG/share" : "Not Whitelisted · Public Phase");
            setTierLabelColor(isWL ? "var(--color-primary)" : "#E04040");
          } else {
            setActiveTier("public");
            setTierLabel("Public · 6 USDG/share");
            setTierLabelColor("var(--text-primary)");
          }
        } else if (phaseNum === 2) {
          setActiveTier("public");
          setTierLabel("Public · 6 USDG/share");
          setTierLabelColor("var(--text-primary)");
        } else {
          setTierLabel("Mint not active");
          setTierLabelColor("var(--text-muted)");
        }
      } catch (err: any) {
        if (!cancelled) console.warn("Tier detection failed:", err.message?.slice(0, 80));
      }
    }

    detect();
    return () => { cancelled = true; };
  }, [address, mounted]);

  // ── Mint: uses wagmi (same wallet RainbowKit connected) ──
  const { writeContractAsync } = useWriteContract();

  const handleMint = async () => {
    if (!address) { toast.warning("Connect wallet first"); return; }
    if (mintPhaseNum === 1 && activeTier !== "whitelist") { toast.warning("Not whitelisted — WL phase requires Merkle proof"); return; }
    if (mintPhaseNum === 1 && wlAlreadyMinted) { toast.warning("Already minted during WL — limit 1 per wallet"); return; }
    if (mintPhaseNum === 0 || mintPhaseNum === 3) { toast.warning("Mint is not active"); return; }
    if (!googlePrice || googlePrice === "198.45") { toast.info("Waiting for live GOOGL price..."); return; }

    setMintLoading(true);
    try {
      const usdgAmount = BigInt(TIER_PRICES[activeTier] * 1_000_000); // 1 NFT = fixed price
      const googlPriceParsed = ethers.parseUnits(googlePrice, 8);

      // Step 1: Approve USDG
      const approveHash = await writeContractAsync({
        address: USDG_ADDR as `0x${string}`,
        abi: [{ type: "function", name: "approve", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" }],
        functionName: "approve",
        args: [NFT_ADDR as `0x${string}`, usdgAmount],
      });
      await readProvider.current.waitForTransaction(approveHash);

      // Step 2: Mint
      const mintHash = await writeContractAsync({
        address: NFT_ADDR as `0x${string}`,
        abi: [{ type: "function", name: "mint", inputs: [{ type: "uint256" }, { type: "bytes32[]" }], outputs: [{ type: "uint256" }], stateMutability: "nonpayable" }],
        functionName: "mint",
        args: [googlPriceParsed, []],
      });
      const receipt = await readProvider.current.waitForTransaction(mintHash);
      if (!receipt) { toast.error("Transaction not found"); setMintLoading(false); return; }

      // Extract tokenId from mint event
      let mintedTokenId: number | null = null;
      const iface = new ethers.Interface(["event NFTMinted(uint256 indexed tokenId, address indexed owner, uint256 usdgAmount, uint256 googlPrice)"]);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "NFTMinted") { mintedTokenId = Number(parsed.args.tokenId); break; }
        } catch {}
      }

      toast.success(`Minted! TX: ${receipt.hash.slice(0, 10)}...${receipt.hash.slice(-6)}`);

      // Refresh portfolio after mint
      setPortfolioRefresh(p => p + 1);
    } catch (err: any) {
      console.error("Mint failed:", err);
      const msg = err?.shortMessage || err?.message || "Unknown error";
      toast.error(`Mint failed: ${msg.slice(0, 100)}`);
    } finally {
      setMintLoading(false);
    }
  };

  // ── Whitelist: Submit ──
  const handleWlSubmit = async () => {
    if (!address) { toast.warning("Connect wallet first"); return; }
    if (!wlTwitterUsername.trim()) { toast.warning("Enter your Twitter username"); return; }
    if (!wlRetweetUrl.trim()) { toast.warning("Paste your retweet link"); return; }
    if (!wlTweetUrl.trim()) { toast.warning("Paste your tweet link"); return; }
    setWlSubmitting(true);
    try {
      const res = await fetch(`${WL_API}/api/whitelist/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twitterUsername: wlTwitterUsername.trim(),
          retweetUrl: wlRetweetUrl.trim(),
          tweetUrl: wlTweetUrl.trim(),
          walletAddress: address,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWlSubmitted(true);
        toast.success("Submitted! You're on the whitelist. 🎉");
      } else {
        toast.error(data.error || "Submit failed");
      }
    } catch {
      toast.error("Submit failed — is backend running?");
    } finally {
      setWlSubmitting(false);
    }
  };

  // ── Whitelist: Load submission status on mount ──
  useEffect(() => {
    if (!address || !mounted) return;
    (async () => {
      try {
        const res = await fetch(`${WL_API}/api/whitelist/submission?address=${address}`);
        const data = await res.json();
        if (res.ok && data.submitted) setWlSubmitted(true);
      } catch {}
    })();
  }, [address, mounted]);

  // ── Price fetching ──
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/stock-prices");
        if (!res.ok) return;
        const data = await res.json();
        const googl = data.find((d: any) => d.symbol === "GOOGL");
        if (!googl) return;
        setGooglePrice(googl.price);
        const isUp = googl.up;
        setGoogleChange({
          text: `${isUp ? "▲" : "▼"} ${googl.change} (${googl.change}%)`,
          cls: isUp ? "up" : "down",
        });
      } catch { /* keep previous */ }
    };
    fetchPrice();
    const iv = setInterval(fetchPrice, 3600000);
    return () => clearInterval(iv);
  }, []);

  // ── 3D Certificate Tilt ──
  useEffect(() => {
    const frame = document.getElementById("cert-frame");
    if (!frame) return;
    const onMove = (e: MouseEvent | Touch) => {
      const rect = frame.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ry = ((e.clientX - rect.left - cx) / cx) * 12;
      const rx = -((e.clientY - rect.top - cy) / cy) * 12;
      frame.style.transform = `rotateY(${ry}deg) rotateX(${rx}deg)`;
    };
    const onMouseMove = (e: MouseEvent) => onMove(e);
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0]); };
    const onLeave = () => { frame.style.transform = "rotateY(0deg) rotateX(0deg)"; };

    frame.addEventListener("mousemove", onMouseMove);
    frame.addEventListener("mouseleave", onLeave);
    frame.addEventListener("touchmove", onTouchMove, { passive: false });
    frame.addEventListener("touchend", onLeave);
    return () => {
      frame.removeEventListener("mousemove", onMouseMove);
      frame.removeEventListener("mouseleave", onLeave);
      frame.removeEventListener("touchmove", onTouchMove);
      frame.removeEventListener("touchend", onLeave);
    };
  }, []);

  // ── Floating Particles ──
  useEffect(() => {
    const container = document.getElementById("cert-particles");
    if (!container || window.innerWidth <= 640) return;
    for (let i = 0; i < 16; i++) {
      const p = document.createElement("div");
      p.className = "cert-particle";
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 3}s`;
      p.style.animationDuration = `${2.5 + Math.random() * 4}s`;
      const s = `${2 + Math.random() * 4}px`;
      p.style.width = s;
      p.style.height = s;
      container.appendChild(p);
    }
  }, []);

  // ── Keyboard nav ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, string> = { "1": "mint", "2": "portfolio", "3": "whitelist", "4": "admin" };
      if (map[e.key]) setActiveTab(map[e.key]);
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Resize handler ──
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 640) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Helpers ──
  const totalCost = TIER_PRICES[activeTier] * quantity;
  const switchTab = useCallback((tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  // ── Computed mint status badge ──
  const mintStatusBadge = (() => {
    if (mintPhaseNum === 0) return { label: "● NOT OPEN", cls: "paused" };
    if (mintPhaseNum === 3) return { label: "● ENDED", cls: "ended" };
    if (!mintIsActive) return { label: "● PAUSED", cls: "paused" };
    if (mintPhaseNum === 1) return { label: "● WL LIVE", cls: "live" };
    if (mintPhaseNum === 2) return { label: "● PUBLIC LIVE", cls: "live" };
    return { label: "● ...", cls: "paused" };
  })();

  if (!mounted) {
    return <div className="app-shell"><div className="app-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><p style={{ color: "var(--text-muted)" }}>Loading DAPP...</p></div></div>;
  }

  return (
    <>
      {createPortal(
        <Toaster position="bottom-right" theme="dark" richColors />,
        document.body
      )}
      <div className="app-shell">
      {/* ===== Sidebar Overlay (mobile) ===== */}
      {sidebarOpen && <div className="sidebar-overlay visible" onClick={() => setSidebarOpen(false)} />}

      {/* ===== Left Sidebar ===== */}
      <aside className={`app-sidebar${sidebarOpen ? " open" : ""}`} id="sidebar" role="navigation" aria-label="App navigation">
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo-link" aria-label="Back to home">
            <img src="/logo.jpg" alt="stockNFT" className="sidebar-logo" />
          </Link>
          <span className="sidebar-brand">stockNFT</span>
        </div>

        <nav className="sidebar-nav">
          {TABS.filter(t => {
            if (t.id === "admin") return isAdmin;
            if (!appUnlocked) return t.id === "whitelist";
            return true;
          }).map(tab => (
            <button
              key={tab.id}
              className={`sidebar-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => switchTab(tab.id)}
              aria-label={`${tab.label} stocks`}
            >
              <span className="material-icons-round">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {tab.badge && <span className="tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-wallet">
            <WalletButton />
          </div>
          <Link href="/" className="sidebar-back">
            <span className="material-icons-round">arrow_back</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </aside>

      {/* ===== Mobile Header ===== */}
      <header className="app-mobile-header" id="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <span className="material-icons-round">menu</span>
        </button>
        <span className="mobile-title">
          {TABS.find(t => t.id === activeTab)?.label || "Mint"}
        </span>
        <div className="mobile-wallet-btn">
          <WalletButton />
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="app-content">
        {/* ─── Mint Tab ─── */}
        <section className={`app-page${activeTab === "mint" ? " active" : ""}`} id="page-mint">
          <div className="mint-layout">
            <div className="mint-info">
              <div className="mint-stock-header">
                <div className="stock-symbol-badge">GOOGL</div>
                <div>
                  <h1 className="stock-name">Google Inc.</h1>
                  <p className="stock-exchange">NASDAQ · Robinhood Chain</p>
                </div>
                <span className={`mint-status-badge ${mintStatusBadge.cls}`}>
                  {mintStatusBadge.label}
                </span>
              </div>

              <div className="mint-price-card">
                <span className="price-label">Current Share Price</span>
                <div className="price-value">
                  <span className="price-currency">$</span>
                  <span className="price-amount">{googlePrice}</span>
                  <span className={`price-change ${googleChange.cls}`}>{googleChange.text}</span>
                </div>
                <span className="price-updated">Updated just now · via Robinhood Oracle</span>
              </div>

              {/* ── Mint Progress Bar ── */}
              <div className="mint-progress-card">
                <div className="progress-header">
                  <span className="progress-label">Mint Progress</span>
                  <span className="progress-count">
                    {totalSupply !== null ? `${totalSupply} / ${MAX_SUPPLY}` : "Loading..."}
                  </span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${totalSupply !== null ? (totalSupply / MAX_SUPPLY) * 100 : 0}%` }}
                  />
                </div>
                <div className="progress-footer">
                  <span className="progress-remaining">
                    {totalSupply !== null ? `${MAX_SUPPLY - totalSupply} remaining` : "..."}
                  </span>
                  <span className="progress-percent">
                    {totalSupply !== null ? `${((totalSupply / MAX_SUPPLY) * 100).toFixed(1)}%` : "..."}
                  </span>
                </div>
              </div>

              <div className="mint-tier-card">
                <div className="tier-indicator">
                  <span className="material-icons-round tier-icon">shield</span>
                  <div>
                    <span className="tier-label">Your Tier</span>
                    <span className="tier-value" style={{ color: tierLabelColor }} suppressHydrationWarning>{tierLabel}</span>
                  </div>
                </div>
                <div className="tier-prices">
                  <div className={`tier-option${activeTier === "whitelist" ? " active" : ""}`}>
                    <span className="tier-name">Whitelist</span>
                    <span className="tier-price">4 <small>USDG</small></span>
                  </div>
                  <div className="tier-divider"></div>
                  <div className={`tier-option${activeTier === "public" ? " active" : ""}`}>
                    <span className="tier-name">Public</span>
                    <span className="tier-price">6 <small>USDG</small></span>
                  </div>
                </div>
              </div>

              <div className="mint-qty-card">
                <span className="qty-label">Mint 1 NFT</span>
                <div className="qty-total">
                  <span>Cost per NFT</span>
                  <span className="qty-total-value">{TIER_PRICES[activeTier].toFixed(2)} USDG</span>
                </div>
              </div>

              <button className="btn-mint" onClick={handleMint}
                disabled={mintLoading || !address || (mintPhaseNum === 1 && (activeTier !== "whitelist" || wlAlreadyMinted)) || (mintPhaseNum === 0 || mintPhaseNum === 3)}>
                <span className="material-icons-round">
                  {mintLoading ? "hourglass_top" : "add_circle"}
                </span>
                <span>
                  {mintLoading ? "Minting..." :
                   !address ? "Connect Wallet to Mint" :
                   (mintPhaseNum === 1 && wlAlreadyMinted) ? "Already minted, wait for public to mint more" :
                   (mintPhaseNum === 1 && activeTier !== "whitelist") ? "Not eligible, wait for public mint" :
                   `Mint Stock NFT — ${TIER_PRICES[activeTier].toFixed(2)} USDG`}
                </span>
              </button>
              <p className="mint-disclaimer">
                By minting you agree to the stockNFT terms. Shares are custodied 1:1 by regulated partners.
              </p>
            </div>

            <div className="mint-cert-col">
              <div className="cert-frame" id="cert-frame">
                <div className="cert-glow"></div>
                <div className="cert-card" id="cert-card">
                  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style={{width:"100%", height:"auto", borderRadius:"12px"}}>
                    <defs><linearGradient id="fm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#9edd3e"/><stop offset="100%" stopColor="#6ab520"/></linearGradient></defs>
                    <rect width="600" height="800" fill="#000000" rx="16"/>
                    <rect x="12" y="12" width="576" height="776" fill="none" stroke="url(#fm)" strokeWidth="2" rx="12"/>
                    <rect x="20" y="20" width="560" height="760" fill="none" stroke="url(#fm)" strokeWidth="0.5" rx="8" opacity="0.3"/>
                    <text x="300" y="50" textAnchor="middle" fontFamily="Georgia,serif" fontSize="26" fill="url(#fm)" fontWeight="bold" letterSpacing="3">IN CHAIN WE TRUST</text>
                    <text x="300" y="100" textAnchor="middle" fontFamily="Georgia,serif" fontSize="22" fill="#ffffff" fontWeight="bold">Google Stock Passport</text>
                    <text x="300" y="125" textAnchor="middle" fontFamily="Courier New,monospace" fontSize="12" fill="#8888aa">ERC-6551 Token Bound Account</text>
                    <line x1="80" y1="140" x2="520" y2="140" stroke="url(#fm)" strokeWidth="1" opacity="0.5"/>
                    <text x="300" y="180" textAnchor="middle" fontFamily="Courier New,monospace" fontSize="48" fill="url(#fm)" fontWeight="bold">#001</text>
                    <text x="90" y="255" fontFamily="Courier New,monospace" fontSize="13" fill="#667799">ALPHABET (GOOGLE) SHARES</text>
                    <text x="90" y="290" fontFamily="Georgia,serif" fontSize="15" fill="#8888aa">GOOGL Share</text><text x="510" y="290" textAnchor="end" fontFamily="Courier New,monospace" fontSize="16" fill="#ffffff" fontWeight="bold">$4 ÷ price</text><line x1="90" y1="302" x2="510" y2="302" stroke="rgba(255,255,255,0.05)"/>
                    <text x="90" y="335" fontFamily="Georgia,serif" fontSize="15" fill="#8888aa">$PILE Share</text><text x="510" y="335" textAnchor="end" fontFamily="Courier New,monospace" fontSize="16" fill="#9edd3e" fontWeight="bold">$1.00</text><line x1="90" y1="347" x2="510" y2="347" stroke="rgba(255,255,255,0.05)"/>
                    <text x="90" y="380" fontFamily="Georgia,serif" fontSize="15" fill="#8888aa">Stock Value (USD)</text><text x="510" y="380" textAnchor="end" fontFamily="Courier New,monospace" fontSize="16" fill="#ffffff" fontWeight="bold">$5.00</text><line x1="90" y1="392" x2="510" y2="392" stroke="rgba(255,255,255,0.05)"/>
                    <text x="90" y="425" fontFamily="Georgia,serif" fontSize="15" fill="#8888aa">GOOGL Price at Mint</text><text x="510" y="425" textAnchor="end" fontFamily="Courier New,monospace" fontSize="16" fill="#9edd3e" fontWeight="bold">live oracle</text><line x1="90" y1="437" x2="510" y2="437" stroke="rgba(255,255,255,0.05)"/>
                    <text x="90" y="470" fontFamily="Georgia,serif" fontSize="15" fill="#8888aa">Mint Date</text><text x="510" y="470" textAnchor="end" fontFamily="Courier New,monospace" fontSize="16" fill="#ffffff" fontWeight="bold">YYYY-MM-DD</text><line x1="90" y1="482" x2="510" y2="482" stroke="rgba(255,255,255,0.05)"/>
                    <text x="90" y="530" fontFamily="Courier New,monospace" fontSize="12" fill="#667799">ERC-6551 SMART ACCOUNT</text>
                    <text x="90" y="560" fontFamily="Courier New,monospace" fontSize="13" fill="#ffffff">0x... (TBA deployed at mint)</text>
                    <text x="90" y="583" fontFamily="Courier New,monospace" fontSize="11" fill="#667799">Assets (PILE + GOOGL) held in this smart account</text>
                    <text x="90" y="642" fontFamily="Courier New,monospace" fontSize="12" fill="#8888aa">Network</text><text x="510" y="642" textAnchor="end" fontFamily="Courier New,monospace" fontSize="13" fill="#ffffff">Robinhood Chain</text>
                    <text x="90" y="685" fontFamily="Courier New,monospace" fontSize="11" fill="#8888aa">Minter</text><text x="510" y="685" textAnchor="end" fontFamily="Courier New,monospace" fontSize="10" fill="#ffffff">your wallet address</text>
                    <line x1="80" y1="710" x2="520" y2="710" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                    <text x="300" y="750" textAnchor="middle" fontFamily="Georgia,serif" fontSize="11" fill="#555577">NFT created by: @StocksNFT_ | stock shares tokenized by Robinhood Chain</text>
                    <circle cx="30" cy="30" r="4" fill="url(#fm)" opacity="0.5"/><circle cx="570" cy="30" r="4" fill="url(#fm)" opacity="0.5"/><circle cx="30" cy="770" r="4" fill="url(#fm)" opacity="0.5"/><circle cx="570" cy="770" r="4" fill="url(#fm)" opacity="0.5"/>
                  </svg>
                  <div className="cert-reflection"></div>
                </div>
                <div className="cert-badge">
                  <span className="material-icons-round">verified</span>
                  <span>1:1 Backed · Audited</span>
                </div>
              </div>
              <div className="cert-particles" id="cert-particles" aria-hidden="true"></div>
            </div>
          </div>
        </section>

        {/* ─── Portfolio Tab ─── */}
        <section className={`app-page${activeTab === "portfolio" ? " active" : ""}`} id="page-portfolio">
          <div className="page-header">
            <h1>Your Portfolio</h1>
            <p>View and manage your tokenized stock holdings.</p>
          </div>
          <div className="page-body">
            {!address ? (
              <div className="placeholder-card">
                <span className="material-icons-round placeholder-icon">account_balance_wallet</span>
                <h2>Connect Your Wallet</h2>
                <p>Connect your wallet to view your tokenized stock holdings.</p>
              </div>
            ) : userNFTs.length === 0 ? (
              <div className="placeholder-card">
                <span className="material-icons-round placeholder-icon">inventory_2</span>
                <h2>No NFTs Yet</h2>
                <p>Head to the <a href="#" onClick={(e) => { e.preventDefault(); switchTab("mint"); }} style={{ color: "var(--color-primary)", cursor: "pointer" }}>Mint page</a> to tokenize your first stock.</p>
              </div>
            ) : (
            <div className="portfolio-grid" id="portfolio-grid">
              {userNFTs.map(nft => {
                const colors = STOCK_COLORS[nft.symbol] || STOCK_COLORS["GOOGL"];
                return (
                  <div
                    key={nft.id}
                    className="nft-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedNFT(nft)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedNFT(nft); } }}
                    style={{ borderColor: colors.border.replace(/[\d.]+\)$/, "0.15)") }}
                  >
                    <div className="nft-card-image-wrapper" style={{ background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "4/3", borderBottom: "1px solid var(--border-color)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 48, fontWeight: 900, color: colors.text, opacity: 0.6 }}>{nft.symbol}</span>
                    </div>
                    <div className="nft-card-body">
                      <span className="nft-card-symbol">{nft.symbol}</span>
                      <span className="nft-card-name">Stock NFT {nft.id}</span>
                      <span className="nft-card-number">{nft.shares} GOOGL + $1.00 PILE</span>
                      <div className="nft-card-footer">
                        <span className="nft-card-value">{nft.value}</span>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          <span className={`nft-card-status status-${nft.pileStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                            PILE: {nft.pileStatus}
                          </span>
                          <span className={`nft-card-status status-${nft.googlStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                            GOOGL: {nft.googlStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* NFT Detail Modal */}
          {selectedNFT && (
            <div className="modal-overlay open" aria-hidden="false" onClick={() => setSelectedNFT(null)}>
              <div className="modal-backdrop"></div>
              <div className="modal-container" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setSelectedNFT(null)} aria-label="Close modal">
                  <span className="material-icons-round">close</span>
                </button>
                <div className="modal-layout">
                  <div className="modal-preview">
                    <div className="modal-cert-frame">
                      <img src={selectedNFT.imageUrl} alt="NFT Certificate" className="modal-cert-image" />
                    </div>
                  </div>
                  <div className="modal-details">
                    <span className="modal-badge">{selectedNFT.symbol}</span>
                    <h2 className="modal-title">{selectedNFT.symbol} Stock NFT {selectedNFT.id}</h2>
                    <div className="modal-info-grid">
                      <div className="modal-info-item">
                        <span className="modal-info-label">NFT ID</span>
                        <span className="modal-info-value">{selectedNFT.id}</span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">Stock Value</span>
                        <span className="modal-info-value">{selectedNFT.value}</span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">GOOGL Share</span>
                        <span className="modal-info-value">{selectedNFT.shares} GOOGL</span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">$PILE Value</span>
                        <span className="modal-info-value">$1.00</span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">Mint Date</span>
                        <span className="modal-info-value">{selectedNFT.date}</span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">Current Value</span>
                        <span className="modal-info-value accent">{selectedNFT.value}</span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">$PILE Status</span>
                        <span className="modal-info-value">
                          <span className={`status-badge status-${selectedNFT.pileStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                            {selectedNFT.pileStatus}
                          </span>
                        </span>
                      </div>
                      <div className="modal-info-item">
                        <span className="modal-info-label">GOOGL Status</span>
                        <span className="modal-info-value">
                          <span className={`status-badge status-${selectedNFT.googlStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                            {selectedNFT.googlStatus}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="modal-actions" style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                      <a
                        className="btn-modal-action secondary"
                        href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://explorer.testnet.chain.robinhood.com"}/token/${NFT_ADDR}/instance/${selectedNFT.tokenId}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{textDecoration:"none"}}
                      >
                        <span className="material-icons-round">open_in_new</span>NFT on Explorer
                      </a>
                      {selectedNFT.tbaAddress ? (
                        <a
                          className="btn-modal-action secondary"
                          href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://explorer.testnet.chain.robinhood.com"}/address/${selectedNFT.tbaAddress}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{textDecoration:"none"}}
                        >
                          <span className="material-icons-round">account_balance_wallet</span>TBA Smart Account
                        </a>
                      ) : <span></span>}
                      {selectedNFT.pileStatus === "Distributed" && (
                        <button className="btn-modal-action primary" style={{gridColumn:"1 / -1"}}
                          onClick={() => doAdmin("Claim PILE", TV_ADDR, [
                            {type:"function",name:"claimPILE",inputs:[{type:"uint256"}],outputs:[],stateMutability:"nonpayable"}
                          ], "claimPILE", [selectedNFT.tokenId])}>
                          <span className="material-icons-round">redeem</span>Claim $PILE
                        </button>
                      )}
                      {selectedNFT.pileStatus === "Claimed" && (
                        <button className="btn-modal-action secondary" style={{gridColumn:"1 / -1"}}
                          onClick={() => handleWithdraw("Withdraw PILE", (process.env.NEXT_PUBLIC_PILE_ADDRESS || "0x18c52d59b90Abc15E7aB1856ab3357990603F26f") as `0x${string}`, selectedNFT.tbaAddress as `0x${string}`)}>
                          <span className="material-icons-round">arrow_back</span>Withdraw PILE to Wallet
                        </button>
                      )}
                      {selectedNFT.pileStatus === "Withdrew" && (
                        <span className="btn-modal-action secondary" style={{gridColumn:"1 / -1", opacity:0.6, pointerEvents:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 16px", borderRadius:8, background:"rgba(158,221,62,0.1)", color:"#9edd3e", fontWeight:600}}>
                          <span className="material-icons-round">check_circle</span>$PILE Withdrew ✓
                        </span>
                      )}
                      {selectedNFT.googlStatus === "Distributed" && (
                        <button className="btn-modal-action primary" style={{gridColumn:"1 / -1"}}
                          onClick={() => doAdmin("Claim GOOGL", TV_ADDR, [
                            {type:"function",name:"claimGOOGL",inputs:[{type:"uint256"}],outputs:[],stateMutability:"nonpayable"}
                          ], "claimGOOGL", [selectedNFT.tokenId])}>
                          <span className="material-icons-round">swap_horiz</span>Claim GOOGL
                        </button>
                      )}
                      {selectedNFT.googlStatus === "Claimed" && (
                        <button className="btn-modal-action secondary" style={{gridColumn:"1 / -1"}}
                          onClick={() => handleWithdraw("Withdraw GOOGL", (process.env.NEXT_PUBLIC_GOOGL_ADDRESS || "0x6b39A032211bF51D4E166B60E4C30b2F9a2500dD") as `0x${string}`, selectedNFT.tbaAddress as `0x${string}`)}>
                          <span className="material-icons-round">arrow_back</span>Withdraw GOOGL to Wallet
                        </button>
                      )}
                      {selectedNFT.googlStatus === "Withdrew" && (
                        <span className="btn-modal-action secondary" style={{gridColumn:"1 / -1", opacity:0.6, pointerEvents:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 16px", borderRadius:8, background:"rgba(66,133,244,0.1)", color:"#4285F4", fontWeight:600}}>
                          <span className="material-icons-round">check_circle</span>GOOGL Withdrew ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Whitelist Tab ─── */}
        <section className={`app-page${activeTab === "whitelist" ? " active" : ""}`} id="page-whitelist">
          <div className="page-header">
            <h1>Whitelist</h1>
            <p>Submit your details for early-access minting (4 USDG per share). Verification is manual after submission period ends.</p>
          </div>
          <div className="page-body">
            {!address ? (
              <div className="placeholder-card">
                <span className="material-icons-round placeholder-icon">wallet</span>
                <h2>Connect Your Wallet</h2>
                <p>Connect your wallet to join the whitelist.</p>
              </div>
            ) : wlSubmitted ? (
              <div className="placeholder-card">
                <h2 style={{color:"#9edd3e"}}>Submitted!</h2>
                <p>Your details have been received. We'll verify after the submission period ends.</p>
              </div>
            ) : (
              <div className="wl-container">
                <div className="wl-card">
                  <div className="wl-card-header">
                    <span className="wl-step-badge">1</span>
                    <h3>Whitelist Submission</h3>
                  </div>
                  <p style={{color:"var(--text-muted)",fontSize:13,margin:"0 0 16px 0"}}>
                    Complete these steps on Twitter, then paste the links below and submit.
                  </p>

                  {/* Instructions */}
                  <div style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"12px 16px",marginBottom:16,fontSize:13,color:"var(--text-secondary)",lineHeight:1.8}}>
                    <p style={{margin:"0 0 8px 0",fontWeight:600,color:"var(--text-primary)"}}>📋 Steps:</p>
                    <p style={{margin:"2px 0"}}>1. Follow <a href={`https://x.com/${wlFollowAccount}`} target="_blank" rel="noopener noreferrer" style={{color:"var(--color-primary)"}}>@{wlFollowAccount}</a></p>
                    <p style={{margin:"2px 0"}}>2. Like &amp; Retweet <a href={`https://x.com/naiivememe/status/${wlTweetId}`} target="_blank" rel="noopener noreferrer" style={{color:"var(--color-primary)"}}>this tweet</a></p>
                    <p style={{margin:"2px 0"}}>3. Comment on <a href={`https://x.com/naiivememe/status/${wlTweetId}`} target="_blank" rel="noopener noreferrer" style={{color:"var(--color-primary)"}}>this tweet</a></p>
                    <p style={{margin:"2px 0"}}>4. Post this exact tweet:</p>
                    <code style={{display:"block",padding:"6px 10px",background:"rgba(0,0,0,0.3)",borderRadius:4,fontSize:12,margin:"4px 0"}}>
                      yes I am just testing if @naiivememe follows back or not.
                    </code>
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("yes I am just testing if @naiivememe follows back or not.")}`} target="_blank" rel="noopener noreferrer"
                      style={{display:"inline-block",marginTop:6,color:"var(--color-primary)",fontWeight:600,fontSize:12}}>
                      ↗ Click to tweet this
                    </a>
                  </div>

                  {/* Form */}
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <label style={{fontSize:12,color:"var(--text-muted)",display:"block",marginBottom:4}}>Twitter Username</label>
                      <input className="wl-input" placeholder="@yourhandle" value={wlTwitterUsername}
                        onChange={e => setWlTwitterUsername(e.target.value)} />
                    </div>
                    <div>
                      <label style={{fontSize:12,color:"var(--text-muted)",display:"block",marginBottom:4}}>Your Retweet Link</label>
                      <input className="wl-input" placeholder="https://x.com/yourhandle/status/..." value={wlRetweetUrl}
                        onChange={e => setWlRetweetUrl(e.target.value)} />
                    </div>
                    <div>
                      <label style={{fontSize:12,color:"var(--text-muted)",display:"block",marginBottom:4}}>Your Tweet Link</label>
                      <input className="wl-input" placeholder="https://x.com/yourhandle/status/..." value={wlTweetUrl}
                        onChange={e => setWlTweetUrl(e.target.value)} />
                    </div>
                    <div>
                      <label style={{fontSize:12,color:"var(--text-muted)",display:"block",marginBottom:4}}>Wallet Address</label>
                      <input className="wl-input" value={address} readOnly
                        style={{opacity:0.6,cursor:"not-allowed"}} />
                    </div>

                    <button className="btn-admin" onClick={handleWlSubmit} disabled={wlSubmitting}
                      style={{background:"var(--color-primary)",color:"#000",fontWeight:700,fontSize:15,padding:"12px 24px",marginTop:8}}>
                      {wlSubmitting ? "Submitting..." : "📝 Submit Whitelist Entry"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── Admin Tab ─── */}
        {isAdmin && (
          <section className={`app-page${activeTab === "admin" ? " active" : ""}`} id="page-admin">
            <div className="page-header">
              <h1>Admin Panel</h1>
              <p>Phase, LP, Airdrop, GOOGL — all controlled from TreasuryVault.
                <button className="wl-task-btn" onClick={() => setAppUnlocked(!appUnlocked)}
                  style={{marginLeft:16, background: appUnlocked ? "rgba(224,64,64,0.15)" : "var(--color-primary)", color: appUnlocked ? "#e04040" : "#000"}}>
                  {appUnlocked ? "🔒 Lock DAPP" : "🔓 Unlock DAPP"}
                </button>
              </p>
            </div>
            <div className="page-body">
              <div className="admin-grid">

                {/* ── Phase Controls ── */}
                <div className="admin-card">
                  <h3 className="admin-card-title">Phase Controls</h3>
                  <div className="admin-info">
                    <span>Phase: <strong>{["NONE","WHITELIST","PUBLIC","ENDED"][adminPhase ?? 0]}</strong></span>
                    {adminPhase === 1 && wlStartTime && (
                      <span>WL ends: <strong>{new Date((wlStartTime + 7200) * 1000).toLocaleTimeString()}</strong></span>
                    )}
                    {adminPhase === 1 && <span>WL Minted: <strong>{wlCount} / 1500</strong></span>}
                    <span>Pool 80: <strong>{pool80Val} USDG</strong></span>
                    <span>Pool 20: <strong>{pool20Val} USDG</strong></span>
                  </div>
                  <div className="admin-actions">
                    <button className="btn-admin" disabled={!!adminBusy || adminPhase !== 0}
                      onClick={() => doAdmin("Open Whitelist", PM_ADDR, [{type:"function",name:"openWhitelist",inputs:[],outputs:[],stateMutability:"nonpayable"}], "openWhitelist")}>
                      {adminBusy === "Open Whitelist" ? "..." : "Open WL"}
                    </button>
                    <button className="btn-admin" disabled={!!adminBusy || adminPhase !== 1}
                      onClick={() => doAdmin("Open Public", PM_ADDR, [{type:"function",name:"openPublic",inputs:[],outputs:[],stateMutability:"nonpayable"}], "openPublic")}>
                      {adminBusy === "Open Public" ? "..." : "Open Public"}
                    </button>
                    <button className="btn-admin" disabled={!!adminBusy || adminPhase === 3 || adminPhase === 0}
                      onClick={() => doAdmin("End Mint", PM_ADDR, [{type:"function",name:"endMint",inputs:[],outputs:[],stateMutability:"nonpayable"}], "endMint")}>
                      {adminBusy === "End Mint" ? "..." : "End Mint"}
                    </button>
                  </div>
                </div>

                {/* ── Whitelist Root ── */}
                <div className="admin-card">
                  <h3 className="admin-card-title">Whitelist Root</h3>
                  <div className="admin-info">
                    <span style={{fontFamily:"monospace",fontSize:12,wordBreak:"break-all"}}>{wlRoot || "(not set)"}</span>
                  </div>
                  <div className="admin-actions" style={{flexDirection:"row",gap:8}}>
                    <input className="admin-input" placeholder="0x..." value={wlRootInput}
                      onChange={e => setWlRootInput(e.target.value)} style={{flex:1}} />
                    <button className="btn-admin" disabled={!!adminBusy || !wlRootInput}
                      onClick={() => { doAdmin("Set WL Root", NFT_ADDR, [{type:"function",name:"setWhitelistRoot",inputs:[{type:"bytes32"}],outputs:[],stateMutability:"nonpayable"}], "setWhitelistRoot", [wlRootInput]); setWlRootInput(""); }}>
                      Set
                    </button>
                  </div>
                </div>

                {/* ═══ SECTION A: LP Creation ═══ */}
                <div className="admin-card admin-card-wide">
                  <h3 className="admin-card-title">
                    <span className="material-icons-round" style={{fontSize:18,verticalAlign:"middle",marginRight:6}}>waves</span>
                    Section A: LP Creation {lpCreated ? "✅" : ""}
                  </h3>
                  <div className="admin-info">
                    <span>On-chain: <strong>{lpPileOnChain} PILE</strong> + <strong>{lpUsdgOnChain} USDG</strong></span>
                    {lpMarketCap && lpMarketCap.price !== "0.0" && (
                      <>
                        <span>PILE Price: <strong>${Number(lpMarketCap.price).toFixed(8)}</strong></span>
                        <span>FDV: <strong>${lpMarketCap.fdv}</strong> <small>(1B supply)</small></span>
                      </>
                    )}
                    {lpCreated && <span style={{color:"var(--color-primary)"}}>LP already created ✓</span>}
                  </div>
                  {!lpCreated && (
                    <>
                      <div className="admin-actions" style={{flexDirection:"row",gap:8}}>
                        <input className="admin-input" placeholder="PILE amount" value={lpPileInput}
                          onChange={e => setLpPileInput(e.target.value)} style={{flex:1}} type="number" />
                        <input className="admin-input" placeholder="USDG amount" value={lpUsdgInput}
                          onChange={e => setLpUsdgInput(e.target.value)} style={{flex:1}} type="number" />
                      </div>
                      <div className="admin-actions" style={{flexDirection:"row",gap:8,marginTop:8}}>
                        <input className="admin-input" placeholder="Min PILE out (slippage)" value={lpMinPileInput}
                          onChange={e => setLpMinPileInput(e.target.value)} style={{flex:1}} type="number" />
                        <input className="admin-input" placeholder="Min USDG out (slippage)" value={lpMinUsdgInput}
                          onChange={e => setLpMinUsdgInput(e.target.value)} style={{flex:1}} type="number" />
                      </div>
                      <p style={{fontSize:11,color:"var(--text-muted)",margin:"4px 0 0 0"}}>
                        Enter PILE tokens (e.g., 150000000 for 150M PILE) and USDG amount (e.g., pool20 value). Decimals handled automatically.
                      </p>
                      <div className="admin-actions">
                        <button className="btn-admin" disabled={!!adminBusy || !lpPileInput || !lpUsdgInput}
                          onClick={() => doAdmin("Set LP Amounts", TV_ADDR, [
                            {type:"function",name:"setLpAmounts",inputs:[{type:"uint256"},{type:"uint256"}],outputs:[],stateMutability:"nonpayable"}
                          ], "setLpAmounts", [ethers.parseUnits(lpPileInput || "0", 6), ethers.parseUnits(lpUsdgInput || "0", 6)])}>
                          Set LP Amounts
                        </button>
                        <button className="btn-admin" disabled={!!adminBusy || !lpPileOnChain || lpPileOnChain === "0.0"}
                          onClick={() => doAdmin("Create LP", TV_ADDR, [
                            {type:"function",name:"createLP",inputs:[{type:"uint256"},{type:"uint256"}],outputs:[{type:"uint256"}],stateMutability:"nonpayable"}
                          ], "createLP", [
                            ethers.parseUnits(lpMinPileInput || "0", 6),
                            ethers.parseUnits(lpMinUsdgInput || "0", 6)
                          ])}>
                          {adminBusy === "Create LP" ? "..." : "🚀 Create LP Position"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* ═══ SECTION B: PILE Airdrop ═══ */}
                <div className="admin-card admin-card-wide">
                  <h3 className="admin-card-title">
                    <span className="material-icons-round" style={{fontSize:18,verticalAlign:"middle",marginRight:6}}>card_giftcard</span>
                    Section B: PILE Airdrop
                  </h3>
                  <div className="admin-info">
                    <span>Recorded: <strong>{airdropOnChain} PILE</strong></span>
                    <span>Claims: <strong>{pileClaimsOpen ? "OPEN ✅" : "Closed"}</strong></span>
                    <span>Mint: <strong>{mintEnded ? "ENDED ✅" : "Active"}</strong></span>
                  </div>
                  <div className="admin-actions" style={{flexDirection:"row",gap:8}}>
                    <input className="admin-input" placeholder="PILE amount to airdrop" value={airdropAmount}
                      onChange={e => setAirdropAmount(e.target.value)} style={{flex:1}} type="number" />
                  </div>
                  <p style={{fontSize:11,color:"var(--text-muted)",margin:"4px 0 0 0"}}>
                    50% of PILE supply = 500M tokens. Enter token count (e.g., 500000000 for 500M PILE).
                  </p>
                  {!mintEnded && airdropOnChain !== "0.0" && (
                    <p style={{fontSize:12,color:"#e04040",margin:"4px 0 0 0"}}>
                      ⚠️ Mint must be ended before opening PILE claims.
                    </p>
                  )}
                  <div className="admin-actions">
                    <button className="btn-admin" disabled={!!adminBusy || !airdropAmount || airdropOnChain !== "0.0"}
                      onClick={() => doAdmin("Record Airdrop", TV_ADDR, [
                        {type:"function",name:"airdropPILE",inputs:[{type:"uint256"}],outputs:[],stateMutability:"nonpayable"}
                      ], "airdropPILE", [ethers.parseUnits(airdropAmount || "0", 6)])}>
                      Record Airdrop
                    </button>
                    <button className="btn-admin" disabled={!!adminBusy || airdropOnChain === "0.0" || pileClaimsOpen || !mintEnded}
                      onClick={() => doAdmin("Open PILE Claims", TV_ADDR, [
                        {type:"function",name:"openPileClaims",inputs:[],outputs:[],stateMutability:"nonpayable"}
                      ], "openPileClaims")}>
                      Open PILE Claims
                    </button>
                  </div>
                </div>

                {/* ═══ SECTION C: GOOGL Purchase ═══ */}
                <div className="admin-card admin-card-wide">
                  <h3 className="admin-card-title">
                    <span className="material-icons-round" style={{fontSize:18,verticalAlign:"middle",marginRight:6}}>shopping_cart</span>
                    Section C: GOOGL Purchase
                  </h3>
                  <div className="admin-info">
                    <span>Pool 80: <strong>{pool80Val} USDG</strong></span>
                    <span>GOOGL Held: <strong>{googlHeld} GOOGL</strong></span>
                    <span>Purchase: <strong>{purchaseDone ? "Done ✅" : "Pending"}</strong></span>
                    <span>Claims: <strong>{googlClaimsOpenVal ? "OPEN ✅" : "Closed"}</strong></span>
                  </div>
                  <div className="admin-actions" style={{flexDirection:"row",gap:8}}>
                    <input className="admin-input" placeholder={`USDG amount (max ${pool80Val})`} value={purchaseUsdgAmount}
                      onChange={e => setPurchaseUsdgAmount(e.target.value)}
                      style={{flex:1}} type="number" />
                    <input className="admin-input" placeholder="Min GOOGL out (slippage protection)" value={purchaseMinGoogl}
                      onChange={e => setPurchaseMinGoogl(e.target.value)}
                      style={{flex:1}} type="number" />
                  </div>
                  <div className="admin-actions">
                    <button className="btn-admin" disabled={!!adminBusy || purchaseDone || !purchaseUsdgAmount || parseFloat(purchaseUsdgAmount) <= 0 || parseFloat(purchaseUsdgAmount) > parseFloat(pool80Val)}
                      onClick={() => doAdmin("Purchase GOOGL", TV_ADDR, [
                        {type:"function",name:"purchaseGOOGL",inputs:[{type:"uint256"},{type:"uint256"}],outputs:[{type:"uint256"}],stateMutability:"nonpayable"}
                      ], "purchaseGOOGL", [ethers.parseUnits(purchaseUsdgAmount || "0", 6), ethers.parseUnits(purchaseMinGoogl || "0", 18)])}>
                      {adminBusy === "Purchase GOOGL" ? "..." : "🛒 Purchase GOOGL"}
                    </button>
                    <button className="btn-admin" disabled={!!adminBusy || !purchaseDone || googlClaimsOpenVal}
                      onClick={() => doAdmin("Open GOOGL Claims", TV_ADDR, [
                        {type:"function",name:"openGOOGLClaims",inputs:[],outputs:[],stateMutability:"nonpayable"}
                      ], "openGOOGLClaims")}>
                      Open GOOGL Claims
                    </button>
                  </div>
                </div>

                {/* ═══ SECTION D: Send PILE (Treasury) ═══ */}
                <div className="admin-card admin-card-wide">
                  <h3 className="admin-card-title">
                    <span className="material-icons-round" style={{fontSize:18,verticalAlign:"middle",marginRight:6}}>send</span>
                    Section D: Send PILE (Diamond Hands / Team / Ecosystem)
                  </h3>
                  <div className="admin-info">
                    <span>Remaining PILE in TV: check on explorer</span>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                    <input placeholder="Recipient address (0x...)" value={sendPileTo}
                      onChange={e => setSendPileTo(e.target.value)}
                      style={{flex:1,minWidth:200,padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14}} />
                    <input placeholder="Amount (PILE)" value={sendPileAmount}
                      onChange={e => setSendPileAmount(e.target.value)}
                      style={{width:160,padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14}} />
                    <input placeholder="Label (e.g. Diamond Hands)" value={sendPileLabel}
                      onChange={e => setSendPileLabel(e.target.value)}
                      style={{width:200,padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14}} />
                  </div>
                  <div className="admin-actions">
                    <button className="btn-admin" disabled={!!adminBusy || !sendPileTo || !sendPileAmount || !sendPileLabel}
                      onClick={() => {
                        doAdmin("Send PILE", TV_ADDR, [
                          {type:"function",name:"sendPILE",inputs:[{type:"address"},{type:"uint256"},{type:"string"}],outputs:[],stateMutability:"nonpayable"}
                        ], "sendPILE", [sendPileTo, ethers.parseUnits(sendPileAmount || "0", 6), sendPileLabel]);
                        setSendPileTo(""); setSendPileAmount(""); setSendPileLabel("");
                      }}>
                      {adminBusy === "Send PILE" ? "..." : "📤 Send PILE"}
                    </button>
                  </div>
                </div>

                {/* ═══ SECTION E: Send USDG (Treasury) ═══ */}
                <div className="admin-card admin-card-wide">
                  <h3 className="admin-card-title">
                    <span className="material-icons-round" style={{fontSize:18,verticalAlign:"middle",marginRight:6}}>payments</span>
                    Section E: Send USDG (Team / Expenses)
                  </h3>
                  <div className="admin-info">
                    <span>Available: <strong>Pool 80: {pool80Val} + Pool 20: {pool20Val}</strong> USDG</span>
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                    <input placeholder="Recipient address (0x...)" value={sendUsdgTo}
                      onChange={e => setSendUsdgTo(e.target.value)}
                      style={{flex:1,minWidth:200,padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14}} />
                    <input placeholder="Amount (USDG)" value={sendUsdgAmount}
                      onChange={e => setSendUsdgAmount(e.target.value)}
                      style={{width:160,padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14}} />
                    <input placeholder="Label (e.g. Team Pay)" value={sendUsdgLabel}
                      onChange={e => setSendUsdgLabel(e.target.value)}
                      style={{width:200,padding:"8px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,color:"#fff",fontSize:14}} />
                  </div>
                  <div className="admin-actions">
                    <button className="btn-admin" disabled={!!adminBusy || !sendUsdgTo || !sendUsdgAmount || !sendUsdgLabel}
                      onClick={() => {
                        doAdmin("Send USDG", TV_ADDR, [
                          {type:"function",name:"sendUSDG",inputs:[{type:"address"},{type:"uint256"},{type:"string"}],outputs:[],stateMutability:"nonpayable"}
                        ], "sendUSDG", [sendUsdgTo, ethers.parseUnits(sendUsdgAmount || "0", 6), sendUsdgLabel]);
                        setSendUsdgTo(""); setSendUsdgAmount(""); setSendUsdgLabel("");
                      }}>
                      {adminBusy === "Send USDG" ? "..." : "💵 Send USDG"}
                    </button>
                  </div>
                </div>

                {/* ── Mint Controls ── */}
                <div className="admin-card">
                  <h3 className="admin-card-title">Mint Controls</h3>
                  <div className="admin-actions">
                    <button className="btn-admin" disabled={!!adminBusy}
                      onClick={() => doAdmin("Stop Mint", NFT_ADDR, [{type:"function",name:"stopMint",inputs:[],outputs:[],stateMutability:"nonpayable"}], "stopMint")}>
                      Stop Mint
                    </button>
                    <button className="btn-admin" disabled={!!adminBusy}
                      onClick={() => doAdmin("Resume Mint", NFT_ADDR, [{type:"function",name:"resumeMint",inputs:[],outputs:[],stateMutability:"nonpayable"}], "resumeMint")}>
                      Resume Mint
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  </>
  );
}
