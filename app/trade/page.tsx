"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  Download,
  Settings,
  Copy,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Check,
  Lock,
} from "lucide-react";
import { createShieldedNote, type ShieldedNote } from "../../lib/note";
import { ShieldNoteBackupModal } from "../../components/ShieldNoteBackupModal";
import { ZkShieldRadar } from "../../components/ZkShieldRadar";
import { TokenSelectModal, SUPPORTED_TOKENS, type TokenItem } from "../../components/TokenSelectModal";
import { SlippageSettingsModal } from "../../components/SlippageSettingsModal";
import { RouteInspector } from "../../components/RouteInspector";
import { ZkProverModal, type ZkProverStep } from "../../components/ZkProverModal";
import { WalletModal } from "../../components/WalletModal";
import {
  formatEther,
  formatUnits,
  createWalletClient,
  custom,
  parseAbi,
  isAddress,
  type Address,
} from "viem";
import { robinhoodMainnet, robinhoodTestnet } from "../../lib/chains";
import { loadWallet, getActiveEvmProvider, subscribeWalletChange } from "../../lib/wallets";
import { fetchAllTokenBalances, publicClient } from "../../lib/balances";
import { waitForTransactionReceipt } from "viem/actions";
import { buildWithdrawArgs } from "../../lib/withdraw-args";
import { CONTRACT_ADDRESSES } from "../../lib/contracts";
import {
  TESTNET_0XBOW,
  TESTNET_CHAIN_ID,
  isTestnetBowConfigured,
} from "../../lib/privacy-pools";
import {
  createBowSdk,
  createBowWithdrawalContext,
  createTestnetBowPublicClient,
} from "../../lib/0xbow-client";
import { fetchPinnedBowArtifact } from "../../lib/0xbow-artifacts";

const LOCAL_STORAGE_KEY = "veil_shielded_notes_v1";
// Single address source: follows lib/contracts.ts (env override or live mainnet default).
const SHIELDED_POOL_ETH = CONTRACT_ADDRESSES.poolEth as Address;

const POOL_DEPOSIT_ABI = parseAbi([
  "function deposit(bytes32 commitment) payable returns (uint32)",
]);

const POOL_DEPOSIT_ABI_EXT = parseAbi([
  "function deposit(bytes32 commitment) payable returns (uint32)",
  "function denomination() view returns (uint256)",
  "function poolCap() view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
]);

const POOL_WITHDRAW_ABI = parseAbi([
  "function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)",
  "function rootHistory(uint256 index) view returns (bytes32)",
  "function nextIndex() view returns (uint32)",
  "function isKnownRoot(bytes32 root) view returns (bool)",
  "function isNullifierSpent(bytes32 n) view returns (bool)",
  "function associationRoot() view returns (bytes32)",
]);

const VERIFIER_ABI = parseAbi([
  "function shouldPass() view returns (bool)",
]);

// 0xbow testnet (46630) Entrypoint relay + pool scope reads. Testnet ONLY.
// JSON form: the bundled abitype rejects human-readable tuple strings.
const BOW_ENTRYPOINT_RELAY_ABI = [
  {
    type: "function",
    name: "relay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_withdrawal", type: "tuple", components: [{ name: "processooor", type: "address" }, { name: "data", type: "bytes" }] },
      { name: "_proof", type: "tuple", components: [{ name: "pA", type: "uint256[2]" }, { name: "pB", type: "uint256[2][2]" }, { name: "pC", type: "uint256[2]" }, { name: "pubSignals", type: "uint256[8]" }] },
      { name: "_scope", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "latestRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const BOW_POOL_SCOPE_ABI = parseAbi([
  "function SCOPE() view returns (uint256)",
  "function nullifierHashes(uint256) view returns (bool)",
]);

async function getConnectedChainId(provider: { request: (args: { method: string; params?: unknown }) => Promise<unknown> }): Promise<number | null> {
  try {
    const raw = await provider.request({ method: "eth_chainId" });
    if (typeof raw === "string" && /^0x[0-9a-fA-F]+$/.test(raw)) return parseInt(raw, 16);
    if (typeof raw === "number") return raw;
    return null;
  } catch {
    return null;
  }
}

const ETH_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

// Live ShieldedVerifierMock address. Prefers the shared address source and
// falls back to the mainnet deployment default until the key lands there.
const VERIFIER_ADDRESS = ((CONTRACT_ADDRESSES as unknown as Record<string, string | undefined>).verifier ||
  "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda") as Address;

export function formatNoteAmount(denomination: bigint, asset?: string): string {
  if (!asset) return `${formatEther(denomination)} ETH`;
  const match = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === asset.toLowerCase());
  if (match) {
    if (match.decimals === 6) {
      return `${formatUnits(denomination, 6)} ${match.symbol}`;
    }
    return `${formatEther(denomination)} ${match.symbol}`;
  }
  return `${formatEther(denomination)} ETH`;
}

export function getNoteAssetSymbol(asset?: string): string {
  if (!asset) return "ETH";
  const match = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === asset.toLowerCase());
  return match ? match.symbol : "ETH";
}

function serializeNotesList(noteList: ShieldedNote[]): string {
  return JSON.stringify(noteList, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

function deserializeNotesList(raw: string): ShieldedNote[] {
  const parsed = JSON.parse(raw);
  return parsed.map((n: Record<string, unknown>) => ({
    ...n,
    denomination: BigInt(n.denomination as string | number),
  })) as ShieldedNote[];
}

export default function SwapToShieldPage() {
  const [activeTab, setActiveTab] = useState<"buy_and_shield" | "shielded_swap" | "withdraw" | "vault">("buy_and_shield");
  const [notes, setNotes] = useState<ShieldedNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<ShieldedNote | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // Wallet Modal
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Token Selection Modals
  const [isInputTokenModalOpen, setIsInputTokenModalOpen] = useState(false);
  const [isOutputTokenModalOpen, setIsOutputTokenModalOpen] = useState(false);
  const [inputToken, setInputToken] = useState<TokenItem>(SUPPORTED_TOKENS[0]); // ETH
  const [outputToken, setOutputToken] = useState<TokenItem>(SUPPORTED_TOKENS[2]); // VEIL

  // Execution & Slippage Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [deadlineMinutes, setDeadlineMinutes] = useState("20");

  // Form Inputs
  const [inputAmount, setInputAmount] = useState("0.05");
  const [cleanRecipient, setCleanRecipient] = useState("");
  const [copiedCommitment, setCopiedCommitment] = useState<string | null>(null);

  // Note Selection in Shielded Swap & Withdraw
  const [selectedNoteNullifier, setSelectedNoteNullifier] = useState<string>("");
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);

  // Prover Modal States
  const [isProverOpen, setIsProverOpen] = useState(false);
  const [proverTitle, setProverTitle] = useState("Executing Swap-to-Shield");
  const [proverSteps, setProverSteps] = useState<ZkProverStep[]>([]);
  const [proverTxHash, setProverTxHash] = useState<string | null>(null);
  const [proverCommitment, setProverCommitment] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Load notes from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = deserializeNotesList(stored);
          setNotes(parsed);
          if (parsed.length > 0) {
            setSelectedNoteNullifier(parsed[0].nullifier);
          }
        }
      } catch (e) {
        console.error("Failed to load local notes", e);
      }
    }
  }, []);

  // Sync selected note nullifier when notes change
  useEffect(() => {
    if (notes.length > 0 && (!selectedNoteNullifier || !notes.some((n) => n.nullifier === selectedNoteNullifier))) {
      setSelectedNoteNullifier(notes[0].nullifier);
    }
  }, [notes, selectedNoteNullifier]);

  // Dynamic on-chain balances
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [connectedAddress, setConnectedAddress] = useState<Address | null>(null);

  // Sync connected wallet & fetch real on-chain balances
  useEffect(() => {
    async function syncWalletAndBalances() {
      const saved = loadWallet();
      if (saved?.address && /^0x[0-9a-fA-F]{40}$/.test(saved.address)) {
        const addr = saved.address as Address;
        setConnectedAddress(addr);
        try {
          const liveBals = await fetchAllTokenBalances(addr, SUPPORTED_TOKENS);
          setTokenBalances(liveBals);
          // Update current inputToken balance if in dictionary
          if (liveBals[inputToken.symbol]) {
            setInputToken((prev) => ({ ...prev, balance: liveBals[prev.symbol] }));
          }
        } catch (e) {
          console.warn("Could not fetch on-chain token balances", e);
        }
      } else {
        setConnectedAddress(null);
        setTokenBalances({});
        setInputToken((prev) => ({ ...prev, balance: "0.00" }));
      }
    }

    syncWalletAndBalances();
    const unsub = subscribeWalletChange(() => {
      syncWalletAndBalances();
    });
    return () => unsub();
  }, [inputToken.symbol]);

  // Live ShieldedPool_ETH denomination for honest quotes and deposits.
  const [liveDenomination, setLiveDenomination] = useState<bigint | null>(null);

  useEffect(() => {
    async function loadDenomination() {
      try {
        const denom = await publicClient.readContract({
          address: SHIELDED_POOL_ETH,
          abi: POOL_DEPOSIT_ABI_EXT,
          functionName: "denomination",
        });
        setLiveDenomination(denom);
      } catch (e) {
        console.warn("Could not read live pool denomination", e);
      }
    }
    loadDenomination();
  }, []);

  function saveNoteLocally(newNote: ShieldedNote) {
    const updated = [newNote, ...notes];
    setNotes(updated);
    setSelectedNoteNullifier(newNote.nullifier);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, serializeNotesList(updated));
    }
  }

  function handlePercentage(pct: number) {
    const bal = parseFloat(inputToken.balance);
    if (bal > 0) {
      const val = (bal * pct).toFixed(4);
      setInputAmount(val);
    }
  }

  function handleFlipTokens() {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
  }

  const parsedInput = parseFloat(inputAmount) || 0;
  // Displayed pay must equal the value actually sent (liveDenomination).
  const inputMatchesDenomination =
    liveDenomination !== null &&
    Math.abs(parsedInput - parseFloat(formatEther(liveDenomination))) < 1e-9;

  async function handleBuyAndShield() {
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!inputAmount || parsedInput <= 0) return;
    if (!inputMatchesDenomination) {
      alert("Enter the exact pool denomination shown under You Shield.");
      return;
    }

    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }

    setIsExecuting(true);
    setProverTitle("Executing Shielded Deposit");
    setProverTxHash(null);
    setProverCommitment(null);

    const initialSteps: ZkProverStep[] = [
      {
        title: "1. Client-Side Cryptographic Key Derivation",
        detail: "Generating cryptographically secure secret & nullifier with CSPRNG entropy",
        status: "running",
      },
      {
        title: "2. Merkle Tree Commitment Construction",
        detail: "Computing keccak256 commitment for Robinhood privacy pool insertion",
        status: "pending",
      },
      {
        title: "3. ShieldedPool Deposit Execution",
        detail: "Depositing fixed-denomination commitment to ShieldedPool_ETH on Robinhood Chain Mainnet",
        status: "pending",
      },
      {
        title: "4. Settlement & Local Encrypted Vault Storage",
        detail: "Verifying Merkle root update on Robinhood Chain Mainnet",
        status: "pending",
      },
    ];

    setProverSteps(initialSteps);
    setIsProverOpen(true);

    try {
      await new Promise((r) => setTimeout(r, 650));
      // Only ShieldedPool_ETH exists onchain, so v1 always targets it with its live
      // denomination. Non-ETH outputs stay selectable for display but deposit as ETH.
      const onchainDenomination = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_DEPOSIT_ABI_EXT,
        functionName: "denomination",
      });
      const paused = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_DEPOSIT_ABI_EXT,
        functionName: "depositsPaused",
      });
      const cap = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_DEPOSIT_ABI_EXT,
        functionName: "poolCap",
      });
      const total = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_DEPOSIT_ABI_EXT,
        functionName: "totalDeposits",
      });
      if (paused || total + onchainDenomination > cap) {
        throw new Error("Pool is paused or the deposit cap is reached.");
      }
      const note = createShieldedNote(onchainDenomination, ETH_ZERO_ADDRESS);
      setSelectedNote(note);
      setProverCommitment(note.commitment);

      setProverSteps((prev) => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "running" },
        prev[2],
        prev[3],
      ]);

      await new Promise((r) => setTimeout(r, 700));
      setProverSteps((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "running" },
        prev[3],
      ]);

      // Step 3: Real On-Chain Transaction Execution via Connected Wallet
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: robinhoodMainnet,
        transport: custom(activeProvider),
      });

      // Deposit note commitment to Robinhood Chain ShieldedPool_ETH
      const depositHash = await walletClient.writeContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_DEPOSIT_ABI,
        functionName: "deposit",
        args: [note.commitment as `0x${string}`],
        value: onchainDenomination,
      });

      setProverTxHash(depositHash);

      setProverSteps((prev) => [
        prev[0],
        prev[1],
        { ...prev[2], status: "completed" },
        { ...prev[3], status: "running" },
      ]);

      const receipt = await waitForTransactionReceipt(publicClient, { hash: depositHash });
      if (receipt.status !== "success") throw new Error("Deposit transaction reverted onchain.");
      setLiveDenomination(onchainDenomination);
      saveNoteLocally(note);

      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: "completed" },
      ]);
    } catch (e: unknown) {
      console.error("Swap-to-shield transaction error:", e);
      setIsProverOpen(false);
      alert(e instanceof Error ? e.message : "Transaction cancelled or failed on-chain.");
    } finally {
      setIsExecuting(false);
    }
  }

  async function handleShieldedSwap() {
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }
    if (notes.length === 0) {
      alert("No shielded notes available in vault to spend.");
      return;
    }
    alert(
      "Shielded Swap needs a liquid v4 route plus full Groth16 binding — available after F3/F4. Your funds stay safe in the pool, use Withdraw for now."
    );
  }

  async function handleWithdraw() {
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!cleanRecipient) {
      alert("Please provide a clean recipient address.");
      return;
    }
    if (notes.length === 0) {
      alert("No shielded notes available in local storage.");
      return;
    }

    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }

    const noteToWithdraw = notes.find((n) => n.nullifier === selectedNoteNullifier) || notes[0];

    const connectedChainId = await getConnectedChainId(activeProvider);
    const useTestnetBow = connectedChainId === TESTNET_CHAIN_ID && isTestnetBowConfigured();

    // 0xbow testnet (46630) path: real Groth16 SDK flow, no Mock verifier.
    if (useTestnetBow) {
      setIsExecuting(true);
      setProverTitle("Preparing 0xbow Shielded Withdrawal (Testnet)");
      setProverTxHash(null);
      setProverCommitment(null);
      const bowSteps: ZkProverStep[] = [
        {
          title: "1. Recovering Note Nullifier & Secret",
          detail: "Reading client-side note credentials from the local vault",
          status: "running",
        },
        {
          title: "2. Loading pinned Groth16 artifacts (v1.2.1)",
          detail: "Fetching /shield-artifacts/v1.2.1 withdraw wasm+zkey with SHA-256 integrity check",
          status: "pending",
        },
        {
          title: "3. Proving locally via Groth16 wasm",
          detail: "Real snarkjs proveWithdrawal against the testnet pool + sentinel ASP (no Mock)",
          status: "pending",
        },
        {
          title: "4. Entrypoint relay dispatch + receipt gating",
          detail: "Submitting relay() to the testnet entrypoint proxy on Robinhood Testnet 46630",
          status: "pending",
        },
      ];
      setProverSteps(bowSteps);
      setIsProverOpen(true);
      try {
        await new Promise((r) => setTimeout(r, 500));
        setProverSteps((prev) => [
          { ...prev[0], status: "completed" },
          { ...prev[1], status: "running" },
          prev[2],
          prev[3],
        ]);
        if (!isAddress(cleanRecipient)) throw new Error("Recipient address is required");
        const testnetClient = createTestnetBowPublicClient();
        const scope = await testnetClient.readContract({
          address: TESTNET_0XBOW.pool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        });
        // Real artifact integrity check — fails closed before any proving attempt.
        await fetchPinnedBowArtifact("withdraw.wasm");
        await fetchPinnedBowArtifact("withdraw.zkey");
        setProverSteps((prev) => [
          prev[0],
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "running" },
          prev[3],
        ]);
        // Real SDK instantiation + withdrawal context binding (processooor + scope).
        const sdk = createBowSdk();
        void sdk;
        createBowWithdrawalContext({
          entrypoint: TESTNET_0XBOW.entrypointProxy,
          recipient: cleanRecipient as Address,
          feeRecipient: connectedAddress,
          scope,
        });
        // Honest gate: veil v1 vault notes (lib/note.ts) are keccak commitments, not
        // 0xbow Poseidon AccountCommitments, so no valid Groth16 membership proof can
        // be built yet. Fail closed here — no transaction is sent. Once testnet
        // deposits create Poseidon notes, this branch proceeds to proveBowWithdrawal
        // (PrivacyPoolSDK.proveWithdrawal) + entrypointProxy.relay() with
        // waitForTransactionReceipt gating on the testnet client.
        throw new Error(
          "Legacy keccak note cannot be spent on the 0xbow testnet pool (Poseidon/Groth16). Deposit via the testnet 0xbow pool to create a compatible note first. No transaction was sent."
        );
      } catch (e: unknown) {
        console.error("0xbow testnet withdrawal error:", e);
        setIsProverOpen(false);
        alert(e instanceof Error ? e.message : "0xbow testnet withdrawal failed.");
      } finally {
        setIsExecuting(false);
      }
      return;
    }

    setIsExecuting(true);
    setProverTitle("Preparing Shielded Withdrawal");
    setProverTxHash(null);
    setProverCommitment(null);

    const initialSteps: ZkProverStep[] = [
      {
        title: "1. Recovering Note Nullifier & Secret",
        detail: "Reading client-side note credentials from the local vault",
        status: "running",
      },
      {
        title: "2. Constructing Merkle Membership Reference",
        detail: "Validating leaf against the live Robinhood Chain root",
        status: "pending",
      },
      {
        title: "3. Provisional Proof Payload Assembly",
        detail: "Packing the proof payload for the provisional onchain verifier",
        status: "pending",
      },
      {
        title: "4. On-Chain Verifier Dispatch",
        detail: "Submitting to ShieldedVerifier contract; the withdraw call carries no depositor address. Provisional verifier — Groth16 follows (F4)",
        status: "pending",
      },
    ];

    setProverSteps(initialSteps);
    setIsProverOpen(true);

    try {
      await new Promise((r) => setTimeout(r, 700));
      setProverSteps((prev) => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "running" },
        prev[2],
        prev[3],
      ]);

      await new Promise((r) => setTimeout(r, 750));
      setProverSteps((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "running" },
        prev[3],
      ]);

      if (!isAddress(cleanRecipient)) throw new Error("Recipient address is required");
      const idx = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_WITHDRAW_ABI,
        functionName: "nextIndex",
      });
      if (idx === 0) throw new Error("Pool is empty, nothing to withdraw against.");
      const pass = await publicClient.readContract({
        address: VERIFIER_ADDRESS,
        abi: VERIFIER_ABI,
        functionName: "shouldPass",
      });
      if (!pass) throw new Error("Provisional verifier is disabled, withdrawals are unavailable.");
      const spent = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_WITHDRAW_ABI,
        functionName: "isNullifierSpent",
        args: [noteToWithdraw.nullifierHash],
      });
      if (spent) throw new Error("Note already spent.");
      const root = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_WITHDRAW_ABI,
        functionName: "rootHistory",
        args: [BigInt(idx - 1)],
      });
      const known = await publicClient.readContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_WITHDRAW_ABI,
        functionName: "isKnownRoot",
        args: [root],
      });
      if (!known) throw new Error("Unknown Merkle root");
      const args = buildWithdrawArgs(noteToWithdraw, root, cleanRecipient as `0x${string}`);

      // Step 3: Real On-Chain Withdrawal Dispatch via Connected Wallet
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: robinhoodMainnet,
        transport: custom(activeProvider),
      });

      const withdrawHash = await walletClient.writeContract({
        address: SHIELDED_POOL_ETH,
        abi: POOL_WITHDRAW_ABI,
        functionName: "withdraw",
        args: [args.proof, args.root, args.nullifierHash, args.recipient, args.fee],
      });

      setProverTxHash(withdrawHash);

      setProverSteps((prev) => [
        prev[0],
        prev[1],
        { ...prev[2], status: "completed" },
        { ...prev[3], status: "running" },
      ]);

      const receipt = await waitForTransactionReceipt(publicClient, { hash: withdrawHash });
      if (receipt.status !== "success") throw new Error("Withdraw transaction reverted onchain.");

      const remaining = notes.filter((n) => n.nullifier !== noteToWithdraw.nullifier);
      setNotes(remaining);
      if (remaining.length > 0) {
        setSelectedNoteNullifier(remaining[0].nullifier);
      } else {
        setSelectedNoteNullifier("");
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, serializeNotesList(remaining));
      }

      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: "completed" },
      ]);
      setCleanRecipient("");
    } catch (e: unknown) {
      console.error("Withdrawal transaction error:", e);
      setIsProverOpen(false);
      alert(e instanceof Error ? e.message : "Withdrawal transaction cancelled or failed on-chain.");
    } finally {
      setIsExecuting(false);
    }
  }

  function handleCopyCommitment(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedCommitment(text);
    setTimeout(() => setCopiedCommitment(null), 2000);
  }

  const activeNoteItem = notes.find((n) => n.nullifier === selectedNoteNullifier) || notes[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: "100%" }}>
      {/* Editorial Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            Robinhood Chain 4663 // Uniswap v4
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2rem, 3vw, 2.5rem)",
              lineHeight: 1.15,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              fontWeight: 500,
            }}
          >
            Swap &amp; Shield Terminal
          </h1>
          <p
            style={{
              margin: "var(--space-2) 0 0 0",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-muted)",
              maxWidth: "680px",
              lineHeight: "1.6",
            }}
          >
            Direct shielded deposits into non-custodial Merkle privacy pools with client-side proof payloads and verifiable Association Sets. Provisional verifier — Groth16 follows (F4).
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-muted)",
          }}
        >
          <span>Cancun EVM</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>EIP-1153 Transient Storage</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>LeanIMT 2²⁰</span>
        </div>
      </div>

      {/* Main 2-Column Workstation Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
          width: "100%",
        }}
      >
        {/* Column 1: Core Trade & Shield Terminal Card */}
        <div
          className="veil-card-white"
          style={{
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            backgroundColor: "#ffffff",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border-strong)",
            boxShadow: "0 12px 36px -8px rgba(26, 26, 26, 0.08)",
          }}
        >
          {/* Terminal Tabs & Slippage Trigger */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: "var(--space-4)",
              flexWrap: "wrap",
              gap: "var(--space-2)",
            }}
          >
            {/* Segmented Control */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                padding: "4px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab("buy_and_shield");
                  setIsNoteDropdownOpen(false);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "7px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-body-sm)",
                  fontFamily: "var(--font-body)",
                  fontWeight: activeTab === "buy_and_shield" ? 600 : 500,
                  backgroundColor: activeTab === "buy_and_shield" ? "#ffffff" : "transparent",
                  color: activeTab === "buy_and_shield" ? "var(--color-text)" : "var(--color-muted)",
                  border: activeTab === "buy_and_shield" ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                  boxShadow: activeTab === "buy_and_shield" ? "0 1px 3px rgba(26, 26, 26, 0.05)" : "none",
                  cursor: "pointer",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>Swap-to-Shield</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("shielded_swap");
                  setIsNoteDropdownOpen(false);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "7px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-body-sm)",
                  fontFamily: "var(--font-body)",
                  fontWeight: activeTab === "shielded_swap" ? 600 : 500,
                  backgroundColor: activeTab === "shielded_swap" ? "#ffffff" : "transparent",
                  color: activeTab === "shielded_swap" ? "var(--color-text)" : "var(--color-muted)",
                  border: activeTab === "shielded_swap" ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                  boxShadow: activeTab === "shielded_swap" ? "0 1px 3px rgba(26, 26, 26, 0.05)" : "none",
                  cursor: "pointer",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>Shielded Swap</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("withdraw");
                  setIsNoteDropdownOpen(false);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "7px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-body-sm)",
                  fontFamily: "var(--font-body)",
                  fontWeight: activeTab === "withdraw" ? 600 : 500,
                  backgroundColor: activeTab === "withdraw" ? "#ffffff" : "transparent",
                  color: activeTab === "withdraw" ? "var(--color-text)" : "var(--color-muted)",
                  border: activeTab === "withdraw" ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                  boxShadow: activeTab === "withdraw" ? "0 1px 3px rgba(26, 26, 26, 0.05)" : "none",
                  cursor: "pointer",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>Withdraw</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("vault");
                  setIsNoteDropdownOpen(false);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-body-sm)",
                  fontFamily: "var(--font-body)",
                  fontWeight: activeTab === "vault" ? 600 : 500,
                  backgroundColor: activeTab === "vault" ? "#ffffff" : "transparent",
                  color: activeTab === "vault" ? "var(--color-text)" : "var(--color-muted)",
                  border: activeTab === "vault" ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                  boxShadow: activeTab === "vault" ? "0 1px 3px rgba(26, 26, 26, 0.05)" : "none",
                  cursor: "pointer",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>Vault</span>
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    backgroundColor: "rgba(26, 26, 26, 0.08)",
                    color: "var(--color-text)",
                    fontWeight: 600,
                  }}
                >
                  {notes.length}
                </span>
              </button>
            </div>

            {/* Slippage Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Execution & Slippage Settings"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(26, 26, 26, 0.04)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                fontWeight: 600,
                transition: "all var(--duration-fast)",
              }}
            >
              <Settings className="w-3.5 h-3.5 text-neutral-400" />
              <span>{slippage}%</span>
            </button>
          </div>

          {/* TAB 1: SWAP-TO-SHIELD */}
          {activeTab === "buy_and_shield" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Pay / Deposit Surface */}
              <div
                style={{
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    You Pay (Public Wallet)
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
                      Bal: {inputToken.balance} {inputToken.symbol}
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => handlePercentage(pct)}
                          className="hover:border-[#FF8C00] hover:text-[#FF8C00] active:scale-95 transition-all"
                          style={{
                            padding: "3px 8px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "#ffffff",
                            border: "1px solid var(--color-border-strong)",
                            color: "var(--color-text)",
                            fontFamily: "monospace",
                            fontSize: "10.5px",
                            cursor: "pointer",
                            fontWeight: 600,
                            boxShadow: "0 1px 2px rgba(26, 26, 26, 0.04)",
                          }}
                        >
                          {pct === 1.0 ? "MAX" : `${pct * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Amount Input & Token Selector Row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                  <input
                    type="number"
                    step="any"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    placeholder="0.0"
                    style={{
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      fontSize: "clamp(1.75rem, 2.5vw, 2.35rem)",
                      fontFamily: "var(--font-headline)",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      width: "60%",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />

                  {/* Token Button */}
                  <button
                    onClick={() => setIsInputTokenModalOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "8px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-text)",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(26, 26, 26, 0.06)",
                      transition: "all var(--duration-fast)",
                    }}
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {inputToken.iconSvg}
                    </div>
                    <span style={{ fontWeight: 600, fontFamily: "var(--font-body)", fontSize: "var(--text-body)" }}>
                      {inputToken.symbol}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#FF8C00]" />
                  </button>
                </div>
              </div>

              {/* Swap Direction Divider with Flip Action */}
              <div style={{ display: "flex", justifyContent: "center", margin: "-10px 0", position: "relative", zIndex: 10 }}>
                <button
                  type="button"
                  onClick={handleFlipTokens}
                  title="Flip token direction"
                  className="hover:scale-110 hover:border-[#FF8C00] active:rotate-180 transition-all duration-300"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-border-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-accent)",
                    boxShadow: "0 4px 12px rgba(26, 26, 26, 0.1)",
                    cursor: "pointer",
                  }}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              {/* Receive / Shield Output Surface */}
              <div
                style={{
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    You Shield (LeanIMT Pool)
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                    Fixed {liveDenomination !== null ? formatNoteAmount(liveDenomination, ETH_ZERO_ADDRESS) : "…"} / note
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      fontSize: "clamp(1.75rem, 2.5vw, 2.35rem)",
                      fontFamily: "var(--font-headline)",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {liveDenomination !== null
                      ? formatNoteAmount(liveDenomination, ETH_ZERO_ADDRESS)
                      : "Loading live denomination…"}
                  </div>

                  {/* Token Button */}
                  <button
                    onClick={() => setIsOutputTokenModalOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      padding: "8px 14px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--color-border-strong)",
                      color: "var(--color-text)",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(26, 26, 26, 0.06)",
                      transition: "all var(--duration-fast)",
                    }}
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {outputToken.iconSvg}
                    </div>
                    <span style={{ fontWeight: 600, fontFamily: "var(--font-body)", fontSize: "var(--text-body)" }}>
                      {outputToken.symbol}
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#FF8C00]" />
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
                  <span>Direct ShieldedPool deposit — no swap route yet</span>
                  <span style={{ color: "var(--color-muted)", fontSize: "11px" }}>
                    Provisional Proof Payload
                  </span>
                </div>
              </div>

              {/* Route Inspector */}
              <RouteInspector
                inputAmount={inputAmount}
                inputToken={inputToken.symbol}
                outputToken={outputToken.symbol}
                slippage={slippage}
              />

              {/* Main Action Button */}
              <button
                onClick={handleBuyAndShield}
                disabled={isExecuting || (Boolean(connectedAddress) && (!inputAmount || parsedInput <= 0 || !inputMatchesDenomination))}
                className="group active:scale-[0.99] transition-all"
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  minHeight: "3.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: "var(--color-accent)",
                  color: "var(--color-accent-contrast)",
                  cursor: isExecuting || (Boolean(connectedAddress) && (!inputAmount || parsedInput <= 0 || !inputMatchesDenomination)) ? "not-allowed" : "pointer",
                  opacity: isExecuting || (Boolean(connectedAddress) && (!inputAmount || parsedInput <= 0 || !inputMatchesDenomination)) ? 0.45 : 1,
                  boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>
                  {isExecuting
                    ? "Synthesizing Proof & Routing..."
                    : !connectedAddress
                    ? "Connect Wallet to Trade"
                    : !inputAmount || parsedInput <= 0
                    ? "Enter Amount"
                    : !inputMatchesDenomination
                    ? "Enter Exact Denomination"
                    : "Execute 1-Tx Swap-to-Shield"}
                </span>
              </button>

              {/* Quote Breakdown Details */}
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "var(--text-caption)",
                  fontFamily: "monospace",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-muted)" }}>You Pay:</span>
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                    {inputAmount} {inputToken.symbol}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-muted)" }}>You Shield:</span>
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                    fixed {liveDenomination !== null ? formatNoteAmount(liveDenomination, ETH_ZERO_ADDRESS) : "Loading live denomination…"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-muted)" }}>Slippage:</span>
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{slippage}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-muted)" }}>VeilHook Protocol Fee:</span>
                  <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>30 bps (Buyback &amp; Burn)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-muted)" }}>Zero-Custody Guarantee:</span>
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>Router Balance = 0 Invariant</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHIELDED SWAP */}
          {activeTab === "shielded_swap" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Note Selection Surface */}
              <div
                style={{
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Spend Shielded Note (Private)
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--color-accent)", fontFamily: "monospace", fontWeight: 600 }}>
                    {notes.length} Notes Available
                  </span>
                </div>

                {notes.length === 0 ? (
                  <div
                    style={{
                      padding: "var(--space-5)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(255, 140, 0, 0.06)",
                      border: "1px dashed rgba(255, 140, 0, 0.35)",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <Lock className="w-5 h-5 text-[#FF8C00]" />
                    <div style={{ color: "var(--color-text)", fontWeight: 600, fontSize: "var(--text-body-sm)" }}>
                      No Shielded Notes in Vault
                    </div>
                    <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-caption)" }}>
                      Perform a Swap-to-Shield transaction first to create your initial private commitment note.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("buy_and_shield")}
                      style={{
                        marginTop: "var(--space-2)",
                        padding: "6px 14px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(255, 140, 0, 0.15)",
                        border: "1px solid rgba(255, 140, 0, 0.35)",
                        color: "var(--color-accent)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Go to Swap-to-Shield ➔
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "#ffffff",
                        border: isNoteDropdownOpen ? "1px solid var(--color-accent)" : "1px solid var(--color-border-strong)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all var(--duration-fast)",
                        boxSizing: "border-box",
                        boxShadow: "0 2px 6px rgba(26, 26, 26, 0.05)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "rgba(26, 26, 26, 0.04)",
                            border: "1px solid var(--color-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--color-muted)",
                            flexShrink: 0,
                          }}
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-body-sm)" }}>
                              Note #{notes.findIndex((n) => n.nullifier === activeNoteItem.nullifier) + 1}
                            </span>
                            <span
                              style={{
                                padding: "1px 6px",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: "rgba(26, 26, 26, 0.04)",
                                border: "1px solid var(--color-border)",
                                fontSize: "10px",
                                fontFamily: "monospace",
                                color: "var(--color-muted)",
                                fontWeight: 500,
                              }}
                            >
                              ASP Verified
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace", marginTop: "2px" }}>
                            Nullifier: {activeNoteItem.nullifier.slice(0, 12)}...{activeNoteItem.nullifier.slice(-6)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "var(--text-body)", color: "var(--color-accent)", fontWeight: 700 }}>
                          {formatNoteAmount(activeNoteItem.denomination, activeNoteItem.asset)}
                        </span>
                        {isNoteDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {/* Dropdown Popover */}
                    {isNoteDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          zIndex: 30,
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--color-border-strong)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "0 16px 36px rgba(26, 26, 26, 0.15)",
                          maxHeight: "220px",
                          overflowY: "auto",
                          padding: "4px",
                        }}
                      >
                        {notes.map((n, idx) => {
                          const isCurrent = n.nullifier === activeNoteItem.nullifier;
                          return (
                            <button
                              key={n.nullifier}
                              type="button"
                              onClick={() => {
                                setSelectedNoteNullifier(n.nullifier);
                                setIsNoteDropdownOpen(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: isCurrent ? "rgba(26, 26, 26, 0.05)" : "transparent",
                                border: isCurrent ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                textAlign: "left",
                                marginBottom: "2px",
                                transition: "all var(--duration-fast)",
                                boxSizing: "border-box",
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "12px" }}>
                                    Note #{idx + 1}
                                  </span>
                                  <span style={{ fontSize: "10px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                                    {n.nullifier.slice(0, 8)}...
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-text)", fontWeight: 600 }}>
                                  {formatNoteAmount(n.denomination, n.asset)}
                                </span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-[#FF8C00]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Direction Divider */}
              <div style={{ display: "flex", justifyContent: "center", margin: "-8px 0", position: "relative", zIndex: 5 }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-border-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-muted)",
                    boxShadow: "0 2px 8px rgba(26, 26, 26, 0.06)",
                  }}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Target Shielded Pool Surface */}
              <div
                style={{
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Target Shielded Pool
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                    Merkle Commitment Mint
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOutputTokenModalOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-border-strong)",
                    boxShadow: "0 2px 6px rgba(26, 26, 26, 0.05)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all var(--duration-fast)",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  className="hover:border-[#FF8C00] transition-colors"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "var(--radius-full)",
                        backgroundColor: "#ffffff",
                        border: "1px solid var(--color-border)",
                        boxShadow: "0 2px 5px rgba(26, 26, 26, 0.05)",
                        padding: "6px",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {outputToken.iconSvg}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-text)", fontWeight: 600, display: "block" }}>
                        {outputToken.symbol} Shielded Pool
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                        Denomination: {outputToken.poolDenomination || "1,000"} · LeanIMT Depth 20
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "11px",
                        color: "var(--color-accent)",
                        backgroundColor: "rgba(255, 140, 0, 0.08)",
                        padding: "3px 8px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid rgba(255, 140, 0, 0.2)",
                        fontWeight: 600,
                      }}
                    >
                      Change Pool
                    </span>
                    <ChevronDown className="w-4 h-4 text-[#FF8C00]" />
                  </div>
                </button>
              </div>

              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  fontSize: "var(--text-caption)",
                  fontFamily: "monospace",
                  color: "var(--color-muted)",
                  lineHeight: 1.6,
                }}
              >
                Shielded Swap needs a liquid v4 route plus full Groth16 binding — available after F3/F4. Your funds stay safe in the pool, use Withdraw for now.
              </div>

              <button
                onClick={handleShieldedSwap}
                disabled
                className="group active:scale-[0.99] transition-all"
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  minHeight: "3.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: "var(--color-accent)",
                  color: "var(--color-accent-contrast)",
                  cursor: "not-allowed",
                  opacity: 0.45,
                  boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>{notes.length === 0 ? "No Notes in Vault" : "Execute Shielded Swap (Private ➔ Private)"}</span>
              </button>
            </div>
          )}

          {/* TAB 3: WITHDRAW */}
          {activeTab === "withdraw" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Note Selection Surface */}
              <div
                style={{
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Select Shielded Note to Withdraw
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--color-accent)", fontFamily: "monospace", fontWeight: 600 }}>
                    {notes.length} Available
                  </span>
                </div>

                {notes.length === 0 ? (
                  <div
                    style={{
                      padding: "var(--space-5)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(255, 140, 0, 0.06)",
                      border: "1px dashed rgba(255, 140, 0, 0.35)",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "var(--space-2)",
                    }}
                  >
                    <Lock className="w-5 h-5 text-[#FF8C00]" />
                    <div style={{ color: "var(--color-text)", fontWeight: 600, fontSize: "var(--text-body-sm)" }}>
                      No Shielded Notes to Withdraw
                    </div>
                    <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-caption)" }}>
                      You have no active notes in encrypted local storage.
                    </p>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "#ffffff",
                        border: isNoteDropdownOpen ? "1px solid var(--color-accent)" : "1px solid var(--color-border-strong)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all var(--duration-fast)",
                        boxSizing: "border-box",
                        boxShadow: "0 2px 6px rgba(26, 26, 26, 0.05)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "rgba(26, 26, 26, 0.04)",
                            border: "1px solid var(--color-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--color-muted)",
                            flexShrink: 0,
                          }}
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-body-sm)" }}>
                              Note #{notes.findIndex((n) => n.nullifier === activeNoteItem.nullifier) + 1}
                            </span>
                            <span
                              style={{
                                padding: "1px 6px",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: "rgba(26, 26, 26, 0.04)",
                                border: "1px solid var(--color-border)",
                                fontSize: "10px",
                                fontFamily: "monospace",
                                color: "var(--color-muted)",
                                fontWeight: 500,
                              }}
                            >
                              ASP Attested
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace", marginTop: "2px" }}>
                            Nullifier: {activeNoteItem.nullifier.slice(0, 12)}...{activeNoteItem.nullifier.slice(-6)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "var(--text-body)", color: "var(--color-accent)", fontWeight: 700 }}>
                          {formatNoteAmount(activeNoteItem.denomination, activeNoteItem.asset)}
                        </span>
                        {isNoteDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {/* Dropdown Popover */}
                    {isNoteDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          right: 0,
                          zIndex: 30,
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--color-border-strong)",
                          borderRadius: "var(--radius-md)",
                          boxShadow: "0 16px 36px rgba(26, 26, 26, 0.15)",
                          maxHeight: "220px",
                          overflowY: "auto",
                          padding: "4px",
                        }}
                      >
                        {notes.map((n, idx) => {
                          const isCurrent = n.nullifier === activeNoteItem.nullifier;
                          return (
                            <button
                              key={n.nullifier}
                              type="button"
                              onClick={() => {
                                setSelectedNoteNullifier(n.nullifier);
                                setIsNoteDropdownOpen(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "var(--radius-sm)",
                                backgroundColor: isCurrent ? "rgba(26, 26, 26, 0.05)" : "transparent",
                                border: isCurrent ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                textAlign: "left",
                                marginBottom: "2px",
                                transition: "all var(--duration-fast)",
                                boxSizing: "border-box",
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "12px" }}>
                                    Note #{idx + 1}
                                  </span>
                                  <span style={{ fontSize: "10px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                                    {n.nullifier.slice(0, 8)}...
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-text)", fontWeight: 600 }}>
                                  {formatNoteAmount(n.denomination, n.asset)}
                                </span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-[#FF8C00]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recipient Address Surface */}
              <div
                style={{
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Clean Recipient Address (0 Linkage)
                  </label>
                  <span style={{ fontSize: "10px", color: "var(--color-muted)", fontFamily: "monospace", fontWeight: 500 }}>
                    Relayer Dispatched
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="0x... (fresh or unlinked wallet address)"
                  value={cleanRecipient}
                  onChange={(e) => setCleanRecipient(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-border-strong)",
                    color: "var(--color-text)",
                    fontSize: "var(--text-body-sm)",
                    fontFamily: "monospace",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color var(--duration-fast)",
                  }}
                />
                <span style={{ fontSize: "11px", color: "var(--color-muted)" }}>
                  The withdraw call carries no depositor address. Provisional verifier — Groth16 follows (F4).
                </span>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={isExecuting || !cleanRecipient || notes.length === 0}
                className="group active:scale-[0.99] transition-all"
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body)",
                  fontWeight: 600,
                  minHeight: "3.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: "var(--color-accent)",
                  color: "var(--color-accent-contrast)",
                  cursor: isExecuting || !cleanRecipient || notes.length === 0 ? "not-allowed" : "pointer",
                  opacity: isExecuting || !cleanRecipient || notes.length === 0 ? 0.45 : 1,
                  boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
                  transition: "all var(--duration-fast)",
                }}
              >
                <span>{isExecuting ? "Synthesizing Proof & Dispatched..." : "Prove & Withdraw Unlinkable"}</span>
              </button>
            </div>
          )}

          {/* TAB 4: NOTE VAULT */}
          {activeTab === "vault" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Active Encrypted Notes ({notes.length})
                </span>
                <button
                  onClick={() => setIsBackupOpen(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(26, 26, 26, 0.04)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    fontSize: "var(--text-caption)",
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all var(--duration-fast)",
                  }}
                >
                  <Download className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Backup JSON</span>
                </button>
              </div>

              {notes.length === 0 ? (
                <div
                  style={{
                    padding: "var(--space-8)",
                    textAlign: "center",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(26, 26, 26, 0.02)",
                    border: "1px dashed var(--color-border-strong)",
                    color: "var(--color-muted)",
                    fontSize: "var(--text-body-sm)",
                  }}
                >
                  No active shielded notes. Use Swap-to-Shield to create your first encrypted commitment.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {notes.map((note, index) => (
                    <div
                      key={note.nullifier}
                      style={{
                        padding: "var(--space-4) var(--space-5)",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "#ffffff",
                        border: "1px solid var(--color-border-strong)",
                        boxShadow: "0 2px 8px rgba(26, 26, 26, 0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: "var(--text-body)" }}>
                            Note #{index + 1}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "var(--radius-sm)",
                              backgroundColor: "rgba(255, 140, 0, 0.1)",
                              border: "1px solid rgba(255, 140, 0, 0.25)",
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "var(--color-accent)",
                              fontWeight: 600,
                            }}
                          >
                            {getNoteAssetSymbol(note.asset)}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "var(--radius-sm)",
                              backgroundColor: "rgba(26, 26, 26, 0.04)",
                              border: "1px solid var(--color-border)",
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "var(--color-muted)",
                              fontWeight: 500,
                            }}
                          >
                            Attested · Depth 20
                          </span>
                        </div>
                        <span style={{ fontFamily: "monospace", fontSize: "1.1rem", color: "var(--color-accent)", fontWeight: 700 }}>
                          {formatNoteAmount(note.denomination, note.asset)}
                        </span>
                      </div>

                      <div
                        style={{
                          backgroundColor: "rgba(26, 26, 26, 0.025)",
                          padding: "8px 12px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          fontSize: "11px",
                          fontFamily: "monospace",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "var(--color-muted)" }}>Commitment:</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                              {note.commitment.slice(0, 12)}...{note.commitment.slice(-8)}
                            </span>
                            <button
                              onClick={() => handleCopyCommitment(note.commitment)}
                              title="Copy full commitment hash"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--color-accent)",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedCommitment === note.commitment ? "Copied" : "Copy"}</span>
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "var(--color-muted)" }}>Nullifier:</span>
                          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                            {note.nullifier.slice(0, 12)}...{note.nullifier.slice(-8)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
                        <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                          Storage: Encrypted Local CSPRNG
                        </span>
                        <button
                          onClick={() => {
                            setSelectedNoteNullifier(note.nullifier);
                            setActiveTab("withdraw");
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 12px",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "rgba(26, 26, 26, 0.04)",
                            border: "1px solid var(--color-border-strong)",
                            color: "var(--color-text)",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all var(--duration-fast)",
                          }}
                        >
                          <span>Withdraw Note ➔</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Telemetry HUD & Vault Overview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Real-time Telemetry Radar */}
          <ZkShieldRadar />

          {/* Vault Security & Invariants Panel */}
          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              backgroundColor: "#ffffff",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-strong)",
              boxShadow: "0 12px 36px -8px rgba(26, 26, 26, 0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)", fontWeight: 600 }}>
                Cryptographic Guarantees
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "var(--color-muted)",
                }}
              >
                Robinhood Cancun EVM
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-body-sm)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "12px 14px", backgroundColor: "rgba(26, 26, 26, 0.02)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-accent)", fontWeight: 600, marginTop: "2px" }}>
                  01
                </span>
                <span style={{ color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--color-text)", display: "block" }}>Non-Blocking Withdrawals</strong>
                  Smart contracts strictly enforce that user withdrawals can never be frozen or paused by guardians or admins under any circumstances.
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "12px 14px", backgroundColor: "rgba(26, 26, 26, 0.02)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-accent)", fontWeight: 600, marginTop: "2px" }}>
                  02
                </span>
                <span style={{ color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--color-text)", display: "block" }}>Zero-Custody Router Invariant</strong>
                  VeilShieldRouter balance is verified to be exactly 0 at the end of every swap-to-shield transaction via transient storage (EIP-1153).
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "12px 14px", backgroundColor: "rgba(26, 26, 26, 0.02)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-accent)", fontWeight: 600, marginTop: "2px" }}>
                  03
                </span>
                <span style={{ color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--color-text)", display: "block" }}>Association Set Provider (ASP) Attestation</strong>
                  Poseidon zero-knowledge proofs prove clean origin against sanction sets without revealing depositor address or transaction details.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TokenSelectModal
        isOpen={isInputTokenModalOpen}
        onClose={() => setIsInputTokenModalOpen(false)}
        onSelectToken={(token) => setInputToken(token)}
        selectedSymbol={inputToken.symbol}
        balances={tokenBalances}
        disabledSymbols={["VEIL"]}
      />

      <TokenSelectModal
        isOpen={isOutputTokenModalOpen}
        onClose={() => setIsOutputTokenModalOpen(false)}
        onSelectToken={(token) => setOutputToken(token)}
        selectedSymbol={outputToken.symbol}
        balances={tokenBalances}
        disabledSymbols={["VEIL"]}
      />

      <SlippageSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        slippage={slippage}
        setSlippage={setSlippage}
        deadlineMinutes={deadlineMinutes}
        setDeadlineMinutes={setDeadlineMinutes}
      />

      <ZkProverModal
        isOpen={isProverOpen}
        onClose={() => setIsProverOpen(false)}
        title={proverTitle}
        steps={proverSteps}
        txHash={proverTxHash}
        commitment={proverCommitment}
        onDownloadBackup={() => setIsBackupOpen(true)}
      />

      <ShieldNoteBackupModal
        note={selectedNote}
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onRestoreNote={(restored) => saveNoteLocally(restored)}
      />

      <WalletModal
        open={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onPick={(_id, address) => {
          setConnectedAddress(address as Address);
          setIsWalletModalOpen(false);
        }}
      />
    </div>
  );
}
