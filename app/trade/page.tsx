"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  ChevronDown,
  ArrowDown,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import {
  createShieldedNote,
  createBowDepositSecrets,
  createBowNote,
  isBowNote,
  getWithdrawPath,
  generateRandomBytes32,
  serializeNotesList,
  deserializeNotesList,
  deserializeAnyNote,
  savePendingNote,
  clearPendingNoteByTx,
  loadPendingNotes,
  type ShieldedNote,
  type AnyShieldedNote,
} from "../../lib/note";
import { ShieldNoteBackupModal } from "../../components/ShieldNoteBackupModal";
import { VaultPanel } from "../../components/trade/VaultPanel";
import { WithdrawPanel } from "../../components/trade/WithdrawPanel";
import { ShieldedSwapPanel } from "../../components/trade/ShieldedSwapPanel";
import { BuyAndShieldPanel } from "../../components/trade/BuyAndShieldPanel";
import { AttestPanel } from "../../components/trade/AttestPanel";
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
  parseEther,
  isAddress,
  type Address,
} from "viem";
import { appChain, APP_CHAIN_ID, explorerTxUrl } from "../../lib/chains";
import { loadWallet, getActiveEvmProvider, subscribeWalletChange, revalidateWallet } from "../../lib/wallets";
import { fetchAllTokenBalances, publicClient } from "../../lib/balances";
import { waitForTransactionReceipt } from "viem/actions";
import { buildWithdrawArgs } from "../../lib/withdraw-args";
import {
  formatNoteAmount as formatNoteAmountLib,
  getNoteAssetSymbol as getNoteAssetSymbolLib,
  ETH_ZERO_ADDRESS as ETH_ZERO_ADDRESS_LIB,
} from "../../lib/note-format";
import {
  resolveLegacyPoolForNote,
  type LegacyPoolCandidate,
} from "../../lib/legacy-pool-resolve";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from "../../lib/contracts";
import {
  buildSwapToShieldParams,
  findSwapToShieldExecuted,
  isRouterExecuteDisabled,
  mapRouterSwapError,
  parseSlippagePercent,
  pickVeilDestinationPool,
  quoteSwapToShieldOutput,
  readSwapGuards,
  readVeilAllowance,
  readVeilBalance,
  withAllowanceHint,
  PROVEN_SCRIPT_VEIL_AMOUNT_IN,
  TESTNET_LEGACY_ETH_POOL,
  TESTNET_ROUTER_ADDRESS,
  TESTNET_VEIL_DEST_POOLS,
  TESTNET_VEIL_POOL_05,
  TESTNET_VEIL_POOL_2,
  TESTNET_VEIL_POOL_05_DENOMINATION,
  TESTNET_VEIL_TOKEN,
  UINT128_MAX,
  VEIL_ERC20_ABI,
} from "../../lib/router-swap";
import { calculateSlippageBound } from "../../lib/router-client";
import {
  buildGatedHookInnerHash,
  buildGatedPoolId,
  buildGatedSwapTxArgs,
  buildSelfAttestInnerHash,
  buildSelfAttestProofRoot,
  decodeGatedSwapOutput,
  describeGatedSimRevert,
  encodeGatedHookData,
  GATED_EXPLORER_ADDRESS_BASE,
  GATED_EXPLORER_TX_BASE,
  GATED_HOOK_ADDRESS,
  GATED_POOL_ID,
  GATED_REGISTRY_ADDRESS,
  GATED_SWAPPER_ABI,
  GATED_SWAPPER_ADDRESS,
  GATED_TESTNET_CHAIN_ID,
  GATED_VEIL_TOKEN,
  isGatedExecuteDisabled,
  mapGatedSwapError,
  mapSelfAttestError,
  PROVEN_GATED_VEIL_AMOUNT_IN,
  readAttestationStatus,
  readGatingConfig,
  readVeilAllowanceGated,
  readVeilBalanceGated,
  simulateGatedSwapCall,
  VEIL_ERC20_MIN_ABI,
  type AttestationStatus,
  type GatingConfig,
} from "../../lib/gated-attest";
import {
  TESTNET_0XBOW,
  TESTNET_CHAIN_ID,
  MAINNET_CHAIN_ID,
  isTestnetBowConfigured,
  getBowSuite,
} from "../../lib/privacy-pools";
import {
  createBowSdk,
  createBowWithdrawalContext,
  createTestnetBowPublicClient,
  buildBowRelayContext,
  buildBowStateTree,
  fetchBowPoolEvents,
  fetchBowAspSet,
  proveBowWithdrawal,
} from "../../lib/0xbow-client";
import { fetchPinnedBowArtifact } from "../../lib/0xbow-artifacts";
import { buildBowAssociationSet, buildBowAssociationProof } from "../../lib/0xbow-association";
import { AccountService, type AccountCommitment } from "@0xbow/privacy-pools-core-sdk";
import { generateMnemonic, english } from "viem/accounts";
import {
  buildSelfRelayShieldedSwapArgs,
  getShieldedSwapRouteStatus,
  isShieldedSwapExecuteDisabled,
  readShieldedSwapRouteStatusLive,
  selectShieldedSwapRelayPath,
  shieldedSwapPendingMessage,
  SHIELDED_SWAP_DESTINATION_POOL,
  SHIELDED_SWAP_ROUTER,
  SHIELDED_SWAP_SOURCE_DENOMINATION,
  SHIELDED_SWAP_SOURCE_POOL,
} from "../../lib/shielded-swap-ui";
import {
  findShieldedSwapExecuted,
  generateNewShieldedNoteSecrets,
  mapShieldedSwapError,
} from "../../lib/shielded-swap";

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

const ETH_ZERO_ADDRESS = ETH_ZERO_ADDRESS_LIB;

// Live ShieldedVerifierMock address. Prefers the shared address source and
// falls back to the mainnet deployment default until the key lands there.
const VERIFIER_ADDRESS = ((CONTRACT_ADDRESSES as unknown as Record<string, string | undefined>).verifier ||
  "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda") as Address;

export function formatNoteAmount(denomination: bigint, asset?: string): string {
  // Moved to lib/note-format.ts (modularization) — re-exported here so any
  // existing deep import keeps working.
  return formatNoteAmountLib(denomination, asset);
}

export function getNoteAssetSymbol(asset?: string): string {
  return getNoteAssetSymbolLib(asset);
}

export default function SwapToShieldPage() {
  const [activeTab, setActiveTab] = useState<"buy_and_shield" | "shielded_swap" | "withdraw" | "vault">("buy_and_shield");
  const [notes, setNotes] = useState<AnyShieldedNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<AnyShieldedNote | null>(null);
  // Root-audit F3: the backup modal must encrypt the note the user asked
  // about (vault row or prover download), never a stale last-deposited note.
  const [backupNote, setBackupNote] = useState<AnyShieldedNote | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // Wallet Modal
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Token Selection Modals
  const [isInputTokenModalOpen, setIsInputTokenModalOpen] = useState(false);
  const [isOutputTokenModalOpen, setIsOutputTokenModalOpen] = useState(false);
  const [inputToken, setInputToken] = useState<TokenItem>(SUPPORTED_TOKENS[0]); // ETH
  const [outputToken, setOutputToken] = useState<TokenItem>(SUPPORTED_TOKENS[0]); // ETH (only live pool)

  // Execution & Slippage Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [deadlineMinutes, setDeadlineMinutes] = useState("20");

  // Testnet router path (Task 2): Buy & Shield defaults to the REAL
  // VeilShieldRouter.swapToShield route (VEIL -> ETH -> shielded ETH) on
  // chain 46630. Direct pool deposit stays as an explicit, honestly labeled
  // fallback only (forceDirect).
  const isTestnetBuild = APP_CHAIN_ID === TESTNET_CHAIN_ID;
  const [forceDirect, setForceDirect] = useState(false);
  const isTestnetRouterMode = isTestnetBuild && !forceDirect;
  const [veilAmountIn, setVeilAmountIn] = useState(PROVEN_SCRIPT_VEIL_AMOUNT_IN);
  const [routerQuote, setRouterQuote] = useState<{
    quotedOut: bigint;
    minAmountOut: bigint;
  } | null>(null);
  const [routerQuoteNote, setRouterQuoteNote] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [veilBalance, setVeilBalance] = useState<string | null>(null);
  // Quote refresh trigger (root-audit F13): bumped after in-flow approvals
  // so the displayed quote never lags the new allowance.
  const [quoteNonce, setQuoteNonce] = useState(0);
  // Live-picked VEIL destination (R3): set by the ETH-direction quote from
  // pickVeilDestinationPool; the execute handler re-picks live before sending.
  const [routerDestPool, setRouterDestPool] = useState<Address | null>(null);
  const [routerDestDenom, setRouterDestDenom] = useState<bigint | null>(null);

  // Testnet self-attest + gated pool (Task 3): live onchain attestation
  // status per connected address plus the gated ETH/VEIL pool config, read
  // from the v2 registry/hook (lib/gated-attest.ts). Untouched by T1/T2.
  const [attestation, setAttestation] = useState<AttestationStatus | null>(null);
  const [gating, setGating] = useState<GatingConfig | null>(null);
  const [isAttestLoading, setIsAttestLoading] = useState(false);
  const [isAttesting, setIsAttesting] = useState(false);
  const [attestTxHash, setAttestTxHash] = useState<string | null>(null);
  const [attestNote, setAttestNote] = useState<string | null>(null);
  const [gatedAmountIn, setGatedAmountIn] = useState(PROVEN_GATED_VEIL_AMOUNT_IN);
  const [isSimulatingGated, setIsSimulatingGated] = useState(false);
  const [gatedSimNote, setGatedSimNote] = useState<string | null>(null);
  const [isGatedSwapping, setIsGatedSwapping] = useState(false);
  const [gatedTxHash, setGatedTxHash] = useState<string | null>(null);

  // Testnet shielded swap (Task 4 + R3): VeilShieldRouter.shieldedSwap via the
  // connected wallet with the self-relay fallback (relayerFee 0). Route
  // status is live-read (lib/shielded-swap-ui.ts): both directions executable
  // via the fixed router; the source pool follows the spend note's asset.
  const [isShieldedSwapping, setIsShieldedSwapping] = useState(false);
  const [isShieldedProving, setIsShieldedProving] = useState(false);
  const [shieldedSwapTxHash, setShieldedSwapTxHash] = useState<string | null>(null);

  // Form Inputs
  const [inputAmount, setInputAmount] = useState("0.001");
  const [cleanRecipient, setCleanRecipient] = useState("");

  // Note Selection in Shielded Swap & Withdraw
  const [selectedNoteNullifier, setSelectedNoteNullifier] = useState<string>("");
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);

  // Prover Modal States
  const [isProverOpen, setIsProverOpen] = useState(false);
  const [proverTitle, setProverTitle] = useState("Executing Swap-to-Shield");
  const [proverSteps, setProverSteps] = useState<ZkProverStep[]>([]);
  const [proverTxHash, setProverTxHash] = useState<string | null>(null);
  const [proverCommitment, setProverCommitment] = useState<string | null>(null);
  // Root-audit F9: commitment is set pre-receipt; the modal may only claim
  // insertion after onchain confirmation.
  const [proverCommitted, setProverCommitted] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Inline flow error (replaces blocking alert() dialogs).
  const [flowError, setFlowError] = useState<string | null>(null);
  // Deep-audit #25: persistent storage-health flag (see banner below).
  const [vaultUnavailable, setVaultUnavailable] = useState(false);

  function switchTab(tab: "buy_and_shield" | "shielded_swap" | "withdraw" | "vault") {
    setActiveTab(tab);
    setIsNoteDropdownOpen(false);
    setFlowError(null);
  }

  // Load notes from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Storage health probe (deep-audit #25): a denied vault must be
      // visible, never a silent empty list.
      try {
        localStorage.setItem("__veil_storage_probe__", "1");
        localStorage.removeItem("__veil_storage_probe__");
      } catch {
        setVaultUnavailable(true);
      }
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
      // Reconcile crash leftovers (root-audit F5): notes journaled pre-receipt
      // whose tab closed before persistence. Runs async, never blocks load.
      void (async () => {
        try {
          const pending = loadPendingNotes();
          if (pending.length === 0) return;
          const { getTransactionReceipt } = await import("viem/actions");
          for (const p of pending) {
            let receipt: { status: string } | null = null;
            try {
              receipt = (await getTransactionReceipt(publicClient, {
                hash: p.txHash as `0x${string}`,
              })) as { status: string };
            } catch {
              continue; // No receipt yet — keep journaled, user retries manually.
            }
            if (!receipt || receipt.status !== "success") {
              clearPendingNoteByTx(p.txHash);
              continue;
            }
            try {
              const note = deserializeAnyNote(p.payload);
              setNotes((prev) =>
                prev.some((n) => n.nullifier === note.nullifier) ? prev : [note, ...prev]
              );
            } catch {
              // Corrupt payload — drop the journal entry, never brick the vault.
            }
            clearPendingNoteByTx(p.txHash);
          }
        } catch (e) {
          console.warn("Pending-note reconcile failed:", e);
        }
      })();
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

  // Task 3 live reads: attestation status + gating config from chain for the
  // connected address (never localStorage). Refreshes on wallet change.
  // Placed after connectedAddress is declared (TDZ-safe).
  useEffect(() => {
    if (!isTestnetBuild || activeTab !== "buy_and_shield" || !connectedAddress) {
      setAttestation(null);
      setGating(null);
      return;
    }
    let cancelled = false;
    setIsAttestLoading(true);
    (async () => {
      try {
        const [status, config] = await Promise.all([
          readAttestationStatus(publicClient, connectedAddress),
          readGatingConfig(publicClient),
        ]);
        if (cancelled) return;
        setAttestation(status);
        setGating(config);
      } catch (e) {
        if (!cancelled) console.warn("Could not read attestation/gating state", e);
      } finally {
        if (!cancelled) setIsAttestLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTestnetBuild, activeTab, connectedAddress]);

  // Live ShieldedPool_ETH denomination for honest quotes and deposits.
  const [liveDenomination, setLiveDenomination] = useState<bigint | null>(null);

  useEffect(() => {
    async function loadDenomination() {
      if (APP_CHAIN_ID === TESTNET_CHAIN_ID) {
        setLiveDenomination(1000000000000000n);
        return;
      }
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

  // Testnet router live quote (R1/R2): a REAL exact-output simulation — an
  // eth_call of the router's own swapToShield (minAmountOut = 0) against the
  // latest block. No hardcoded output. A random commitment is used because the
  // simulation persists nothing; execution re-simulates with the real note
  // commitment inside the send window before deriving minAmountOut.
  // Testnet router live quote (R1/R2): a REAL exact-output simulation — an
  // eth_call of the router's own swapToShield (minAmountOut = 0) against the
  // latest block. No hardcoded output.
  // Supports both ETH -> VEIL (zeroForOne=true) and VEIL -> ETH (zeroForOne=false).
  useEffect(() => {
    if (!isTestnetRouterMode || activeTab !== "buy_and_shield") return;
    const isEthInput = inputToken.symbol === "ETH";
    const amountStr = isEthInput ? inputAmount : veilAmountIn;
    let amountIn: bigint;
    try {
      amountIn = parseEther(amountStr);
    } catch {
      setRouterQuote(null);
      setRouterQuoteNote(`Enter a valid ${inputToken.symbol} amount to simulate the live router output.`);
      return;
    }
    if (amountIn <= 0n || amountIn > UINT128_MAX) {
      setRouterQuote(null);
      setRouterQuoteNote(`Enter a ${inputToken.symbol} amount greater than zero to simulate the live router output.`);
      return;
    }
    if (!connectedAddress) {
      setRouterQuote(null);
      setRouterDestPool(null);
      setRouterDestDenom(null);
      setRouterQuoteNote("Connect a wallet to simulate the live router output.");
      return;
    }
    let cancelled = false;
    setIsQuoting(true);
    const timer = setTimeout(() => {
      (async () => {
        let preAllow = 0n;
        let slippagePct = 0.5;
        try {
          slippagePct = parseSlippagePercent(slippage);
        } catch {
          slippagePct = 0.5;
        }
        try {
          if (isEthInput) {
            const quotedOut = await quoteSwapToShieldOutput(publicClient, {
              account: connectedAddress,
              amountIn,
              commitment: generateRandomBytes32(),
              zeroForOne: true,
              shieldedPool: TESTNET_VEIL_POOL_05,
            });
            const minAmountOut = calculateSlippageBound(quotedOut, slippagePct);
            if (cancelled) return;
            setRouterQuote({ quotedOut, minAmountOut });

            const [g05, g2] = await Promise.all([
              readSwapGuards(publicClient, TESTNET_VEIL_POOL_05),
              readSwapGuards(publicClient, TESTNET_VEIL_POOL_2),
            ]);
            const veilPools = [
              { pool: TESTNET_VEIL_POOL_05, denomination: g05.denomination, asset: TESTNET_VEIL_TOKEN, paused: g05.paused, cap: g05.cap, total: g05.total },
              { pool: TESTNET_VEIL_POOL_2, denomination: g2.denomination, asset: TESTNET_VEIL_TOKEN, paused: g2.paused, cap: g2.cap, total: g2.total },
            ];
            const picked = pickVeilDestinationPool(quotedOut, veilPools);
            setRouterDestPool(picked ? picked.pool : null);
            setRouterDestDenom(picked ? picked.denomination : null);
            setRouterQuoteNote(
              !picked
                ? "Live simulated output is below the 0.5 VEIL note denomination. Increase the ETH input; execution stays disabled until the route can fund a full note."
                : null
            );
          } else {
            const [bal, allow] = await Promise.all([
              readVeilBalance(publicClient, connectedAddress),
              readVeilAllowance(publicClient, connectedAddress),
            ]);
            preAllow = allow;
            if (!cancelled) setVeilBalance(formatEther(bal));
            const quotedOut = await quoteSwapToShieldOutput(publicClient, {
              account: connectedAddress,
              amountIn,
              commitment: generateRandomBytes32(),
              zeroForOne: false,
              shieldedPool: TESTNET_LEGACY_ETH_POOL,
            });
            const minAmountOut = calculateSlippageBound(quotedOut, slippagePct);
            if (cancelled) return;
            setRouterQuote({ quotedOut, minAmountOut });
            setRouterDestPool(null);
            setRouterDestDenom(null);
            setRouterQuoteNote(
              quotedOut < (liveDenomination ?? 1000000000000000n)
                ? "Live simulated output is below the 0.001 ETH note denomination. Increase the VEIL input; execution stays disabled until the route can fund a full note."
                : null
            );
          }
        } catch (e: unknown) {
          if (cancelled) return;
          setRouterQuote(null);
          setRouterDestPool(null);
          setRouterDestDenom(null);
          // Review fix I-2: surface the ACTUAL revert reason first
          setRouterQuoteNote(
            `${withAllowanceHint(mapRouterSwapError(e), !isEthInput && preAllow < amountIn)} (Slippage setting: ${slippagePct}%. Raise it in Execution Settings if the quote trails the market.)`
          );
        } finally {
          if (!cancelled) setIsQuoting(false);
        }
      })();
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isTestnetRouterMode, activeTab, veilAmountIn, inputAmount, inputToken.symbol, connectedAddress, slippage, liveDenomination, quoteNonce]);

  function saveNoteLocally(newNote: AnyShieldedNote) {
    const updated = [newNote, ...notes.filter((n) => n.nullifier !== newNote.nullifier)];
    setNotes(updated);
    setSelectedNoteNullifier(newNote.nullifier);
    if (typeof window !== "undefined") {
      // Root-audit hardening: a silent storage failure here used to strand
      // funds with a success-looking UI. Verify the write by reading back.
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, serializeNotesList(updated));
        const check = localStorage.getItem(LOCAL_STORAGE_KEY) || "";
        if (!check.includes(newNote.nullifier.slice(2, 10))) {
          throw new Error("vault write verification failed");
        }
      } catch (e: unknown) {
        throw new Error(
          "Browser vault storage failed — your note was NOT saved. Copy the commitment from the prover modal and retry. " +
            (e instanceof Error ? e.message : "Storage unavailable.")
        );
      }
    }
  }

  // Double-submit guard (root-audit F6, deep-audit hardening): React state
  // flips async, so two clicks in the same tick both enter a handler. This
  // counter is synchronous. Counter (not boolean): concurrent early-returns
  // inside try still hit finally, and decrement-returns-to-zero stays exact.
  // Acquire inside the main try of each send handler; every finally decrements.
  const txInFlight = useRef(0);

  // User-facing expiry for signatures the wallet signs (root-audit F2): the
  // Execution Settings "Transaction Deadline" actually drives these instead
  // of hardcoded TTLs. Clamped to [5 minutes, 24 hours].
  function userDeadlineSeconds(): number {
    const minutes = Number.parseFloat(deadlineMinutes);
    if (!Number.isFinite(minutes)) return 20 * 60;
    return Math.min(86400, Math.max(300, Math.floor(minutes * 60)));
  }

  function handlePercentage(pct: number) {
    const bal = parseFloat(inputToken.balance);
    if (bal > 0) {
      const val = (bal * pct).toFixed(4);
      if (isTestnetRouterMode && inputToken.symbol === "VEIL") {
        setVeilAmountIn(val);
      } else {
        setInputAmount(val);
      }
    }
  }

  function handleFlipTokens() {
    if (isTestnetRouterMode) {
      if (inputToken.symbol === "ETH") {
        const veilToken = SUPPORTED_TOKENS.find((t) => t.symbol === "VEIL") || {
          ...SUPPORTED_TOKENS[0],
          symbol: "VEIL",
          name: "Veil Protocol Token",
          address: TESTNET_VEIL_TOKEN,
        };
        setInputToken(veilToken);
        setOutputToken(SUPPORTED_TOKENS[0]);
      } else {
        const veilToken = SUPPORTED_TOKENS.find((t) => t.symbol === "VEIL") || {
          ...SUPPORTED_TOKENS[0],
          symbol: "VEIL",
          name: "Veil Protocol Token",
          address: TESTNET_VEIL_TOKEN,
        };
        setInputToken(SUPPORTED_TOKENS[0]);
        setOutputToken(veilToken);
      }
      return;
    }
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
  }

  // Router pay direction follows the selected pay token (R3): ETH -> VEIL
  // deposits into a VEIL pool, anything else -> VEIL branch (fixed router
  // route). Anything that is not ETH pays VEIL.
  const routerPaySymbol = inputToken.symbol === "ETH" ? "ETH" : "VEIL";
  const isEthRouterInput = isTestnetRouterMode && routerPaySymbol === "ETH";
  const parsedInput = parseFloat(inputAmount) || 0;
  // Displayed pay must equal the value actually sent (liveDenomination).
  const inputMatchesDenomination =
    liveDenomination !== null &&
    Math.abs(parsedInput - parseFloat(formatEther(liveDenomination))) < 1e-9;

  // Router-path input validity (uint128-bounded, R1). Null disables
  // execution; the reason is shown in the quote panel, never an alert().
  let parsedRouterIn: bigint | null = null;
  try {
    const candidate = parseEther(isEthRouterInput ? inputAmount : veilAmountIn);
    if (candidate > 0n && candidate <= UINT128_MAX) parsedRouterIn = candidate;
  } catch {
    parsedRouterIn = null;
  }
  const parsedVeilIn = parsedRouterIn;
  const routerQuoteBelowDenomination =
    routerQuote !== null &&
    (isEthRouterInput
      ? routerQuote.quotedOut < TESTNET_VEIL_POOL_05_DENOMINATION
      : (liveDenomination !== null && routerQuote.quotedOut < liveDenomination));
  // Buy CTA state, computed once and shared with BuyAndShieldPanel.
  const buyCtaDisabled = isTestnetRouterMode
    ? isRouterExecuteDisabled({
        isExecuting,
        connected: Boolean(connectedAddress),
        veilInValid: parsedVeilIn !== null,
        quoteBelowDenomination: routerQuoteBelowDenomination,
        isQuoting,
        hasQuote: routerQuote !== null,
      })
    : isExecuting ||
      (Boolean(connectedAddress) &&
        (!inputAmount || parsedInput <= 0 || !inputMatchesDenomination));

  // Router pay-token toggle target (R3): full TokenItem so balances follow.
  function selectRouterPayToken(sym: "VEIL" | "ETH") {
    if (sym === "ETH") {
      setInputToken({ ...SUPPORTED_TOKENS[0] });
    } else {
      const veilEntry = SUPPORTED_TOKENS.find((t) => t.symbol === "VEIL");
      if (veilEntry) {
        setInputToken({ ...veilEntry, address: TESTNET_VEIL_TOKEN });
      }
    }
  }

  // Task 3 gated-path VEIL input validity. Null disables gated execution;
  // the reason is shown in the gated panel, never an alert().
  let parsedGatedIn: bigint | null = null;
  try {
    const gatedCandidate = parseEther(gatedAmountIn);
    if (gatedCandidate > 0n) parsedGatedIn = gatedCandidate;
  } catch {
    parsedGatedIn = null;
  }

  // Testnet router execution (Task 2 & R3): REAL VeilShieldRouter.swapToShield via
  // the connected wallet on chain 46630.
  // Supports both directions honestly:
  // - ETH in -> VEIL out -> exact-denomination deposit into VEIL pool (0.5 or 2 VEIL) with msg.value
  // - VEIL in -> ETH out -> exact-denomination deposit into legacy ETH pool (0.001 ETH)
  async function handleRouterSwapToShield(
    activeProvider: NonNullable<ReturnType<typeof getActiveEvmProvider>>,
    connectedChainId: number | null
  ) {
    if (connectedChainId !== null && connectedChainId !== TESTNET_CHAIN_ID) {
      setFlowError(
        "The router swap-to-shield route lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }
    let slippagePct: number;
    // Read-only parse runs unguarded; the guard is acquired inside the main
    // try below so validation failures can never leak it (deep-audit F1).
    try {
      slippagePct = parseSlippagePercent(slippage);
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Invalid slippage setting.");
      return;
    }
    if (parsedRouterIn === null) {
      setFlowError(`Enter a valid ${inputToken.symbol} amount greater than zero.`);
      return;
    }
    const amountIn = parsedRouterIn;
    // Review fix I-1 (defense in depth): never send a real approve+swap tx
    // while the live quote is missing or still simulating. The button is
    // disabled in this state; this guard covers keyboard/programmatic clicks.
    if (
      isRouterExecuteDisabled({
        isExecuting,
        connected: Boolean(connectedAddress),
        veilInValid: parsedRouterIn !== null,
        quoteBelowDenomination: routerQuoteBelowDenomination,
        isQuoting,
        hasQuote: routerQuote !== null,
      })
    ) {
      setFlowError(
        "Live router quote is not ready yet — wait for the simulated output to load. No transaction was sent."
      );
      return;
    }

    setIsExecuting(true);
    setProverTitle(
      isEthRouterInput
        ? "Executing Router Swap-to-Shield (ETH -> VEIL Note)"
        : "Executing Router Swap-to-Shield (VEIL -> ETH Note)"
    );
    setProverTxHash(null);
    setProverCommitment(null);
    setProverCommitted(false);
    setProverSteps([
      {
        title: "1. Client-Side Commitment Key Derivation",
        detail: "Generating secret & nullifier with CSPRNG entropy for the exact-denomination note",
        status: "running",
      },
      {
        title: "2. Live Guards & Output Simulation",
        detail: "Reading pool denomination, pause and cap, then simulating swapToShield via eth_call",
        status: "pending",
      },
      {
        title: "3. VeilShieldRouter.swapToShield Execution",
        detail: isEthRouterInput
          ? "Swapping native ETH to VEIL into the shielded pool with value attached"
          : "Approving VEIL when needed, then swapping VEIL to ETH into the shielded pool",
        status: "pending",
      },
      {
        title: "4. Invariant Assert & Vault Storage",
        detail: "Verifying SwapToShieldExecuted and the router zero-balance invariant, then persisting the note",
        status: "pending",
      },
    ]);
    setIsProverOpen(true);

    try {
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
      const walletClient = createWalletClient({
        account: connectedAddress as Address,
        chain: appChain,
        transport: custom(activeProvider),
      });

      if (isEthRouterInput) {
        // ETH -> VEIL direction
        const ethBal = await publicClient.getBalance({ address: connectedAddress as Address });
        if (ethBal < amountIn) {
          throw new Error("Insufficient testnet ETH balance to fund this swap and pay gas.");
        }

        const [g05, g2] = await Promise.all([
          readSwapGuards(publicClient, TESTNET_VEIL_POOL_05),
          readSwapGuards(publicClient, TESTNET_VEIL_POOL_2),
        ]);
        const veilPools = [
          { pool: TESTNET_VEIL_POOL_05, denomination: g05.denomination, asset: TESTNET_VEIL_TOKEN, paused: g05.paused, cap: g05.cap, total: g05.total },
          { pool: TESTNET_VEIL_POOL_2, denomination: g2.denomination, asset: TESTNET_VEIL_TOKEN, paused: g2.paused, cap: g2.cap, total: g2.total },
        ];

        // Fresh live quote inside the send window
        const freshOut = await quoteSwapToShieldOutput(publicClient, {
          account: connectedAddress as Address,
          amountIn,
          commitment: generateRandomBytes32(),
          zeroForOne: true,
          shieldedPool: TESTNET_VEIL_POOL_05,
        });
        const destPool = pickVeilDestinationPool(freshOut, veilPools);
        if (!destPool) {
          throw new Error(
            "Live simulated output is below the VEIL destination pool denomination (InsufficientOutputForDenomination). Increase the ETH input and try again. No transaction was sent."
          );
        }

        const note = createShieldedNote(destPool.denomination, TESTNET_VEIL_TOKEN);
        setProverCommitment(note.commitment);
        setProverSteps((prev) => [
          { ...prev[0], status: "completed" },
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "running" },
          prev[3],
        ]);

        const minAmountOut = calculateSlippageBound(freshOut, slippagePct);
        const params = buildSwapToShieldParams({
          amountIn,
          quotedOut: freshOut,
          slippagePercent: slippagePct,
          commitment: note.commitment,
          zeroForOne: true,
          shieldedPool: destPool.pool,
        });

        const routerBalBefore = await publicClient.getBalance({
          address: TESTNET_ROUTER_ADDRESS,
        });

        // Drift re-check (testnet-final): abort if the wallet account or
        // chain changed since handler entry. No transaction was sent.
        await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
        const swapHash = await walletClient.writeContract({
          address: TESTNET_ROUTER_ADDRESS,
          abi: CONTRACT_ABIS.VeilShieldRouter,
          functionName: "swapToShield",
          args: [params],
          value: amountIn,
        });
        setProverTxHash(swapHash);
        // Journal pre-receipt (root-audit F5): crash between send and persist
        // must not strand secrets.
        savePendingNote(note, swapHash, destPool.pool);
        setProverSteps((prev) => [
          prev[0],
          prev[1],
          { ...prev[2], status: "completed" },
          { ...prev[3], status: "running" },
        ]);

        const receipt = await waitForTransactionReceipt(publicClient, { hash: swapHash });
        if (receipt.status !== "success") {
          throw new Error("Router swap-to-shield transaction reverted onchain.");
        }
        const executed = findSwapToShieldExecuted(receipt.logs, note.commitment, connectedAddress as Address);
        if (!executed) {
          throw new Error(
            "SwapToShieldExecuted event not found for this commitment. Treating the deposit as unverified: the note was NOT saved. Check the transaction in your wallet history."
          );
        }
        if (executed.shieldedPool.toLowerCase() !== destPool.pool.toLowerCase()) {
          throw new Error(
            "Swap settled into an unexpected shielded pool. The note was NOT saved. Check the transaction on the explorer before retrying."
          );
        }
        const routerBalAfter = await publicClient.getBalance({
          address: TESTNET_ROUTER_ADDRESS,
        });
        if (routerBalAfter !== routerBalBefore) {
          throw new Error(
            "Router safety invariant failed: router ETH balance changed across the swap (NonZeroBalanceInvariantFailed). The note was NOT saved — verify the transaction on the explorer before retrying."
          );
        }
        // VEIL leg of the invariant (R2 live-B asserted routerVeilAfter 0):
        // the router must not retain any swap output.
        const routerVeilAfter = await readVeilBalance(publicClient, TESTNET_ROUTER_ADDRESS);
        if (routerVeilAfter !== 0n) {
          throw new Error(
            "Router safety invariant failed: router holds VEIL after the swap (NonZeroBalanceInvariantFailed). The note was NOT saved — verify the transaction on the explorer before retrying."
          );
        }

        setSelectedNote(note);
        saveNoteLocally(note);
        clearPendingNoteByTx(swapHash);
        setProverCommitted(true);
        setProverSteps((prev) => [
          prev[0],
          prev[1],
          prev[2],
          { ...prev[3], status: "completed" },
        ]);
        setIsProverOpen(true);
      } else {
        // VEIL -> ETH direction (existing proven path)
        const guards = await readSwapGuards(publicClient);
        if (guards.paused) {
          throw new Error("Shielded ETH pool deposits are paused. No transaction was sent.");
        }
        if (guards.total + guards.denomination > guards.cap) {
          throw new Error("Shielded ETH pool cap is reached. No transaction was sent.");
        }
        const veilBal = await readVeilBalance(publicClient, connectedAddress as Address);
        if (veilBal < amountIn) {
          throw new Error(
            `Insufficient test VEIL balance. The router route needs ${formatEther(amountIn)} test VEIL (${TESTNET_VEIL_TOKEN}) already in your wallet — the proven script ran on a pre-funded operator balance and there is no onchain faucet. Fund test VEIL and try again.`
          );
        }
        setProverSteps((prev) => [
          { ...prev[0], status: "completed" },
          { ...prev[1], status: "running" },
          prev[2],
          prev[3],
        ]);

        const allowance = await readVeilAllowance(publicClient, connectedAddress as Address);
        if (allowance < amountIn) {
          await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
          const approveHash = await walletClient.writeContract({
              address: TESTNET_VEIL_TOKEN,
              abi: VEIL_ERC20_ABI,
              functionName: "approve",
              args: [TESTNET_ROUTER_ADDRESS, amountIn],
            });
          const approveReceipt = await waitForTransactionReceipt(publicClient, {
            hash: approveHash,
          });
          if (approveReceipt.status !== "success") {
            throw new Error("VEIL approval reverted onchain. No swap was sent.");
          }
          // Allowance changed: refresh the displayed quote (root-audit F13).
          setQuoteNonce((n) => n + 1);
        }

        const note = createShieldedNote(guards.denomination, ETH_ZERO_ADDRESS);
        setProverCommitment(note.commitment);

        const routerBalBefore = await publicClient.getBalance({
          address: TESTNET_ROUTER_ADDRESS,
        });
        const freshOut = await quoteSwapToShieldOutput(publicClient, {
          account: connectedAddress as Address,
          amountIn,
          commitment: note.commitment,
          zeroForOne: false,
          shieldedPool: TESTNET_LEGACY_ETH_POOL,
        });
        if (freshOut < guards.denomination) {
          throw new Error(
            "Live simulated output is below the 0.001 ETH shielded-note denomination (InsufficientOutputForDenomination). Increase the VEIL input and try again. No transaction was sent."
          );
        }
        const minAmountOut = calculateSlippageBound(freshOut, slippagePct);
        setRouterQuote({ quotedOut: freshOut, minAmountOut });
        setProverSteps((prev) => [
          prev[0],
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "running" },
          prev[3],
        ]);

        const params = buildSwapToShieldParams({
          amountIn,
          quotedOut: freshOut,
          slippagePercent: slippagePct,
          commitment: note.commitment,
          zeroForOne: false,
          shieldedPool: TESTNET_LEGACY_ETH_POOL,
        });
        await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
        const swapHash = await walletClient.writeContract({
          address: TESTNET_ROUTER_ADDRESS,
          abi: CONTRACT_ABIS.VeilShieldRouter,
          functionName: "swapToShield",
          args: [params],
        });
        setProverTxHash(swapHash);
        savePendingNote(note, swapHash, TESTNET_LEGACY_ETH_POOL);
        setProverSteps((prev) => [
          prev[0],
          prev[1],
          { ...prev[2], status: "completed" },
          { ...prev[3], status: "running" },
        ]);

        const receipt = await waitForTransactionReceipt(publicClient, { hash: swapHash });
        if (receipt.status !== "success") {
          throw new Error("Router swap-to-shield transaction reverted onchain.");
        }
        const executed = findSwapToShieldExecuted(receipt.logs, note.commitment, connectedAddress as Address);
        if (!executed) {
          throw new Error(
            "SwapToShieldExecuted event not found for this commitment. Treating the deposit as unverified: the note was NOT saved. Check the transaction in your wallet history."
          );
        }
        if (executed.shieldedPool.toLowerCase() !== TESTNET_LEGACY_ETH_POOL.toLowerCase()) {
          throw new Error(
            "Swap settled into an unexpected shielded pool. The note was NOT saved. Check the transaction on the explorer before retrying."
          );
        }
        const routerBalAfter = await publicClient.getBalance({
          address: TESTNET_ROUTER_ADDRESS,
        });
        if (routerBalAfter !== routerBalBefore) {
          throw new Error(
            "Router safety invariant failed: router ETH balance changed across the swap (NonZeroBalanceInvariantFailed). The note was NOT saved — verify the transaction on the explorer before retrying."
          );
        }
        // VEIL leg of the invariant (deep-audit S3): VEIL-in leg must also
        // leave zero VEIL behind (approval pull + forceApprove pattern).
        const routerVeilAfter = await readVeilBalance(publicClient, TESTNET_ROUTER_ADDRESS);
        if (routerVeilAfter !== 0n) {
          throw new Error(
            "Router safety invariant failed: router holds VEIL after the swap (NonZeroBalanceInvariantFailed). The note was NOT saved — verify the transaction on the explorer before retrying."
          );
        }

        setLiveDenomination(guards.denomination);
        setSelectedNote(note);
        saveNoteLocally(note);
        clearPendingNoteByTx(swapHash);
        setProverCommitted(true);
        setProverSteps((prev) => [
          prev[0],
          prev[1],
          prev[2],
          { ...prev[3], status: "completed" },
        ]);
        setIsProverOpen(true);
      }
    } catch (e: unknown) {
      console.error("Router swap-to-shield transaction error:", e);
      setIsProverOpen(false);
      setFlowError(mapRouterSwapError(e, slippagePct));
    } finally {
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  // Task 3: re-read attestation + gating from chain (refresh button and
  // after attest/swap transactions confirm). Live chain state only.
  async function refreshAttestationState(): Promise<void> {
    if (!connectedAddress) return;
    setIsAttestLoading(true);
    try {
      const [status, config] = await Promise.all([
        readAttestationStatus(publicClient, connectedAddress),
        readGatingConfig(publicClient),
      ]);
      setAttestation(status);
      setGating(config);
    } catch (e) {
      console.warn("Could not read attestation/gating state", e);
    } finally {
      setIsAttestLoading(false);
    }
  }

  // Task 3 (R1/R2): permissionless self-attestation via the connected wallet
  // (1 tx). Mirrors scripts/selfattest-hook-v2.mjs: fresh proof root, live
  // nonce, deadline now+3600s, EIP-191 personal_sign (no gas), then
  // registry.selfAttest. Already attested -> status only, no tx.
  async function handleSelfAttest() {
    setFlowError(null);
    setAttestNote(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }
    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }
    const connectedChainId = await getConnectedChainId(activeProvider);
    if (connectedChainId !== GATED_TESTNET_CHAIN_ID) {
      setFlowError(
        "Self-attestation lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }
    setIsAttesting(true);
    try {
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
      const live = await readAttestationStatus(publicClient, connectedAddress);
      setAttestation(live);
      if (live.attested) {
        setAttestNote("This address is already attested onchain. No transaction was sent.");
        return;
      }
      const proofRoot = buildSelfAttestProofRoot();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + userDeadlineSeconds());
      const inner = buildSelfAttestInnerHash({
        registry: GATED_REGISTRY_ADDRESS,
        chainId: BigInt(GATED_TESTNET_CHAIN_ID),
        user: connectedAddress,
        proofRoot,
        nonce: live.nonce,
        deadline,
      });
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });
      const signature = await walletClient.signMessage({ message: { raw: inner } });
      await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
      const attestHash = await walletClient.writeContract({
        address: GATED_REGISTRY_ADDRESS,
        abi: CONTRACT_ABIS.VeilAttestationRegistry,
        functionName: "selfAttest",
        args: [proofRoot, deadline, signature],
      });
      const receipt = await waitForTransactionReceipt(publicClient, { hash: attestHash });
      if (receipt.status !== "success") {
        throw new Error("Self-attestation transaction reverted onchain.");
      }
      setAttestTxHash(attestHash);
      setGatedSimNote(null);
      await refreshAttestationState();
      setAttestNote("Self-attestation confirmed onchain. The gated pool simulation below should now pass.");
    } catch (e: unknown) {
      console.error("Self-attestation error:", e);
      setFlowError(mapSelfAttestError(e));
    } finally {
      setIsAttesting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  // Task 3 (R4): gas-free eth_call simulation of the exact gated-swap
  // calldata. The wallet signs the hookData message (no gas), then the node
  // executes swapExactIn against latest state. Pre-attest the hook reverts
  // with GatingActiveUserNotAttested; post-attest the same call succeeds.
  async function handleSimulateGatedSwap() {
    setFlowError(null);
    setGatedSimNote(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }
    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }
    const connectedChainId = await getConnectedChainId(activeProvider);
    if (connectedChainId !== GATED_TESTNET_CHAIN_ID) {
      setFlowError(
        "The gated pool lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. Nothing was simulated."
      );
      return;
    }
    let amountIn: bigint;
    try {
      amountIn = parseEther(gatedAmountIn);
      if (amountIn <= 0n) throw new Error("non-positive");
    } catch {
      setFlowError("Enter a valid VEIL amount greater than zero to simulate.");
      return;
    }
    setIsSimulatingGated(true);
    try {
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + userDeadlineSeconds());
      const inner = buildGatedHookInnerHash({
        hook: GATED_HOOK_ADDRESS,
        chainId: BigInt(GATED_TESTNET_CHAIN_ID),
        user: connectedAddress,
        poolId: buildGatedPoolId(),
        deadline,
      });
      const signature = await walletClient.signMessage({ message: { raw: inner } });
      const hookData = encodeGatedHookData({ user: connectedAddress, deadline, signature });
      const result = await simulateGatedSwapCall(publicClient, {
        from: connectedAddress,
        amountIn,
        hookData,
      });
      if (result.ok) {
        setGatedSimNote(
          "Gas-free simulation passed: the gated pool would accept this swap for your address (eth_call succeeded, no gas spent)."
        );
      } else {
        setGatedSimNote(result.message);
      }
    } catch (e: unknown) {
      console.error("Gated simulation error:", e);
      setFlowError(mapGatedSwapError(e));
    } finally {
      setIsSimulatingGated(false);
    }
  }

  // Task 3 (R3): gated-pool swap execution with signature-bound hookData.
  // Mirrors scripts/gated-swap-v2.mjs swapAs: approve VEIL for the swapper,
  // then swapExactIn({key, zeroForOne=false, amountIn, minOut=1n, hookData,
  // inputToken=VEIL}). Fail closed: live attestation pre-check first, since
  // an unattested execution would revert onchain and burn gas.
  async function handleGatedSwap() {
    setFlowError(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }
    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }
    const connectedChainId = await getConnectedChainId(activeProvider);
    if (connectedChainId !== GATED_TESTNET_CHAIN_ID) {
      setFlowError(
        "The gated pool lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }
    let amountIn: bigint;
    try {
      amountIn = parseEther(gatedAmountIn);
      if (amountIn <= 0n) throw new Error("non-positive");
    } catch {
      setFlowError("Enter a valid VEIL amount greater than zero.");
      return;
    }
    const live = await readAttestationStatus(publicClient, connectedAddress);
    setAttestation(live);
    if (!live.attested) {
      setFlowError(
        "This address is not attested yet. The gated pool would reject the swap (GatingActiveUserNotAttested) and burn gas — self-attest above first, then execute. No transaction was sent."
      );
      return;
    }
    const veilBal = await readVeilBalanceGated(publicClient, connectedAddress);
    if (veilBal < amountIn) {
      setFlowError(
        `Insufficient test VEIL balance. The gated route needs ${formatEther(amountIn)} test VEIL (${GATED_VEIL_TOKEN}) already in your wallet — there is no onchain faucet. Fund test VEIL and try again.`
      );
      return;
    }
    setIsGatedSwapping(true);
    try {
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });
      const allowance = await readVeilAllowanceGated(publicClient, connectedAddress);
      if (allowance < amountIn) {
          await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
          const approveHash = await walletClient.writeContract({
              address: GATED_VEIL_TOKEN,
              abi: VEIL_ERC20_MIN_ABI,
              functionName: "approve",
              args: [GATED_SWAPPER_ADDRESS, amountIn],
            });
        const approveReceipt = await waitForTransactionReceipt(publicClient, {
          hash: approveHash,
        });
        if (approveReceipt.status !== "success") {
          throw new Error("VEIL approval reverted onchain. No swap was sent.");
        }
        setQuoteNonce((n) => n + 1);
      }
      const deadline = BigInt(Math.floor(Date.now() / 1000) + userDeadlineSeconds());
      const inner = buildGatedHookInnerHash({
        hook: GATED_HOOK_ADDRESS,
        chainId: BigInt(GATED_TESTNET_CHAIN_ID),
        user: connectedAddress,
        poolId: buildGatedPoolId(),
        deadline,
      });
      const signature = await walletClient.signMessage({ message: { raw: inner } });
      const hookData = encodeGatedHookData({ user: connectedAddress, deadline, signature });
      // Slippage-bound minOut (root-audit F1): fresh gas-free simulation with
      // the EXACT calldata being sent, then bound by the user's slippage
      // setting. Replaces the old verbatim minOut=1n (no protection).
      const simSlippage = (() => {
        try {
          return parseSlippagePercent(slippage);
        } catch {
          return 0.5;
        }
      })();
      const preSim = await simulateGatedSwapCall(publicClient, {
        from: connectedAddress,
        amountIn,
        hookData,
      });
      if (!preSim.ok) {
        throw new Error(
          `Pre-send simulation rejected this swap (${preSim.reason}). No transaction was sent.`
        );
      }
      const simOut = decodeGatedSwapOutput(preSim.returnData);
      const txArgs = buildGatedSwapTxArgs({
        from: connectedAddress,
        amountIn,
        hookData,
        minOut: calculateSlippageBound(simOut, simSlippage),
      });
      await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
      const swapHash = await walletClient.writeContract({
        address: GATED_SWAPPER_ADDRESS,
        abi: GATED_SWAPPER_ABI,
        functionName: "swapExactIn",
        args: [...txArgs],
      });
      const receipt = await waitForTransactionReceipt(publicClient, { hash: swapHash });
      if (receipt.status !== "success") {
        throw new Error("Gated swap transaction reverted onchain.");
      }
      setGatedTxHash(swapHash);
      setGatedSimNote("Gated swap confirmed onchain (VEIL in, ETH out through the gated pool). Explorer link below.");
    } catch (e: unknown) {
      console.error("Gated swap error:", e);
      setFlowError(mapGatedSwapError(e));
    } finally {
      setIsGatedSwapping(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  async function handleBuyAndShield() {
    setFlowError(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }

    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }

    const connectedChainId = await getConnectedChainId(activeProvider);
    // Testnet default (Task 2): the REAL router path
    // (VeilShieldRouter.swapToShield). Direct pool deposit remains available
    // only through the honestly labeled fallback toggle.
    if (isTestnetRouterMode) {
      await handleRouterSwapToShield(activeProvider, connectedChainId);
      return;
    }

    if (!inputAmount || parsedInput <= 0) return;
    if (!inputMatchesDenomination) {
      setFlowError(
        `Enter the exact pool denomination shown under You Shield (${liveDenomination !== null ? formatNoteAmount(liveDenomination, ETH_ZERO_ADDRESS) : "live value"}).`
      );
      return;
    }
    const useTestnetBow =
      (connectedChainId === TESTNET_CHAIN_ID || (!connectedChainId && APP_CHAIN_ID === TESTNET_CHAIN_ID)) &&
      isTestnetBowConfigured();

    setIsExecuting(true);
    setProverTitle(useTestnetBow ? "Executing 0xbow Shielded Deposit (Testnet)" : "Executing Shielded Deposit");
    setProverTxHash(null);
    setProverCommitment(null);
    setProverCommitted(false);

    const initialSteps: ZkProverStep[] = useTestnetBow
      ? [
          {
            title: "1. Client-Side 0xbow Key Derivation",
            detail: "Deriving nullifier, secret & precommitment using BIP-39 entropy & Poseidon hash",
            status: "running",
          },
          {
            title: "2. Privacy Pools Precommitment Preparation",
            detail: "Binding commitment preimage to Testnet Privacy Pool scope",
            status: "pending",
          },
          {
            title: "3. On-Chain Deposit Execution",
            detail: "Calling entrypointProxy.deposit() with 0.001 ETH on Robinhood Testnet",
            status: "pending",
          },
          {
            title: "4. Settlement, ASP Sync & Local Vault Storage",
            detail: "Confirming block receipt, syncing Association Set & persisting note",
            status: "pending",
          },
        ]
      : [
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
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
      if (useTestnetBow) {
        await new Promise((r) => setTimeout(r, 400));
        const testnetClient = createTestnetBowPublicClient();
        const scope = await testnetClient.readContract({
          address: TESTNET_0XBOW.pool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        });

        const secrets = createBowDepositSecrets(scope);
        setProverCommitment(secrets.precommitment.toString());

        setProverSteps((prev) => [
          { ...prev[0], status: "completed" },
          { ...prev[1], status: "running" },
          prev[2],
          prev[3],
        ]);

        await new Promise((r) => setTimeout(r, 400));
        setProverSteps((prev) => [
          prev[0],
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "running" },
          prev[3],
        ]);

        const walletClient = createWalletClient({
          account: connectedAddress,
          chain: appChain,
          transport: custom(activeProvider),
        });

        const depositDenomination = 1000000000000000n; // 0.001 ETH
        // Deep-audit note: denomination is intentionally pinned to
        // TESTNET_0XBOW_META.denominationWei (no onchain per-asset minimum is
        // exposed for native-ETH pools via assetConfig). A pool reconfig
        // fails closed downstream (commitment/value checks), never silently.
        await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
        const depositHash = await walletClient.writeContract({
          address: TESTNET_0XBOW.entrypointProxy,
          abi: parseAbi(["function deposit(uint256 _precommitmentHash) payable returns (uint256)"]),
          functionName: "deposit",
          args: [secrets.precommitment],
          value: depositDenomination,
        });

        setProverTxHash(depositHash);
        setProverSteps((prev) => [
          prev[0],
          prev[1],
          { ...prev[2], status: "completed" },
          { ...prev[3], status: "running" },
        ]);

        const receipt = await waitForTransactionReceipt(testnetClient, { hash: depositHash });
        if (receipt.status !== "success") throw new Error("0xbow deposit transaction reverted onchain.");

        const poolLogs = await testnetClient.getContractEvents({
          address: TESTNET_0XBOW.pool,
          abi: parseAbi([
            "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)",
          ]),
          eventName: "Deposited",
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });
        const ownLog = poolLogs.find(
          (l) => l.transactionHash.toLowerCase() === depositHash.toLowerCase()
        );
        if (!ownLog)
          throw new Error(
            "Deposit confirmed but our Deposited event was not found in the receipt block. No note was saved. Check the transaction on the explorer and retry with a fresh deposit."
          );

        const label = BigInt(ownLog.args._label ?? 0n);
        const onchainValue = BigInt(ownLog.args._value ?? 0n);
        if (onchainValue !== depositDenomination) {
          throw new Error("Deposited value mismatch: onchain event does not match the 0.001 ETH denomination.");
        }
        const bowNote = createBowNote({
          scope,
          denomination: depositDenomination,
          label,
          nullifier: secrets.nullifier,
          secret: secrets.secret,
          precommitment: secrets.precommitment,
          txHash: depositHash,
          blockNumber: receipt.blockNumber,
          chainId: TESTNET_CHAIN_ID,
        });

        // Commitment recompute check: locally derived Poseidon commitment must
        // match the onchain Deposited event (script parity).
        if (BigInt(bowNote.commitmentHash) !== BigInt(ownLog.args._commitment ?? 0n)) {
          throw new Error("Commitment derivation mismatch between local note and onchain event.");
        }

        setSelectedNote(bowNote);
        setProverCommitment(bowNote.commitmentHash);
        // Journal first (root-audit F5), then confirm: crash between here and
        // the vault write must not strand secrets.
        savePendingNote(bowNote, depositHash, TESTNET_0XBOW.pool);
        saveNoteLocally(bowNote);
      clearPendingNoteByTx(depositHash);
      setProverCommitted(true);
        setProverCommitted(true);

        fetch("/api/asp/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: label.toString() }),
        }).catch((err) => console.warn("Background ASP sync:", err));

        setProverSteps((prev) => [
          prev[0],
          prev[1],
          prev[2],
          { ...prev[3], status: "completed" },
        ]);
        setIsProverOpen(true);
        return;
      }

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
        chain: appChain,
        transport: custom(activeProvider),
      });

      // Deposit note commitment to Robinhood Chain ShieldedPool_ETH
      await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
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
      // Direct-path event proof (root-audit F4): the note is persisted only
      // when its commitment actually entered the tree — same bar as the
      // router and 0xbow paths.
      const directLogs = await publicClient.getContractEvents({
        address: SHIELDED_POOL_ETH,
        abi: parseAbi([
          "event Deposit(uint32 indexed index, bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp)",
        ]),
        eventName: "Deposit",
        args: { commitment: note.commitment as `0x${string}` },
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      if (directLogs.length === 0) {
        throw new Error(
          "Deposit confirmed but our commitment was not found in the receipt block. The note was NOT saved. Check the transaction on the explorer before retrying."
        );
      }
      setLiveDenomination(onchainDenomination);
      savePendingNote(note, depositHash, SHIELDED_POOL_ETH);
      saveNoteLocally(note);
      clearPendingNoteByTx(depositHash);

      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: "completed" },
      ]);
      // Surface the result even if the user hid the modal mid-proof.
      setIsProverOpen(true);
    } catch (e: unknown) {
      console.error("Swap-to-shield transaction error:", e);
      setIsProverOpen(false);
      setFlowError(
        e instanceof Error
          ? e.message
          : "Transaction cancelled or failed on-chain. Check your wallet and try again."
      );
    } finally {
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  // Task 4 (R1/R2/R4): the Shielded Swap tab executes REAL
  // VeilShieldRouter.shieldedSwap via the connected wallet on chain 46630 —
  // source-pool withdraw with proof-bound params (recipient = router itself)
  // -> v4 ETH/VEIL swap -> deposit of newCommitment into the destination
  // pool, with relayerFee 0 (self-relay default: the user pays gas). No
  // hardcoded minOut: a zero-floor eth_call simulation returns the live
  // output first, then minAmountOut derives from it and the user's slippage.
  //
  // R3 live gate (load-bearing, Task 4b): the pools MUST exist AND be unpaused
  // onchain, and the v4 route must be liquid — enforced by
  // readShieldedSwapRouteStatusLive below, never by config alone.
  // Both directions executable via the FIXED router (R1 settle fix, proven
  // live R2): the source pool follows the selected note's asset (ETH notes ->
  // ETH pool, VEIL notes -> matching VEIL pool); the destination is the live
  // readable opposite-asset pool. 0xbow notes are rejected (router needs
  // legacy withdraw interface) with directions to Withdraw instead.
  // The post-gate execution path below is real (not stubbed).
  async function handleShieldedSwap() {
    setFlowError(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }
    if (notes.length === 0) {
      setFlowError("No shielded notes available in vault to spend. Create one via Swap-to-Shield first.");
      return;
    }
    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }
    const connectedChainId = await getConnectedChainId(activeProvider);
    if (connectedChainId !== TESTNET_CHAIN_ID) {
      setFlowError(
        "Shielded Swap lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }

    const noteToSwap = notes.find((n) => n.nullifier === selectedNoteNullifier);
    if (!noteToSwap) {
      // Deep-audit #24: never silently substitute another note — the sync
      // effect normally guarantees a selection, but a stale nullifier plus a
      // fast click must fail closed, not spend the wrong note.
      setFlowError("Select a shielded note first. No transaction was sent.");
      return;
    }
    // Router interface gate: shieldedSwap spends via
    // IShieldedPool.withdraw(bytes,bytes32,bytes32,address,uint256), which
    // only legacy Veil pools expose. 0xbow notes live in 0xbow pools
    // (withdraw(tuple,tuple) through Entrypoint.relay with Groth16) and can
    // never enter this router — fail closed with directions instead of a
    // revert that burns gas.
    if (getWithdrawPath(noteToSwap) === "0xbow" || isBowNote(noteToSwap)) {
      setFlowError(
        "The selected note is a 0xbow note, and VeilShieldRouter.shieldedSwap only spends legacy-pool notes: its source pool must expose withdraw(bytes,bytes32,bytes32,address,uint256), which 0xbow pools do not. Spend 0xbow notes via Withdraw instead. No transaction was sent."
      );
      return;
    }

    const isEthSource = !noteToSwap.asset || noteToSwap.asset === ETH_ZERO_ADDRESS;
    const noteSourcePool = isEthSource
      ? TESTNET_LEGACY_ETH_POOL
      : (noteToSwap.denomination === TESTNET_VEIL_POOL_05_DENOMINATION
          ? TESTNET_VEIL_POOL_05
          : SHIELDED_SWAP_SOURCE_POOL);

    const route = getShieldedSwapRouteStatus(noteSourcePool);
    if (!route.executable || route.destination === null) {
      setFlowError(shieldedSwapPendingMessage(route));
      return;
    }
    const destination = route.destination;

    // LIVE-READ enforcement (Task 4b R2, fixes T4 I-1): re-read every known
    // pool onchain (denomination/asset/paused) plus v4 route liquidity before
    // building any params. Config alone never enables execution.
    const liveGate = await readShieldedSwapRouteStatusLive(publicClient);
    if (!liveGate.executable) {
      setFlowError(
        liveGate.reason ??
          "Shielded swap is not executable against live chain state right now. No transaction was sent."
      );
      return;
    }

    let slippagePct: number;
    // Read-only parse runs unguarded; the guard is acquired inside the main
    // try below so validation failures can never leak it (deep-audit F1).
    try {
      slippagePct = parseSlippagePercent(slippage);
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Invalid slippage setting.");
      return;
    }

    setIsShieldedSwapping(true);
    setShieldedSwapTxHash(null);
    setProverTitle("Executing Shielded Swap (Testnet, Self-Relay)");
    setProverTxHash(null);
    setProverCommitment(null);
    setProverCommitted(false);
    setProverSteps([
      {
        title: "1. Source Note & Live Pool Guards",
        detail: "Checking denomination, pause, cap and nullifier against the source shielded pool",
        status: "running",
      },
      {
        title: "2. Proof-Bound Params & Live Output Simulation",
        detail: "Binding the router-recipient proof, fresh root and slippage-bound minOut via eth_call",
        status: "pending",
      },
      {
        title: "3. VeilShieldRouter.shieldedSwap Execution",
        detail: "Self-relay: your wallet submits with relayerFee 0 and pays gas",
        status: "pending",
      },
      {
        title: "4. Event Assert & Vault Rollover",
        detail: "Verifying ShieldedSwapExecuted, persisting the new note and marking the old note spent",
        status: "pending",
      },
    ]);
    setIsProverOpen(true);

    try {
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
      const guards = await readSwapGuards(publicClient, route.sourcePool);
      if (guards.paused) {
        throw new Error("Shielded source pool deposits are paused. No transaction was sent.");
      }
      if (noteToSwap.denomination !== guards.denomination) {
        throw new Error(
          "Selected note denomination does not match the live source pool denomination. No transaction was sent."
        );
      }
      const spent = await publicClient.readContract({
        address: route.sourcePool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "isNullifierSpent",
        args: [noteToSwap.nullifierHash],
      });
      if (spent) throw new Error("Note already spent onchain. No transaction was sent.");
      const idx = await publicClient.readContract({
        address: route.sourcePool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "nextIndex",
      });
      if (idx === 0) throw new Error("Source pool is empty, nothing to swap against.");
      const root = await publicClient.readContract({
        address: route.sourcePool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "rootHistory",
        args: [BigInt(idx - 1)],
      });
      const known = await publicClient.readContract({
        address: route.sourcePool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "isKnownRoot",
        args: [root],
      });
      if (!known) throw new Error("Unknown Merkle root for the source pool. No transaction was sent.");
      setProverSteps((prev) => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "running" },
        prev[2],
        prev[3],
      ]);

      setIsShieldedProving(true);
      // Proof-bound withdraw params: the router itself is the recipient and
      // the fee is 0 (self-relay, bound into the proof context).
      const withdrawArgs = buildWithdrawArgs(noteToSwap, root, SHIELDED_SWAP_ROUTER);
      // Destination note kind follows the destination pool: denomination and
      // asset are read live, never hardcoded.
      const destDenomination = await publicClient.readContract({
        address: destination,
        abi: POOL_DEPOSIT_ABI_EXT,
        functionName: "denomination",
      });
      const destAsset = await publicClient.readContract({
        address: destination,
        abi: parseAbi(["function asset() view returns (address)"]),
        functionName: "asset",
      });
      const secrets = generateNewShieldedNoteSecrets(destDenomination, destAsset);
      setProverCommitment(secrets.commitment);

      // Live output simulation with a zero floor, then slippage-bound params.
      // M-2 fix: the relay selection is USED — its relayerFee flows into both
      // param builds instead of being discarded.
      const relaySelection = selectShieldedSwapRelayPath();
      const simParams = buildSelfRelayShieldedSwapArgs({
        note: noteToSwap,
        proof: withdrawArgs.proof,
        root: withdrawArgs.root,
        poolSource: route.sourcePool,
        zeroForOne: route.zeroForOne,
        quotedAmountOut: 0n,
        slippagePercent: 0,
        newCommitment: secrets.commitment,
        poolDestination: destination,
        relayerFee: relaySelection.relayerFee,
      });
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });
      const { result: simResult } = await publicClient.simulateContract({
        address: SHIELDED_SWAP_ROUTER,
        abi: CONTRACT_ABIS.VeilShieldRouter,
        functionName: "shieldedSwap",
        args: [simParams],
        account: connectedAddress,
      });
      const expectedOut = simResult as bigint;
      if (expectedOut < destDenomination) {
        throw new Error(
          "Live simulated output is below the destination note denomination (InsufficientOutputForDenomination). No transaction was sent."
        );
      }
      const params = buildSelfRelayShieldedSwapArgs({
        note: noteToSwap,
        proof: withdrawArgs.proof,
        root: withdrawArgs.root,
        poolSource: route.sourcePool,
        zeroForOne: route.zeroForOne,
        quotedAmountOut: expectedOut,
        slippagePercent: slippagePct,
        newCommitment: secrets.commitment,
        poolDestination: destination,
        relayerFee: relaySelection.relayerFee,
      });
      setIsShieldedProving(false);
      setProverSteps((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "running" },
        prev[3],
      ]);

      await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
      const swapHash = await walletClient.writeContract({
        address: SHIELDED_SWAP_ROUTER,
        abi: CONTRACT_ABIS.VeilShieldRouter,
        functionName: "shieldedSwap",
        args: [params],
      });
      setProverTxHash(swapHash);
      setShieldedSwapTxHash(swapHash);
      setProverSteps((prev) => [
        prev[0],
        prev[1],
        { ...prev[2], status: "completed" },
        { ...prev[3], status: "running" },
      ]);

      const receipt = await waitForTransactionReceipt(publicClient, { hash: swapHash });
      if (receipt.status !== "success") {
        throw new Error("Shielded swap transaction reverted onchain.");
      }
      const executed = findShieldedSwapExecuted(receipt.logs, noteToSwap.nullifierHash);
      if (!executed) {
        throw new Error(
          "ShieldedSwapExecuted event not found for this nullifier. Treating the deposit as unverified: the new note was NOT saved. Check the transaction in your wallet history."
        );
      }
      if (executed.poolDestination.toLowerCase() !== destination.toLowerCase()) {
        throw new Error(
          "Swap settled into an unexpected destination pool. The new note was NOT saved. Check the transaction on the explorer before retrying."
        );
      }

      // Vault rollover: persist the new destination note, mark the old spent.
      // Journaled first (root-audit F5) so a crash cannot strand the secret.
      savePendingNote(secrets.newNote, swapHash, destination);
      const updated = [secrets.newNote, ...notes.filter((n) => n.nullifier !== noteToSwap.nullifier)];
      setNotes(updated);
      setSelectedNote(secrets.newNote);
      setSelectedNoteNullifier(secrets.newNote.nullifier);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, serializeNotesList(updated));
          const check = localStorage.getItem(LOCAL_STORAGE_KEY) || "";
          if (!check.includes(secrets.newNote.nullifier.slice(2, 10))) {
            throw new Error("vault write verification failed");
          }
        } catch (e: unknown) {
          throw new Error(
            "Browser vault storage failed — your new note was NOT saved. Copy the commitment from the prover modal and retry. " +
              (e instanceof Error ? e.message : "Storage unavailable.")
          );
        }
      }
      clearPendingNoteByTx(swapHash);
      setProverCommitted(true);
      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: "completed" },
      ]);
      // Surface the result even if the user hid the modal mid-proof.
      setIsProverOpen(true);
    } catch (e: unknown) {
      console.error("Shielded swap transaction error:", e);
      setIsProverOpen(false);
      setFlowError(mapShieldedSwapError(e, slippagePct));
    } finally {
      setIsShieldedSwapping(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
      setIsShieldedProving(false);
    }
  }

  async function handleWithdraw() {
    setFlowError(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!cleanRecipient) {
      setFlowError("Please provide a clean recipient address for the unlinkable withdrawal.");
      return;
    }
    if (notes.length === 0) {
      setFlowError("No shielded notes available in local storage. Create one via Swap-to-Shield first.");
      return;
    }

    const activeProvider = getActiveEvmProvider();
    if (!activeProvider) {
      setIsWalletModalOpen(true);
      return;
    }

    const noteToWithdraw = notes.find((n) => n.nullifier === selectedNoteNullifier);
    if (!noteToWithdraw) {
      setFlowError("Select a shielded note first. No transaction was sent.");
      return;
    }

    // Route by note kind: 0xbow notes take the Groth16 testnet path, legacy
    // keccak notes take the legacy path. Never mix the two.
    const withdrawPath = getWithdrawPath(noteToWithdraw);
    const connectedChainId = await getConnectedChainId(activeProvider);
    const useTestnetBow =
      withdrawPath === "0xbow" && connectedChainId === TESTNET_CHAIN_ID && isTestnetBowConfigured();

    // 0xbow testnet (46630) path: real Groth16 SDK flow, no Mock verifier.
    if (useTestnetBow) {
      setIsExecuting(true);
      setProverTitle("Generating 0xbow Groth16 Shielded Withdrawal (Testnet)");
      setProverTxHash(null);
      setProverCommitment(null);
      setProverCommitted(false);
      const bowSteps: ZkProverStep[] = [
        {
          title: "1. Recovering Note Credentials & Nullifier",
          detail: "Loading Poseidon commitment, secret & nullifier from local vault",
          status: "running",
        },
        {
          title: "2. Fetching Pinned Circuits & Verifying Integrity",
          detail: "Loading withdraw.wasm and withdraw.zkey (v1.2.1) with SHA-256 verification",
          status: "pending",
        },
        {
          title: "3. Client-Side Groth16 ZK-SNARK Proving",
          detail: "Executing snarkjs Groth16 prover in browser against onchain State & ASP Merkle trees",
          status: "pending",
        },
        {
          title: "4. Entrypoint Proxy Relay & On-Chain Settlement",
          detail: "Submitting verified proof to Entrypoint relay on Robinhood Testnet",
          status: "pending",
        },
      ];
      setProverSteps(bowSteps);
      setIsProverOpen(true);
      try {
        if (txInFlight.current > 0) return;
        txInFlight.current += 1;
        if (!isAddress(cleanRecipient)) throw new Error("Recipient address is required");

        if (withdrawPath !== "0xbow" || !isBowNote(noteToWithdraw)) {
          throw new Error(
            "The selected note is a legacy note. Please select a 0xbow shielded note (0.001 ETH) created on testnet."
          );
        }

        const bowNote = noteToWithdraw;
        setProverCommitment(bowNote.commitmentHash);

        // Explicit relay context: pool, asset and recipient bound up front.
        // The asset is derived from the note itself, never hardcoded, so
        // VEIL notes carry the VEIL token into the relay call.
        const bowRelayContext = buildBowRelayContext({
          pool: TESTNET_0XBOW.pool,
          asset: bowNote.asset as Address,
          recipient: cleanRecipient as Address,
        });

        const testnetClient = createTestnetBowPublicClient();
        const scope = BigInt(bowNote.scope);
        const denomination = BigInt(bowNote.denomination);
        const label = BigInt(bowNote.label);
        const nullifier = BigInt(bowNote.nullifier);
        const secret = BigInt(bowNote.secret);
        const commitmentHash = BigInt(bowNote.commitmentHash);

        // Scope live re-check (deep-audit S10): the note's scope must still
        // match the pool's, or minutes of proving + gas burn on a stale proof.
        const liveScope = await testnetClient.readContract({
          address: bowRelayContext.pool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        });
        if (BigInt(liveScope) !== scope) {
          throw new Error(
            "Pool scope changed onchain since this note was created. Withdraw is unavailable for this note. No transaction was sent."
          );
        }

        setProverSteps((prev) => [
          { ...prev[0], status: "completed" },
          { ...prev[1], status: "running" },
          prev[2],
          prev[3],
        ]);

        // Real artifact integrity check — fails closed before any proving attempt.
        await fetchPinnedBowArtifact("withdraw.wasm");
        await fetchPinnedBowArtifact("withdraw.zkey");

        // Sync ASP root first if needed (label included so the server can
        // tell genuine inclusion need apart from redundant publishes).
        try {
          await fetch("/api/asp/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: label.toString() }),
          });
        } catch {}

        setProverSteps((prev) => [
          prev[0],
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "running" },
          prev[3],
        ]);

        // Fetch pool events to build State Tree and Association Set
        let { orderedCommitments, labels } = await fetchBowPoolEvents(
          testnetClient,
          bowRelayContext.pool
        );

        if (!orderedCommitments.includes(commitmentHash)) {
          throw new Error(
            "Deposit commitment not found in onchain state tree. Please ensure your deposit transaction was confirmed."
          );
        }

        let stateTree = buildBowStateTree(orderedCommitments);
        let aspSet = buildBowAssociationSet(labels);

        if (!aspSet.labels.includes(label)) {
          throw new Error("Deposit label not found in Association Set. Try syncing ASP.");
        }

        let onchainAspRoot = await testnetClient.readContract({
          address: TESTNET_0XBOW.entrypointProxy,
          abi: BOW_ENTRYPOINT_RELAY_ABI,
          functionName: "latestRoot",
        });

        if (aspSet.root !== BigInt(onchainAspRoot)) {
          // Re-sync ASP onchain, then re-read (never prove against a stale root).
          // The server throttles publishes (gas-griefing guard) — surface its
          // retry message honestly instead of a generic stale-root error.
          const resync = await fetch("/api/asp/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: label.toString() }),
          });
          try {
            const syncJson = (await resync.json()) as { throttled?: boolean; error?: string };
            if (resync.status === 429 || syncJson.throttled) {
              throw new Error(
                syncJson.error ||
                  "ASP sync is throttled right now. Wait a few minutes and try the withdrawal again."
              );
            }
          } catch (e: unknown) {
            if (e instanceof Error && /throttl|retry/i.test(e.message)) throw e;
          }
          const refreshed = await fetchBowPoolEvents(testnetClient, bowRelayContext.pool);
          orderedCommitments = refreshed.orderedCommitments;
          labels = refreshed.labels;
          if (!orderedCommitments.includes(commitmentHash)) {
            throw new Error(
              "Deposit commitment not found in onchain state tree after ASP re-sync."
            );
          }
          stateTree = buildBowStateTree(orderedCommitments);
          aspSet = buildBowAssociationSet(labels);
          onchainAspRoot = await testnetClient.readContract({
            address: TESTNET_0XBOW.entrypointProxy,
            abi: BOW_ENTRYPOINT_RELAY_ABI,
            functionName: "latestRoot",
          });
          if (aspSet.root !== BigInt(onchainAspRoot)) {
            throw new Error(
              "Association Set root is not synced onchain. Wait for the ASP sync transaction to confirm and try again."
            );
          }
        }

        const stateMerkleProof = stateTree.proof(commitmentHash);
        const aspMerkleProof = buildBowAssociationProof(aspSet, label);

        const sdk = createBowSdk();
        const { withdrawal, context } = createBowWithdrawalContext({
          entrypoint: TESTNET_0XBOW.entrypointProxy,
          recipient: bowRelayContext.recipient,
          feeRecipient: connectedAddress,
          scope,
        });

        // Local spend context: register the deposited note first (script parity
        // with addPoolAccount), otherwise createWithdrawalSecrets throws
        // AccountError commitmentNotFound on the empty fresh service.
        const accountService = new AccountService(null as any, {
          mnemonic: generateMnemonic(english, 256),
        });
        accountService.addPoolAccount(
          scope as never,
          denomination,
          nullifier as never,
          secret as never,
          label as never,
          BigInt(bowNote.blockNumber),
          bowNote.txHash as `0x${string}`
        );

        const commitmentObj: AccountCommitment = {
          hash: commitmentHash as never,
          label: label as never,
          nullifier: nullifier as never,
          secret: secret as never,
          value: denomination,
          blockNumber: BigInt(bowNote.blockNumber),
          txHash: bowNote.txHash as `0x${string}`,
        };

        const secretPair = accountService.createWithdrawalSecrets(commitmentObj);

        const withdrawalProof = await sdk.proveWithdrawal(commitmentObj, {
          withdrawalAmount: denomination,
          stateMerkleProof,
          aspMerkleProof,
          stateRoot: stateTree.root as never,
          stateTreeDepth: 32n,
          aspRoot: aspSet.root as never,
          aspTreeDepth: 32n,
          context,
          newNullifier: secretPair.nullifier,
          newSecret: secretPair.secret,
        });

        const isValid = await sdk.verifyWithdrawal(withdrawalProof);
        if (!isValid) throw new Error("Local verification of Groth16 withdrawal proof failed.");

        setProverSteps((prev) => [
          prev[0],
          prev[1],
          { ...prev[2], status: "completed" },
          { ...prev[3], status: "running" },
        ]);

        const pc = withdrawalProof.proof;
        const proofStruct = {
          pA: [BigInt(pc.pi_a[0]), BigInt(pc.pi_a[1])] as const,
          pB: [
            [BigInt(pc.pi_b[0][1]), BigInt(pc.pi_b[0][0])],
            [BigInt(pc.pi_b[1][1]), BigInt(pc.pi_b[1][0])],
          ] as const,
          pC: [BigInt(pc.pi_c[0]), BigInt(pc.pi_c[1])] as const,
          pubSignals: withdrawalProof.publicSignals.map(BigInt) as [
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint
          ],
        };

        const walletClient = createWalletClient({
          account: connectedAddress,
          chain: appChain,
          transport: custom(activeProvider),
        });

        await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
        const relayHash = await walletClient.writeContract({
          address: TESTNET_0XBOW.entrypointProxy,
          abi: BOW_ENTRYPOINT_RELAY_ABI,
          functionName: "relay",
          args: [withdrawal, proofStruct as any, scope],
        });

        setProverTxHash(relayHash);

        const receipt = await waitForTransactionReceipt(testnetClient, { hash: relayHash });
        if (receipt.status !== "success") throw new Error("Entrypoint relay transaction reverted onchain.");

        // Post-receipt spent assert (deep-audit): the nullifier must read as
        // spent before the note leaves the vault — never on receipt alone.
        const spentNullifier = BigInt(withdrawalProof.publicSignals[1]);
        const spentOnchain = await testnetClient.readContract({
          address: bowRelayContext.pool,
          abi: parseAbi(["function nullifierHashes(uint256) view returns (bool)"]),
          functionName: "nullifierHashes",
          args: [spentNullifier],
        });
        if (!spentOnchain) {
          throw new Error(
            "Relay confirmed but the nullifier does not read as spent onchain. The note was NOT removed — verify on the explorer before retrying."
          );
        }

        // Remove spent note from local storage
        const remaining = notes.filter((n) => n.nullifier !== bowNote.nullifier);
        setNotes(remaining);
        if (remaining.length > 0) {
          setSelectedNoteNullifier(remaining[0].nullifier);
        } else {
          setSelectedNoteNullifier("");
        }
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, serializeNotesList(remaining));
          } catch (e: unknown) {
            console.error("Vault removal write failed:", e);
          }
        }

        // Refresh token balances
        if (connectedAddress) {
          try {
            const liveBals = await fetchAllTokenBalances(connectedAddress, SUPPORTED_TOKENS);
            setTokenBalances(liveBals);
          } catch {}
        }

        setProverSteps((prev) => [
          prev[0],
          prev[1],
          prev[2],
          { ...prev[3], status: "completed" },
        ]);
        setIsProverOpen(true);
      } catch (e: unknown) {
        console.error("0xbow testnet withdrawal error:", e);
        setIsProverOpen(false);
        setFlowError(e instanceof Error ? e.message : "0xbow testnet withdrawal failed. Try again.");
      } finally {
        setIsExecuting(false);
        txInFlight.current = Math.max(0, txInFlight.current - 1);
      }
      return;
    }

    // A 0xbow note outside the testnet path never enters the legacy pool:
    // fail closed with directions instead of sending it to the wrong verifier.
    if (withdrawPath === "0xbow") {
      setFlowError(
        "This 0xbow note lives on Robinhood Testnet (46630). Switch your wallet to testnet to withdraw it. No transaction was sent."
      );
      return;
    }

    // Mainnet 0xbow path: active only after `pnpm migrate:mainnet` populates
    // the suite. Before that, fail closed with directions instead of touching
    // the paused Mock-verifier pool.
    if (connectedChainId === MAINNET_CHAIN_ID) {
      const suite = getBowSuite(MAINNET_CHAIN_ID);
      if (!suite) {
        setFlowError(
          "Mainnet 0xbow suite pending migration — withdrawals open after `pnpm migrate:mainnet`. No transaction was sent."
        );
        return;
      }
      setIsExecuting(true);
      setProverTitle("Preparing 0xbow Shielded Withdrawal (Mainnet)");
      setProverTxHash(null);
      setProverCommitment(null);
      setProverCommitted(false);
      setProverSteps([
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
          detail: `Real snarkjs proveWithdrawal against the mainnet pool ${suite.poolEth.slice(0, 10)}… (no Mock)`,
          status: "pending",
        },
        {
          title: "4. Entrypoint relay dispatch + receipt gating",
          detail: "Submitting relay() to the mainnet entrypoint on Robinhood Chain 4663",
          status: "pending",
        },
      ]);
      setIsProverOpen(true);
      try {
        if (!isAddress(cleanRecipient)) throw new Error("Recipient address is required");
        // Full browser proving wires up after migration verification; the
        // script path (scripts/privacy-pools-testnet-e2e.mjs pattern) is proven.
        throw new Error(
          "Mainnet 0xbow browser proving ships after migration verification. No transaction was sent."
        );
      } catch (e: unknown) {
        console.error("0xbow mainnet withdrawal error:", e);
        setIsProverOpen(false);
        setFlowError(e instanceof Error ? e.message : "0xbow mainnet withdrawal failed. Try again.");
      } finally {
        setIsExecuting(false);
        // No guard acquired on this fail-closed stub path: decrementing here
        // would release another handler's in-flight guard. Intentionally absent.
      }
      return;
    }

    setIsExecuting(true);
    setProverTitle("Preparing Shielded Withdrawal");
    setProverTxHash(null);
    setProverCommitment(null);
    setProverCommitted(false);

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
        title: "3. Provisional Proof Payload Assembly (old notes only)",
        detail: "Packing the legacy Mock proof payload for the provisional onchain verifier (old notes only)",
        status: "pending",
      },
      {
        title: "4. On-Chain Verifier Dispatch",
        detail: "Submitting to ShieldedVerifier contract; the withdraw call carries no depositor address. Provisional verifier for old notes only — Groth16 on 0xbow paths (F4)",
        status: "pending",
      },
    ];

    setProverSteps(initialSteps);
    setIsProverOpen(true);

    try {
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
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
      if (isBowNote(noteToWithdraw)) {
        throw new Error("This pool only accepts legacy shielded notes.");
      }
      const legacyNote = noteToWithdraw as ShieldedNote;
      // Withdraw pool follows the NOTE's asset (R3): ETH notes -> ETH pool,
      // VEIL notes -> the live-matching VEIL pool. Verified live (denomination
      // + asset) inside the resolver; fail closed when nothing matches.
      const withdrawPool = await resolveLegacyPoolForNote(
        publicClient,
        legacyNote,
        [
          { pool: SHIELDED_POOL_ETH, asset: ETH_ZERO_ADDRESS },
          { pool: TESTNET_VEIL_POOL_05, asset: TESTNET_VEIL_TOKEN },
          { pool: TESTNET_VEIL_POOL_2, asset: TESTNET_VEIL_TOKEN },
        ] as LegacyPoolCandidate[]
      );
      const idx = await publicClient.readContract({
        address: withdrawPool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "nextIndex",
      });
      if (idx === 0) throw new Error("Pool is empty, nothing to withdraw against.");
      const pass = await publicClient.readContract({
        address: VERIFIER_ADDRESS,
        abi: VERIFIER_ABI,
        functionName: "shouldPass",
      });
      if (!pass) throw new Error("Provisional verifier is disabled, old-notes withdrawals are unavailable.");
      const spent = await publicClient.readContract({
        address: withdrawPool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "isNullifierSpent",
        args: [legacyNote.nullifierHash],
      });
      if (spent) throw new Error("Note already spent.");
      const root = await publicClient.readContract({
        address: withdrawPool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "rootHistory",
        args: [BigInt(idx - 1)],
      });
      const known = await publicClient.readContract({
        address: withdrawPool,
        abi: POOL_WITHDRAW_ABI,
        functionName: "isKnownRoot",
        args: [root],
      });
      if (!known) throw new Error("Unknown Merkle root");
      const args = buildWithdrawArgs(legacyNote, root, cleanRecipient as `0x${string}`);

      // Step 3: Real On-Chain Withdrawal Dispatch via Connected Wallet
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });

      await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
      const withdrawHash = await walletClient.writeContract({
        address: withdrawPool,
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

      // Post-receipt event assert (deep-audit): the Withdraw event for our
      // nullifier + recipient must exist in the receipt block before the
      // note leaves the vault — never on receipt status alone.
      const wdLogs = await publicClient.getContractEvents({
        address: withdrawPool,
        abi: parseAbi([
          "event Withdraw(bytes32 indexed nullifierHash, address indexed recipient, address indexed relayer, uint256 fee)",
        ]),
        eventName: "Withdraw",
        args: { nullifierHash: legacyNote.nullifierHash as `0x${string}` },
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      const wdMatch = wdLogs.some(
        (l) =>
          (l.args.recipient as string | undefined)?.toLowerCase() ===
          (cleanRecipient as string).toLowerCase()
      );
      if (!wdMatch) {
        throw new Error(
          "Withdraw confirmed but no matching Withdraw event for this note and recipient was found. The note was NOT removed — verify on the explorer before retrying."
        );
      }

      const remaining = notes.filter((n) => n.nullifier !== noteToWithdraw.nullifier);
      setNotes(remaining);
      if (remaining.length > 0) {
        setSelectedNoteNullifier(remaining[0].nullifier);
      } else {
        setSelectedNoteNullifier("");
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, serializeNotesList(remaining));
        } catch (e: unknown) {
          console.error("Vault removal write failed:", e);
        }
      }

      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: "completed" },
      ]);
      // Surface the result even if the user hid the modal mid-proof.
      setIsProverOpen(true);
      setCleanRecipient("");
    } catch (e: unknown) {
      console.error("Withdrawal transaction error:", e);
      setIsProverOpen(false);
      setFlowError(
        e instanceof Error
          ? e.message
          : "Withdrawal transaction cancelled or failed on-chain. Check your wallet and try again."
      );
    } finally {
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  const activeNoteItem = notes.find((n) => n.nullifier === selectedNoteNullifier) || notes[0];

  const isEthActiveNote = !activeNoteItem?.asset || activeNoteItem.asset === ETH_ZERO_ADDRESS;
  const activeNoteSourcePool = isEthActiveNote
    ? TESTNET_LEGACY_ETH_POOL
    : (activeNoteItem?.denomination === TESTNET_VEIL_POOL_05_DENOMINATION
        ? TESTNET_VEIL_POOL_05
        : SHIELDED_SWAP_SOURCE_POOL);
  const shieldedSwapRoute = getShieldedSwapRouteStatus(activeNoteSourcePool);
  const shieldedSwapDisabled = isShieldedSwapExecuteDisabled({
    isExecuting: isShieldedSwapping,
    connected: Boolean(connectedAddress),
    hasNotes: notes.length > 0,
    destinationAvailable: shieldedSwapRoute.destination !== null,
    isProving: isShieldedProving,
  });

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
            Robinhood Chain {APP_CHAIN_ID} // Uniswap v4
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
            {APP_CHAIN_ID === TESTNET_CHAIN_ID
              ? "Direct shielded deposits into non-custodial Merkle privacy pools with client-side Groth16 ZK-SNARK proofs and verifiable Association Sets (ASP)."
              : "Direct shielded deposits into non-custodial Merkle privacy pools with client-side proof payloads and verifiable Association Sets. Provisional verifier for old notes only — Groth16 on 0xbow paths (F4)."}
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(460px, 100%), 1fr))",
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
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => switchTab("buy_and_shield")}
                aria-current={activeTab === "buy_and_shield" ? "true" : undefined}
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
                onClick={() => switchTab("shielded_swap")}
                aria-current={activeTab === "shielded_swap" ? "true" : undefined}
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
                onClick={() => switchTab("withdraw")}
                aria-current={activeTab === "withdraw" ? "true" : undefined}
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
                onClick={() => switchTab("vault")}
                aria-current={activeTab === "vault" ? "true" : undefined}
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
              <Settings className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
              <span>{slippage}%</span>
            </button>
          </div>

          {/* Inline flow error — non-blocking, screen-reader announced */}
          {/* Persistent vault-unavailable warning (deep-audit #25): browser
              storage denied means notes cannot persist — deposits would strand
              funds on a reload. This never auto-dismisses. */}
          {vaultUnavailable && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-2)",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                color: "var(--color-danger-ink)",
                fontSize: "var(--text-caption)",
                fontFamily: "var(--font-body)",
                lineHeight: 1.5,
              }}
            >
              <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ flex: 1, overflowWrap: "anywhere" }}>
                Browser storage is unavailable — shielded notes cannot be saved on this device. Do not deposit: a reload would strand funds. Enable site storage and reload.
              </span>
            </div>
          )}
          {flowError && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-2)",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                color: "var(--color-danger-ink)",
                fontSize: "var(--text-caption)",
                fontFamily: "var(--font-body)",
                lineHeight: 1.5,
              }}
            >
              <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <span style={{ flex: 1, overflowWrap: "anywhere" }}>{flowError}</span>
              <button
                type="button"
                onClick={() => setFlowError(null)}
                aria-label="Dismiss error message"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  padding: "2px",
                  flexShrink: 0,
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* TAB 1: SWAP-TO-SHIELD */}
          {activeTab === "buy_and_shield" && (
            <BuyAndShieldPanel
              isTestnetRouterMode={isTestnetRouterMode}
              isEthRouterInput={isEthRouterInput}
              routerPaySymbol={routerPaySymbol}
              onSelectPayToken={selectRouterPayToken}
              inputToken={inputToken}
              outputToken={outputToken}
              inputAmount={inputAmount}
              veilAmountIn={veilAmountIn}
              onInputAmount={setInputAmount}
              onVeilAmountIn={setVeilAmountIn}
              veilBalance={veilBalance}
              onOpenInputTokenModal={() => setIsInputTokenModalOpen(true)}
              onOpenOutputTokenModal={() => setIsOutputTokenModalOpen(true)}
              onPercentage={handlePercentage}
              onFlipTokens={handleFlipTokens}
              liveDenomination={liveDenomination}
              routerDestDenom={routerDestDenom}
              routerQuote={routerQuote}
              routerQuoteNote={routerQuoteNote}
              isQuoting={isQuoting}
              slippage={slippage}
              routerInputValid={parsedVeilIn !== null}
              routerQuoteBelowDenomination={routerQuoteBelowDenomination}
              parsedInput={parsedInput}
              inputMatchesDenomination={inputMatchesDenomination}
              connectedAddress={connectedAddress}
              isExecuting={isExecuting}
              executeDisabled={buyCtaDisabled}
              onExecute={handleBuyAndShield}
              forceDirect={forceDirect}
              onToggleForceDirect={() => {
                setForceDirect((v) => !v);
                setFlowError(null);
              }}
              isTestnetBuild={isTestnetBuild}
            />
          )}
          {/* Buy & Shield tab body lives in components/trade/BuyAndShieldPanel.tsx */}

              {/* Self-attestation + gated pool (Task 3, testnet only) */}
              {isTestnetBuild && activeTab === "buy_and_shield" && (
                <AttestPanel
                  connectedAddress={connectedAddress}
                  attestation={attestation}
                  gating={gating}
                  isAttestLoading={isAttestLoading}
                  isAttesting={isAttesting}
                  onSelfAttest={handleSelfAttest}
                  onRefresh={() => {
                    setFlowError(null);
                    void refreshAttestationState();
                  }}
                  attestNote={attestNote}
                  attestTxHash={attestTxHash}
                  gatedAmountIn={gatedAmountIn}
                  onGatedAmountIn={setGatedAmountIn}
                  gatedValid={parsedGatedIn !== null}
                  isSimulatingGated={isSimulatingGated}
                  isGatedSwapping={isGatedSwapping}
                  onSimulate={handleSimulateGatedSwap}
                  onGatedSwap={handleGatedSwap}
                  gatedSimNote={gatedSimNote}
                  gatedTxHash={gatedTxHash}
                />
              )}
          {/* attest body lives in components/trade/AttestPanel.tsx */}

          {/* TAB 2: SHIELDED SWAP */}
          {activeTab === "shielded_swap" && (
            <ShieldedSwapPanel
              notes={notes}
              activeNote={activeNoteItem}
              isNoteDropdownOpen={isNoteDropdownOpen}
              onToggleNoteDropdown={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
              onSelectNote={(nullifier) => {
                setSelectedNoteNullifier(nullifier);
                setIsNoteDropdownOpen(false);
              }}
              onGoShield={() => switchTab("buy_and_shield")}
              outputToken={outputToken}
              onChangePool={() => setIsOutputTokenModalOpen(true)}
              route={shieldedSwapRoute}
              ethDenomination={liveDenomination}
              shieldedSwapTxHash={shieldedSwapTxHash}
              explorerTxUrl={explorerTxUrl}
              shieldedSwapDisabled={shieldedSwapDisabled}
              isSwapping={isShieldedSwapping}
              connected={Boolean(connectedAddress)}
              onExecute={handleShieldedSwap}
            />
          )}
          {/* Shielded-swap tab body lives in components/trade/ShieldedSwapPanel.tsx */}

          {/* TAB 3: WITHDRAW */}
          {activeTab === "withdraw" && (
            <WithdrawPanel
              notes={notes}
              activeNote={activeNoteItem}
              isNoteDropdownOpen={isNoteDropdownOpen}
              onToggleNoteDropdown={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
              onSelectNote={(nullifier) => {
                setSelectedNoteNullifier(nullifier);
                setIsNoteDropdownOpen(false);
              }}
              cleanRecipient={cleanRecipient}
              onRecipientChange={setCleanRecipient}
              isExecuting={isExecuting}
              onWithdraw={handleWithdraw}
            />
          )}
          {/* Withdraw tab lives in components/trade/WithdrawPanel.tsx */}

          {/* TAB 4: NOTE VAULT */}
          {activeTab === "vault" && (
            <VaultPanel
              notes={notes}
              onBackup={() => {
                const current =
                  notes.find((n) => n.nullifier === selectedNoteNullifier) || notes[0] || null;
                setBackupNote(current);
                setIsBackupOpen(true);
              }}
              onBackupNote={(nullifier) => {
                const row = notes.find((n) => n.nullifier === nullifier) || null;
                setBackupNote(row);
                setIsBackupOpen(true);
              }}
              onWithdrawNote={(nullifier) => {
                setSelectedNoteNullifier(nullifier);
                switchTab("withdraw");
              }}
            />
          )}
          {/* Vault tab lives in components/trade/VaultPanel.tsx */}
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
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-accent-ink)", fontWeight: 600, marginTop: "2px" }}>
                  01
                </span>
                <span style={{ color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--color-text)", display: "block" }}>Non-Blocking Withdrawals</strong>
                  The withdraw path has no pause or guardian switch, and nullifiers cannot be reused. Bounds: legacy withdrawals of old notes additionally require the provisional verifier to pass and a known Merkle root (roots older than the 100-entry history cannot be spent) — see the internal audit.
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "12px 14px", backgroundColor: "rgba(26, 26, 26, 0.02)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-accent-ink)", fontWeight: 600, marginTop: "2px" }}>
                  02
                </span>
                <span style={{ color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--color-text)", display: "block" }}>Zero-Custody Router Invariant</strong>
                  VeilShieldRouter balance is verified to be exactly 0 at the end of every swap-to-shield transaction via transient storage (EIP-1153).
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "12px 14px", backgroundColor: "rgba(26, 26, 26, 0.02)", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-accent-ink)", fontWeight: 600, marginTop: "2px" }}>
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

      {/* Background proof progress — visible when the prover modal is hidden */}
      {isExecuting && !isProverOpen && (
        <button
          type="button"
          onClick={() => setIsProverOpen(true)}
          style={{
            position: "fixed",
            right: "var(--page-gutter, 24px)",
            bottom: "24px",
            zIndex: 60,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            minHeight: "44px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--color-text)",
            color: "var(--color-bg)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(26, 26, 26, 0.3)",
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-accent)" }} aria-hidden="true" />
          <span>Proof running — view progress</span>
        </button>
      )}

      {/* Modals */}
      <TokenSelectModal
        isOpen={isInputTokenModalOpen}
        onClose={() => setIsInputTokenModalOpen(false)}
        onSelectToken={(token) => setInputToken(token)}
        selectedSymbol={inputToken.symbol}
        balances={tokenBalances}
        disabledSymbols={["VEIL"]}
        ariaLabel="Select token to pay with"
      />

      <TokenSelectModal
        isOpen={isOutputTokenModalOpen}
        onClose={() => setIsOutputTokenModalOpen(false)}
        onSelectToken={(token) => setOutputToken(token)}
        selectedSymbol={outputToken.symbol}
        balances={tokenBalances}
        disabledSymbols={["VEIL"]}
        ariaLabel="Select token to shield"
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
        committed={proverCommitted}
        onDownloadBackup={() => {
          // Deep-audit #20: back up the vault selection the user is looking
          // at, not a stale last-deposited note.
          setBackupNote(activeNoteItem ?? selectedNote);
          setIsBackupOpen(true);
        }}
      />

      <ShieldNoteBackupModal
        note={backupNote}
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
        ariaLabel="Connect a wallet"
      />
    </div>
  );
}
