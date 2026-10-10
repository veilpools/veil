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
  createBowDepositSecrets,
  createBowNote,
  isBowNote,
  getWithdrawPath,
  serializeNotesList,
  deserializeNotesList,
  deserializeAnyNote,
  savePendingNote,
  clearPendingNoteByTx,
  loadPendingNotes,
  type ShieldedNote,
  type AnyShieldedNote,
  type BowShieldedNote,
} from "../../lib/note";
import { ShieldNoteBackupModal } from "../../components/ShieldNoteBackupModal";
import { VaultPanel } from "../../components/trade/VaultPanel";
import { WithdrawPanel } from "../../components/trade/WithdrawPanel";
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
import { parseSlippagePercent, TESTNET_VEIL_POOL_05, TESTNET_VEIL_POOL_2 } from "../../lib/router-swap";
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
  TESTNET_BOW_V3_ENTRYPOINT,
  TESTNET_BOW_V3_ETH_POOL,
  TESTNET_BOW_V3_VEIL_POOL,
  TESTNET_BOW_V3_VEIL_TOKEN,
  TESTNET_BOW_V3_ETH_DENOMINATION,
  TESTNET_BOW_V3_VEIL_DENOMINATION,
  isTestnetBowConfigured,
  isTestnetBowV3Configured,
  getBowSuite,
} from "../../lib/privacy-pools";
import {
  createBowSdk,
  createBowWithdrawalContext,
  createTestnetBowPublicClient,
  buildBowRelayContext,
  buildBowStateTree,
  fetchBowAspLabelsAllPools,
  fetchBowPoolEvents,
  proveBowWithdrawal,
  assertVeilAllowanceForBowDeposit,
  BOW_V3_NATIVE_DEPOSIT_ABI,
  BOW_V3_ERC20_DEPOSIT_ABI,
  BOW_V3_VEIL_APPROVE_ABI,
} from "../../lib/0xbow-client";
import { fetchPinnedBowArtifact } from "../../lib/0xbow-artifacts";
import { VEIL_ZK_ROUTER_ABI } from "../../lib/veil-artifact";
import {
  TESTNET_ZK_ROUTER_ADDRESS,
  TESTNET_ZK_ROUTER_CHAIN_ID,
  TESTNET_ZK_ROUTER_MULTI_ADDRESS,
  buildFullZkFlowArgs,
  buildMultiFullZkFlowArgs,
  findFullZkFlowExecuted,
  isZkExecuteDisabled,
  mapZkRouterError,
  quoteAndBuildFullZkFlow,
  quoteAndBuildMultiFullZkFlow,
  resolveZkShieldedSwapAssets,
  resolveZkShieldedSwapDeposit,
  runShieldedSwapPreSendSequence,
  simulateFullZkFlow,
  simulateMultiFullZkFlow,
} from "../../lib/zk-router";
import { ZkSwapToShieldPanel } from "../../components/trade/ZkSwapToShieldPanel";
import { ZkShieldedSwapPanel } from "../../components/trade/ZkShieldedSwapPanel";
import { buildBowAssociationSet, buildBowAssociationProof } from "../../lib/0xbow-association";
import { AccountService, type AccountCommitment } from "@0xbow/privacy-pools-core-sdk";
import { hashPrecommitment as bowHashPrecommitment, getCommitment as bowGetCommitment } from "@0xbow/privacy-pools-core-sdk";
import { generateMnemonic, english } from "viem/accounts";

const LOCAL_STORAGE_KEY = "veil_shielded_notes_v1";
// Legacy exit only: the keccak-pool withdraw resolver still needs the live
// ETH-pool address for old notes. No new deposit may reference it.
const SHIELDED_POOL_ETH = CONTRACT_ADDRESSES.poolEth as Address;
// Frozen legacy VEIL pools (pause + renounce at cutover). EXIT ONLY: old
// VEIL-denominated notes resolve here via resolveLegacyPoolForNote. Never
// a deposit target.
const LEGACY_EXIT_VEIL_POOL_05 = "0xd73920a3cbfdf3f6be530cab73fc9c876619517a" as Address;
const LEGACY_EXIT_VEIL_POOL_2 = "0x172e9cc542cf9349813f74548eec6e0a1df65e17" as Address;
// Retired legacy ETH pool (paused + guardian renounced at cutover).
// EXIT ONLY: old ETH notes live here and exits stay open by promise.
const LEGACY_EXIT_ETH_POOL = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17" as Address;

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

const BOW_POOL_STATE_ABI = parseAbi([
  "function currentRoot() view returns (uint256)",
]);

// Audit-round-3 F-03: shared fail-fast integrity check for the ZK quote
// paths. Same pattern and messages as the withdraw path: the saved secrets
// must reproduce the onchain deposit precommitment and commitmentHash, or no
// proof can ever verify. Runs before minutes of proving; every failure
// throws before any simulation, and no transaction is sent.
async function assertBowNoteIntegrity(
  testnetClient: ReturnType<typeof createTestnetBowPublicClient>,
  pool: Address,
  bowNote: BowShieldedNote
): Promise<void> {
  const denomination = BigInt(bowNote.denomination);
  const label = BigInt(bowNote.label);
  const nullifier = BigInt(bowNote.nullifier);
  const secret = BigInt(bowNote.secret);
  const commitmentHash = BigInt(bowNote.commitmentHash);
  const depositLogs = await testnetClient.getContractEvents({
    address: pool,
    abi: parseAbi([
      "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)",
    ]),
    eventName: "Deposited",
    fromBlock: BigInt(bowNote.blockNumber),
    toBlock: BigInt(bowNote.blockNumber),
  });
  const ownDeposit = depositLogs.find(
    (l) => l.transactionHash.toLowerCase() === (bowNote.txHash as string).toLowerCase()
  );
  if (!ownDeposit) {
    throw new Error(
      "Deposit event not found for this note's transaction. The note may belong to a different pool. No transaction was sent."
    );
  }
  const localPrecommitment = BigInt(
    bowHashPrecommitment(nullifier as never, secret as never) as bigint | number | string
  );
  if (localPrecommitment !== BigInt((ownDeposit.args as { _precommitmentHash: bigint })._precommitmentHash)) {
    throw new Error(
      "Saved note secrets do not match the onchain deposit (precommitment mismatch). This note is corrupted and can never produce a valid proof — do not retry proving. Deposit fresh and back it up. No transaction was sent."
    );
  }
  const recomputed = bowGetCommitment(denomination, label, nullifier as never, secret as never) as
    | { hash?: unknown }
    | bigint;
  const recomputedHash = BigInt(
    (typeof recomputed === "object" && recomputed !== null && "hash" in recomputed
      ? (recomputed as { hash?: unknown }).hash
      : recomputed) as bigint | number | string
  );
  if (recomputedHash !== commitmentHash) {
    throw new Error(
      "Saved note does not reproduce its own commitment (commitment mismatch). The vault entry mixes data from different deposits and can never produce a valid proof — do not retry proving. Restore the correct backup for this note, or deposit fresh. No transaction was sent."
    );
  }
}

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

  // Full-ZK cutover: Buy & Shield deposits ONLY into the audited 0xbow v3
  // suite (native ETH + ERC20 VEIL via Entrypoint.deposit). Legacy pools are
  // paused for new deposits onchain, so no direct-deposit path exists here.
  const isTestnetBuild = APP_CHAIN_ID === TESTNET_CHAIN_ID;
  const [bowDepositAsset, setBowDepositAsset] = useState<"ETH" | "VEIL">("ETH");
  const [veilBalance, setVeilBalance] = useState<string | null>(null);
  // Live VEIL minimum from Entrypoint.assetConfig (never hardcoded).
  const [veilMinimum, setVeilMinimum] = useState<bigint | null>(null);

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

  // Full-ZK Swap-to-Shield (VeilZkRouter.executeFullZkFlow, testnet only):
  // quote state is simulation-only (no tx); execution re-simulates pre-send.
  const [zkQuoteOut, setZkQuoteOut] = useState<bigint | null>(null);
  const [zkMinOut, setZkMinOut] = useState<bigint | null>(null);
  const [isZkQuoting, setIsZkQuoting] = useState(false);
  const [zkQuoteNote, setZkQuoteNote] = useState<string | null>(null);
  const [zkTxHash, setZkTxHash] = useState<string | null>(null);
  const [zkBundle, setZkBundle] = useState<{
    withdrawal: { processooor: Address; data: `0x${string}` };
    proof: {
      pA: [bigint, bigint];
      pB: [[bigint, bigint], [bigint, bigint]];
      pC: [bigint, bigint];
      pubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    };
    scope: bigint;
    withdrawAsset: Address;
    depositAsset: Address;
    depositValue: bigint;
    precommitment: bigint;
    zeroForOne: boolean;
    destPool: Address;
    sourcePool: Address;
    nullifier: bigint;
    secret: bigint;
    label: bigint;
    newNullifier: bigint;
    newSecret: bigint;
    spentNullifier: bigint;
    quotedSwapOut: bigint;
    minSwapOut: bigint;
  } | null>(null);
  // Shielded Swap tab: single-note flow uses zkBundle above; the batched
  // multi-note flow (executeMultiFullZkFlow) is quoted only when one note
  // cannot fund the destination note, otherwise the single-note flow runs.
  const [zkFlowKind, setZkFlowKind] = useState<"single" | "multi" | null>(null);
  const [zkMultiBundle, setZkMultiBundle] = useState<{
    withdrawals: { processooor: Address; data: `0x${string}` }[];
    proofs: {
      pA: [bigint, bigint];
      pB: [[bigint, bigint], [bigint, bigint]];
      pC: [bigint, bigint];
      pubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    }[];
    scopes: bigint[];
    withdrawAsset: Address;
    depositAsset: Address;
    depositValue: bigint;
    precommitment: bigint;
    zeroForOne: boolean;
    destPool: Address;
    sourcePool: Address;
    spentNullifiers: bigint[];
    nullifiers: bigint[];
    newNullifier: bigint;
    newSecret: bigint;
    quotedSwapOut: bigint;
    minSwapOut: bigint;
  } | null>(null);

  // Shielded Swap is paused after the full-ZK cutover: the legacy router
  // route only settles into paused legacy pools, so execution stays
  // disabled with an honest notice (see the shielded_swap tab body).
  // Form Inputs
  const [inputAmount, setInputAmount] = useState("0.001");
  const [cleanRecipient, setCleanRecipient] = useState("");

  // Note Selection in Shielded Swap & Withdraw
  const [selectedNoteNullifier, setSelectedNoteNullifier] = useState<string>("");
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);

  // Prover Modal States
  const [isProverOpen, setIsProverOpen] = useState(false);
  const [proverTitle, setProverTitle] = useState("Executing Shielded Deposit");
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

  // Live VEIL minimum for honest 0xbow deposits: read from
  // Entrypoint.assetConfig every time the tab, wallet or asset changes.
  // Fail closed (null minimum disables VEIL execution, never a guess).
  // Runs on both tabs that need the VEIL minimum (buy_and_shield deposits
  // AND shielded_swap destinations) — gating it to one tab left the other
  // stuck on "loading live minimum" forever with Execute disabled.
  useEffect(() => {
    if ((activeTab !== "buy_and_shield" && activeTab !== "shielded_swap") || (activeTab === "buy_and_shield" && bowDepositAsset !== "VEIL")) return;
    let cancelled = false;
    (async () => {
      try {
        const config = await publicClient.readContract({
          address: TESTNET_BOW_V3_ENTRYPOINT,
          abi: BOW_V3_VEIL_APPROVE_ABI,
          functionName: "assetConfig",
          args: [TESTNET_BOW_V3_VEIL_TOKEN],
        });
        if (cancelled) return;
        const minimum = config[1] as bigint;
        const pool = config[0] as Address;
        if (pool.toLowerCase() !== TESTNET_BOW_V3_VEIL_POOL.toLowerCase() || minimum <= 0n) {
          setVeilMinimum(null);
          return;
        }
        setVeilMinimum(minimum);
      } catch (e) {
        if (!cancelled) {
          console.warn("Could not read live VEIL minimum", e);
          setVeilMinimum(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, bowDepositAsset]);

  // Live VEIL balance for the connected wallet (display only).
  useEffect(() => {
    if (activeTab !== "buy_and_shield" || bowDepositAsset !== "VEIL" || !connectedAddress) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const bal = await publicClient.readContract({
          address: TESTNET_BOW_V3_VEIL_TOKEN,
          abi: BOW_V3_VEIL_APPROVE_ABI,
          functionName: "balanceOf",
          args: [connectedAddress],
        });
        if (!cancelled) setVeilBalance(formatEther(bal));
      } catch {
        if (!cancelled) setVeilBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, bowDepositAsset, connectedAddress]);

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

  // User cancel for long ZK quote runs (batch proving grinds N notes with no
  // wallet popup by design). Set on prover-modal close; loops check it between
  // notes so closing the modal actually stops the work. Reset at each run.
  const zkCancelRef = useRef(false);

  // User-facing expiry for signatures the wallet signs (root-audit F2): the
  // Execution Settings "Transaction Deadline" actually drives these instead
  // of hardcoded TTLs. Clamped to [5 minutes, 24 hours].
  function userDeadlineSeconds(): number {
    const minutes = Number.parseFloat(deadlineMinutes);
    if (!Number.isFinite(minutes)) return 20 * 60;
    return Math.min(86400, Math.max(300, Math.floor(minutes * 60)));
  }

  // 0xbow deposit input validity: the amount must parse to the exact FIXED
  // denomination (0.001 both assets — the pools' immutable DEPOSIT_DENOMINATION,
  // never the entrypoint minimumDeposit floor). Anything else disables
  // execution with an honest message, never an alert().
  const isBowEthDeposit = bowDepositAsset === "ETH";
  let parsedBowDeposit: bigint | null = null;
  try {
    const candidate = parseEther(inputAmount);
    if (candidate > 0n) parsedBowDeposit = candidate;
  } catch {
    parsedBowDeposit = null;
  }
  const bowExpectedDenomination = isBowEthDeposit ? TESTNET_BOW_V3_ETH_DENOMINATION : TESTNET_BOW_V3_VEIL_DENOMINATION;
  const bowDepositMatchesDenomination =
    parsedBowDeposit !== null &&
    bowExpectedDenomination !== null &&
    parsedBowDeposit === bowExpectedDenomination;
  // Buy CTA state, computed once and shared with BuyAndShieldPanel.
  const buyCtaDisabled =
    isExecuting ||
    (Boolean(connectedAddress) &&
      (parsedBowDeposit === null ||
        (!isBowEthDeposit && veilMinimum === null) ||
        !bowDepositMatchesDenomination));

  // Task 3 gated-path VEIL input validity. Null disables gated execution;
  // the reason is shown in the gated panel, never an alert().
  let parsedGatedIn: bigint | null = null;
  try {
    const gatedCandidate = parseEther(gatedAmountIn);
    if (gatedCandidate > 0n) parsedGatedIn = gatedCandidate;
  } catch {
    parsedGatedIn = null;
  }

  // Full-ZK Swap-to-Shield derived state (fresh suite only, paused-route stays dead).
  // Direction follows the selected 0xbow note: ETH notes swap ETH -> VEIL and
  // shield into the fresh VEIL pool; VEIL notes do the reverse.
  const zkNote =
    notes.find((n) => n.nullifier === selectedNoteNullifier && isBowNote(n)) ??
    notes.find((n) => isBowNote(n)) ??
    null;
  const zkIsEthIn = zkNote
    ? zkNote.asset.toLowerCase() === ETH_ZERO_ADDRESS.toLowerCase()
    : true;
  const zkWithdrawAsset = (
    zkIsEthIn ? ETH_ZERO_ADDRESS : TESTNET_BOW_V3_VEIL_TOKEN
  ) as Address;
  const zkDepositAsset = (
    zkIsEthIn ? TESTNET_BOW_V3_VEIL_TOKEN : ETH_ZERO_ADDRESS
  ) as Address;
  const zkDepositValue: bigint | null = zkIsEthIn
    ? TESTNET_BOW_V3_VEIL_DENOMINATION
    : TESTNET_BOW_V3_ETH_DENOMINATION;
  const zkNoteValid =
    zkNote !== null && zkDepositValue !== null && zkDepositValue > 0n;
  const zkQuoteDisabled =
    isExecuting || isZkQuoting || !connectedAddress || !zkNoteValid;

  // Shielded Swap tab derived state: source-note picker over 0xbow ETH/VEIL
  // notes from the vault, destination fixed by direction (VEIL -> 0.001 ETH
  // note, ETH -> VEIL per the live minimum). Direction binding is enforced
  // through resolveZkShieldedSwapAssets so VEIL->ETH and ETH->VEIL are the
  // only pairs; anything else fails closed before any simulation.
  const zkBowNotes = notes.filter((n) => isBowNote(n));
  const zkShieldedSwapOptions = zkBowNotes.map((n) => {
    const bow = n;
    const isEth = bow.asset.toLowerCase() === ETH_ZERO_ADDRESS.toLowerCase();
    return {
      nullifier: bow.nullifier,
      label: `${formatEther(BigInt(bow.denomination))} ${isEth ? "ETH" : "VEIL"} note`,
      assetSymbol: (isEth ? "ETH" : "VEIL") as "ETH" | "VEIL",
    };
  });
  const zkShieldedSwapHasQuote =
    (zkBundle !== null || zkMultiBundle !== null) && zkQuoteOut !== null && zkMinOut !== null;
  const zkShieldedSwapExecuteDisabled = isZkExecuteDisabled({
    isExecuting,
    connected: Boolean(connectedAddress),
    noteValid: zkNoteValid,
    isQuoting: isZkQuoting,
    hasQuote: zkShieldedSwapHasQuote,
  });
  const zkShieldedSwapDestinationLabel = zkIsEthIn
    ? `${formatEther(TESTNET_BOW_V3_VEIL_DENOMINATION)} VEIL note`
    : `${formatEther(TESTNET_BOW_V3_ETH_DENOMINATION)} ETH note`;
  const zkShieldedSwapSourceLabel = zkNote
    ? `${formatEther(BigInt(zkNote.denomination))} ${zkIsEthIn ? "ETH" : "VEIL"} note`
    : "No 0xbow note in vault";

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

  // Full-ZK Swap-to-Shield: atomic relay -> swap -> deposit in ONE transaction
  // via VeilZkRouter.executeFullZkFlow on Robinhood Testnet (fresh suite only,
  // paused-route stays dead). Quote FIRST via free exact-calldata simulations (no tx,
  // minSwapOut bracketed live), then execute with the slippage-bound min.
  // Prover-modal steps mirror the 0xbow flows: prove -> relay-in-tx -> swap ->
  // deposit -> verify. The single send below is guarded by revalidateWallet.
  function zkProverSteps(): ZkProverStep[] {
    return [
      {
        title: "1. Client-Side Groth16 ZK-SNARK Proving",
        detail: "Executing snarkjs Groth16 prover in browser against onchain State & ASP Merkle trees",
        status: "running",
      },
      {
        title: "2. Atomic Relay Leg (relay-in-tx)",
        detail: "Relay exit lands in the ZK router inside executeFullZkFlow",
        status: "pending",
      },
      {
        title: "3. Atomic Swap Leg (swap-in-tx)",
        detail: "Exact-input v4 swap through PoolManager.unlock in the same transaction",
        status: "pending",
      },
      {
        title: "4. Atomic Deposit Leg + Settlement (deposit-in-tx)",
        detail: "Swap output shields into the fresh 0xbow pool, dust refunds immediately",
        status: "pending",
      },
      {
        title: "5. Receipt Verification & Vault Update",
        detail: "Asserting FullZkFlowExecuted, spent nullifier and Deposited event before saving",
        status: "pending",
      },
    ];
  }

  async function handleZkQuote() {
    setFlowError(null);
    setZkQuoteNote(null);
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
    if (connectedChainId !== TESTNET_ZK_ROUTER_CHAIN_ID) {
      setFlowError(
        "Full-ZK Swap-to-Shield lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. Nothing was simulated."
      );
      return;
    }
    if (!isTestnetBowV3Configured()) {
      setFlowError("The 0xbow deposit suite is not configured. Nothing was simulated.");
      return;
    }
    if (!zkNote || !isBowNote(zkNote)) {
      setFlowError("Select a 0xbow shielded note first. Nothing was simulated.");
      return;
    }
    if (zkDepositValue === null || zkDepositValue <= 0n) {
      setFlowError(
        "The live deposit amount is still loading. Wait for it to load and try again. Nothing was simulated."
      );
      return;
    }
    const bowNote = zkNote;
    const zeroForOne = zkIsEthIn;
    const depositValue = zkDepositValue;
    const depositAsset = zkDepositAsset;
    const withdrawAsset = zkWithdrawAsset;

    if (txInFlight.current > 0) return;
    setIsExecuting(true);
    setIsZkQuoting(true);
    setProverTitle("Full-ZK Swap to Shield (Testnet)");
    setProverTxHash(null);
    setZkTxHash(null);
    setProverCommitment(bowNote.commitmentHash);
    setProverCommitted(false);
    setProverSteps(zkProverSteps());
    setIsProverOpen(true);

    try {
      txInFlight.current += 1;
      const testnetClient = createTestnetBowPublicClient();
      const isVeilBowNote =
        typeof bowNote.asset === "string" &&
        bowNote.asset.toLowerCase() === TESTNET_BOW_V3_VEIL_TOKEN.toLowerCase();
      const sourcePool = (isVeilBowNote ? TESTNET_BOW_V3_VEIL_POOL : TESTNET_BOW_V3_ETH_POOL) as Address;
      const bowEntrypoint = TESTNET_BOW_V3_ENTRYPOINT;
      const destPool = (zeroForOne ? TESTNET_BOW_V3_VEIL_POOL : TESTNET_BOW_V3_ETH_POOL) as Address;

      // Fresh-suite-only guard: the note scope must match the live source pool.
      const liveSourceScope = await testnetClient.readContract({
        address: sourcePool,
        abi: BOW_POOL_SCOPE_ABI,
        functionName: "SCOPE",
      });
      if (BigInt(liveSourceScope) !== BigInt(bowNote.scope)) {
        throw new Error(
          "This note does not belong to the fresh 0xbow suite. Full-ZK Swap-to-Shield serves fresh-suite notes only. No transaction was sent."
        );
      }
      const destScope = BigInt(
        await testnetClient.readContract({
          address: destPool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        })
      );

      await fetchPinnedBowArtifact("withdraw.wasm");
      await fetchPinnedBowArtifact("withdraw.zkey");
      try {
        await fetch("/api/asp/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: BigInt(bowNote.label).toString() }),
        });
      } catch {}

      const scope = BigInt(bowNote.scope);
      const denomination = BigInt(bowNote.denomination);
      const label = BigInt(bowNote.label);
      const nullifier = BigInt(bowNote.nullifier);
      const secret = BigInt(bowNote.secret);
      const commitmentHash = BigInt(bowNote.commitmentHash);

      // Fail fast on corrupted vault notes before minutes of proving (F-03).
      await assertBowNoteIntegrity(testnetClient, sourcePool, bowNote);

      let { orderedCommitments, labels } = await fetchBowPoolEvents(testnetClient, sourcePool);
      if (!orderedCommitments.includes(commitmentHash)) {
        throw new Error(
          "Deposit commitment not found in onchain state tree. Please ensure your deposit transaction was confirmed."
        );
      }
      let stateTree = buildBowStateTree(orderedCommitments);
      // State-root freshness gate (F-02): never prove against a stale tree.
      const liveZkStateRoot = await testnetClient.readContract({
        address: sourcePool,
        abi: BOW_POOL_STATE_ABI,
        functionName: "currentRoot",
      });
      if (stateTree.root !== BigInt(liveZkStateRoot)) {
        throw new Error(
          "Onchain state changed while preparing (new deposit landed). Retry — no transaction was sent."
        );
      }
      // ASP is entrypoint-global: union labels across BOTH pools, or the set
      // permanently mismatches once a second pool holds deposits.
      labels = await fetchBowAspLabelsAllPools(testnetClient, [TESTNET_BOW_V3_ETH_POOL, TESTNET_BOW_V3_VEIL_POOL]);
      let aspSet = buildBowAssociationSet(labels);
      if (!aspSet.labels.includes(label)) {
        throw new Error("Deposit label not found in Association Set. Try syncing ASP.");
      }
      let onchainAspRoot = await testnetClient.readContract({
        address: bowEntrypoint,
        abi: BOW_ENTRYPOINT_RELAY_ABI,
        functionName: "latestRoot",
      });
      if (aspSet.root !== BigInt(onchainAspRoot)) {
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
                "ASP sync is throttled right now. Wait a few minutes and try again."
            );
          }
        } catch (e: unknown) {
          if (e instanceof Error && /throttl|retry/i.test(e.message)) throw e;
        }
        const refreshed = await fetchBowPoolEvents(testnetClient, sourcePool);
        orderedCommitments = refreshed.orderedCommitments;
        labels = await fetchBowAspLabelsAllPools(testnetClient, [TESTNET_BOW_V3_ETH_POOL, TESTNET_BOW_V3_VEIL_POOL]);
        if (!orderedCommitments.includes(commitmentHash)) {
          throw new Error("Deposit commitment not found in onchain state tree after ASP re-sync.");
        }
        stateTree = buildBowStateTree(orderedCommitments);
        aspSet = buildBowAssociationSet(labels);
        onchainAspRoot = await testnetClient.readContract({
          address: bowEntrypoint,
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
        entrypoint: bowEntrypoint,
        recipient: TESTNET_ZK_ROUTER_ADDRESS,
        feeRecipient: connectedAddress,
        scope,
      });
      const accountService = new AccountService(null as never, {
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
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "running" },
        prev[2],
        prev[3],
        prev[4],
      ]);

      const pc = withdrawalProof.proof;
      const proofStruct = {
        pA: [BigInt(pc.pi_a[0]), BigInt(pc.pi_a[1])] as [bigint, bigint],
        pB: [
          [BigInt(pc.pi_b[0][1]), BigInt(pc.pi_b[0][0])],
          [BigInt(pc.pi_b[1][1]), BigInt(pc.pi_b[1][0])],
        ] as [[bigint, bigint], [bigint, bigint]],
        pubSignals: withdrawalProof.publicSignals.map(BigInt),
        pC: [BigInt(pc.pi_c[0]), BigInt(pc.pi_c[1])] as [bigint, bigint],
      };
      if (proofStruct.pubSignals.length !== 8) {
        throw new Error("Withdrawal proof has an unexpected shape. No transaction was sent.");
      }
      const proof = {
        ...proofStruct,
        pubSignals: proofStruct.pubSignals as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
      };

      const newSecrets = createBowDepositSecrets(destScope);
      const slip = parseSlippagePercent(slippage);
      const base = {
        withdrawal: {
          processooor: withdrawal.processooor as Address,
          data: withdrawal.data as `0x${string}`,
        },
        proof,
        scope,
        withdrawAsset,
        depositAsset,
        depositValue,
        precommitment: newSecrets.precommitment,
        zeroForOne,
      };
      const quoted = await quoteAndBuildFullZkFlow(testnetClient, {
        account: connectedAddress,
        base,
        slippagePercent: slip,
      });
      const floor = quoted.quotedSwapOut;
      const minSwapOut = quoted.minSwapOut;
      const probes = quoted.probes;
      const spentNullifier = BigInt(withdrawalProof.publicSignals[1]);

      setZkBundle({
        ...base,
        destPool,
        sourcePool,
        nullifier,
        secret,
        label,
        newNullifier: newSecrets.nullifier,
        newSecret: newSecrets.secret,
        spentNullifier,
        quotedSwapOut: floor,
        minSwapOut,
      });
      setZkQuoteOut(floor);
      setZkMinOut(minSwapOut);
      setZkQuoteNote(
        `Live quote locked after ${probes} free simulations: ${formatEther(floor)} ${zeroForOne ? "VEIL" : "ETH"} (min ${formatEther(minSwapOut)} at ${slip}% slippage). Review and execute — execution re-simulates before sending.`
      );
      setIsProverOpen(true);
    } catch (e: unknown) {
      console.error("Full-ZK quote error:", e);
      setIsProverOpen(false);
      setZkBundle(null);
      setZkQuoteOut(null);
      setZkMinOut(null);
      setFlowError(mapZkRouterError(e));
    } finally {
      setIsZkQuoting(false);
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  async function handleZkFullFlow() {
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
    if (connectedChainId !== TESTNET_ZK_ROUTER_CHAIN_ID) {
      setFlowError(
        "Full-ZK Swap-to-Shield lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }
    if (!zkBundle) {
      setFlowError("Refresh the live quote first. No transaction was sent.");
      return;
    }
    let slip: number;
    try {
      slip = parseSlippagePercent(slippage);
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Invalid slippage setting.");
      return;
    }
    // Deposit drift re-check: both legs deposit fixed 0.001 notes. The bundle
    // must carry the fixed denomination or the pool reverts InvalidDenomination.
    if (zkBundle.depositValue !== (zkIsEthIn ? TESTNET_BOW_V3_VEIL_DENOMINATION : TESTNET_BOW_V3_ETH_DENOMINATION)) {
      setFlowError(
        "The quoted deposit no longer matches the pool fixed denomination. Refresh the live quote and try again. No transaction was sent."
      );
      return;
    }

    if (txInFlight.current > 0) return;
    setIsExecuting(true);
    setProverTitle("Full-ZK Swap to Shield (Testnet)");
    setProverSteps([
      { ...zkProverSteps()[0], status: "completed" },
      { ...zkProverSteps()[1], status: "running" },
      zkProverSteps()[2],
      zkProverSteps()[3],
      zkProverSteps()[4],
    ]);
    setIsProverOpen(true);

    try {
      txInFlight.current += 1;
      const testnetClient = createTestnetBowPublicClient();
      const rebuilt = buildFullZkFlowArgs({
        withdrawal: zkBundle.withdrawal,
        proof: zkBundle.proof,
        scope: zkBundle.scope,
        withdrawAsset: zkBundle.withdrawAsset,
        depositAsset: zkBundle.depositAsset,
        depositValue: zkBundle.depositValue,
        precommitment: zkBundle.precommitment,
        zeroForOne: zkBundle.zeroForOne,
        quotedSwapOut: zkBundle.quotedSwapOut,
        slippagePercent: slip,
      });
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });
      await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
      try {
        await simulateFullZkFlow(testnetClient, {
          account: connectedAddress,
          args: rebuilt,
        });
      } catch (e: unknown) {
        throw new Error(mapZkRouterError(e, slip));
      }
      const fullHash = await walletClient.writeContract({
        address: TESTNET_ZK_ROUTER_ADDRESS,
        abi: VEIL_ZK_ROUTER_ABI,
        functionName: "executeFullZkFlow",
        args: [
          rebuilt.withdrawal,
          rebuilt.proof as never,
          rebuilt.scope,
          rebuilt.recipient,
          rebuilt.withdrawAsset,
          rebuilt.depositAsset,
          rebuilt.depositValue,
          rebuilt.precommitment,
          rebuilt.swapLeg as never,
          rebuilt.minSwapOut,
        ],
      });
      setProverTxHash(fullHash);
      setZkTxHash(fullHash);

      const receipt = await waitForTransactionReceipt(testnetClient, { hash: fullHash });
      if (receipt.status !== "success") throw new Error("Full-ZK flow transaction reverted onchain.");

      setProverSteps((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "completed" },
        { ...prev[3], status: "completed" },
        { ...prev[4], status: "running" },
      ]);

      const poolLogs = await testnetClient.getContractEvents({
        address: zkBundle.destPool,
        abi: parseAbi([
          "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)",
        ]),
        eventName: "Deposited",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      const ownLog = poolLogs.find(
        (l) => l.transactionHash.toLowerCase() === fullHash.toLowerCase()
      );
      if (!ownLog)
        throw new Error(
          "Flow confirmed but our Deposited event was not found in the receipt block. No note was saved. Check the transaction on the explorer."
        );
      const destLabel = BigInt(ownLog.args._label ?? 0n);
      const onchainValue = BigInt(ownLog.args._value ?? 0n);
      if (onchainValue !== zkBundle.depositValue) {
        throw new Error("Deposited value mismatch: onchain event does not match the quoted deposit value.");
      }
      const destScope = BigInt(
        await testnetClient.readContract({
          address: zkBundle.destPool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        })
      );
      const newNote = createBowNote({
        scope: destScope,
        denomination: zkBundle.depositValue,
        label: destLabel,
        nullifier: zkBundle.newNullifier,
        secret: zkBundle.newSecret,
        precommitment: zkBundle.precommitment,
        txHash: fullHash,
        blockNumber: receipt.blockNumber,
        asset: zkBundle.depositAsset,
        chainId: TESTNET_CHAIN_ID,
      });
      if (BigInt(newNote.commitmentHash) !== BigInt(ownLog.args._commitment ?? 0n)) {
        throw new Error("Commitment derivation mismatch between local note and onchain event.");
      }
      const flowEvent = findFullZkFlowExecuted(
        receipt.logs.map((l) => ({ data: l.data as `0x${string}`, topics: [...l.topics] as `0x${string}`[] })),
        BigInt(newNote.commitmentHash),
        connectedAddress
      );
      if (!flowEvent) {
        throw new Error(
          "Flow confirmed but no matching FullZkFlowExecuted event for this commitment was found. The note was NOT saved — verify on the explorer before retrying."
        );
      }
      const spentOnchain = await testnetClient.readContract({
        address: zkBundle.sourcePool,
        abi: parseAbi(["function nullifierHashes(uint256) view returns (bool)"]),
        functionName: "nullifierHashes",
        args: [zkBundle.spentNullifier],
      });
      if (!spentOnchain) {
        throw new Error(
          "Flow confirmed but the nullifier does not read as spent onchain. The note was NOT removed — verify on the explorer before retrying."
        );
      }

      const remaining = notes.filter((n) => (isBowNote(n) ? BigInt(n.nullifier) !== zkBundle.nullifier : true));
      setNotes(remaining);
      setSelectedNote(newNote);
      setProverCommitment(newNote.commitmentHash);
      savePendingNote(newNote, fullHash, zkBundle.destPool);
      saveNoteLocally(newNote);
      clearPendingNoteByTx(fullHash);
      setProverCommitted(true);

      fetch("/api/asp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: destLabel.toString() }),
      }).catch((err) => console.warn("Background ASP sync:", err));

      if (connectedAddress) {
        try {
          const liveBals = await fetchAllTokenBalances(connectedAddress, SUPPORTED_TOKENS);
          setTokenBalances(liveBals);
        } catch {}
      }

      setZkBundle(null);
      setZkQuoteOut(null);
      setZkMinOut(null);
      setZkQuoteNote("Full-ZK flow confirmed onchain. Refresh the live quote for the next flow.");
      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        prev[3],
        { ...prev[4], status: "completed" },
      ]);
      setIsProverOpen(true);
    } catch (e: unknown) {
      console.error("Full-ZK flow error:", e);
      setIsProverOpen(false);
      let slipForMap: number | undefined;
      try {
        slipForMap = parseSlippagePercent(slippage);
      } catch {
        slipForMap = undefined;
      }
      setFlowError(mapZkRouterError(e, slipForMap));
    } finally {
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  // Shielded Swap tab: quote FIRST via free exact-calldata simulations
  // (no tx), derive minSwapOut from the live quote x slippage, then execute
  // with revalidateWallet, pre-send re-simulation and receipt asserts
  // (relay + swap + deposit events). Single-note flow runs when one note
  // funds the destination; the batched multi-note flow
  // (executeMultiFullZkFlow) is quoted only when the single-note live swap
  // output cannot fund the destination note
  // (InsufficientOutputForDenomination). Every revert fails closed via
  // mapZkRouterError; this handler never sends before the pre-send sim.
  async function handleZkShieldedSwapQuote() {
    setFlowError(null);
    setZkQuoteNote(null);
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
    if (connectedChainId !== TESTNET_ZK_ROUTER_CHAIN_ID) {
      setFlowError(
        "Shielded Swap lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. Nothing was simulated."
      );
      return;
    }
    if (!isTestnetBowV3Configured()) {
      setFlowError("The 0xbow deposit suite is not configured. Nothing was simulated.");
      return;
    }
    if (!zkNote || !isBowNote(zkNote)) {
      setFlowError("Select a 0xbow shielded note first. Nothing was simulated.");
      return;
    }
    // Direction binding: VEIL->ETH (zeroForOne false) or ETH->VEIL
    // (zeroForOne true). Any other asset fails closed before any simulation.
    let bound: { withdrawAsset: Address; depositAsset: Address; zeroForOne: boolean };
    try {
      bound = resolveZkShieldedSwapAssets({ sourceAsset: zkNote.asset });
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Unsupported note asset. Nothing was simulated.");
      return;
    }
    let depositValue: bigint;
    try {
      depositValue = resolveZkShieldedSwapDeposit({
        withdrawAsset: bound.withdrawAsset,
        veilMinimum,
      });
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "The live deposit amount is still loading. Nothing was simulated.");
      return;
    }
    const bowNote = zkNote;
    const { withdrawAsset, depositAsset, zeroForOne } = bound;

    if (txInFlight.current > 0) return;
    setIsExecuting(true);
    setIsZkQuoting(true);
    zkCancelRef.current = false;
    setProverTitle("Shielded Swap Quote (Testnet)");
    setProverTxHash(null);
    setZkTxHash(null);
    setProverCommitment(bowNote.commitmentHash);
    setProverCommitted(false);
    setProverSteps(zkProverSteps());
    setIsProverOpen(true);

    try {
      txInFlight.current += 1;
      const testnetClient = createTestnetBowPublicClient();
      const isVeilBowNote =
        typeof bowNote.asset === "string" &&
        bowNote.asset.toLowerCase() === TESTNET_BOW_V3_VEIL_TOKEN.toLowerCase();
      const sourcePool = (isVeilBowNote ? TESTNET_BOW_V3_VEIL_POOL : TESTNET_BOW_V3_ETH_POOL) as Address;
      const bowEntrypoint = TESTNET_BOW_V3_ENTRYPOINT;
      const destPool = (zeroForOne ? TESTNET_BOW_V3_VEIL_POOL : TESTNET_BOW_V3_ETH_POOL) as Address;

      const liveSourceScope = await testnetClient.readContract({
        address: sourcePool,
        abi: BOW_POOL_SCOPE_ABI,
        functionName: "SCOPE",
      });
      if (BigInt(liveSourceScope) !== BigInt(bowNote.scope)) {
        throw new Error(
          "This note does not belong to the fresh 0xbow suite. Shielded Swap serves fresh-suite notes only. No transaction was sent."
        );
      }
      const destScope = BigInt(
        await testnetClient.readContract({
          address: destPool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        })
      );

      await fetchPinnedBowArtifact("withdraw.wasm");
      await fetchPinnedBowArtifact("withdraw.zkey");
      try {
        await fetch("/api/asp/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: BigInt(bowNote.label).toString() }),
        });
      } catch {}

      const scope = BigInt(bowNote.scope);
      const denomination = BigInt(bowNote.denomination);
      const label = BigInt(bowNote.label);
      const nullifier = BigInt(bowNote.nullifier);
      const secret = BigInt(bowNote.secret);
      const commitmentHash = BigInt(bowNote.commitmentHash);

      // Fail fast on corrupted vault notes before minutes of proving (F-03).
      await assertBowNoteIntegrity(testnetClient, sourcePool, bowNote);

      let { orderedCommitments, labels } = await fetchBowPoolEvents(testnetClient, sourcePool);
      if (!orderedCommitments.includes(commitmentHash)) {
        throw new Error(
          "Deposit commitment not found in onchain state tree. Please ensure your deposit transaction was confirmed."
        );
      }
      let stateTree = buildBowStateTree(orderedCommitments);
      // State-root freshness gate (F-02): never prove against a stale tree.
      const liveShieldedSwapStateRoot = await testnetClient.readContract({
        address: sourcePool,
        abi: BOW_POOL_STATE_ABI,
        functionName: "currentRoot",
      });
      if (stateTree.root !== BigInt(liveShieldedSwapStateRoot)) {
        throw new Error(
          "Onchain state changed while preparing (new deposit landed). Retry — no transaction was sent."
        );
      }
      labels = await fetchBowAspLabelsAllPools(testnetClient, [TESTNET_BOW_V3_ETH_POOL, TESTNET_BOW_V3_VEIL_POOL]);
      let aspSet = buildBowAssociationSet(labels);
      if (!aspSet.labels.includes(label)) {
        throw new Error("Deposit label not found in Association Set. Try syncing ASP.");
      }
      const onchainAspRoot = await testnetClient.readContract({
        address: bowEntrypoint,
        abi: BOW_ENTRYPOINT_RELAY_ABI,
        functionName: "latestRoot",
      });
      if (aspSet.root !== BigInt(onchainAspRoot)) {
        throw new Error(
          "Association Set root is not synced onchain. Wait for the ASP sync transaction to confirm and try again."
        );
      }

      const stateMerkleProof = stateTree.proof(commitmentHash);
      const aspMerkleProof = buildBowAssociationProof(aspSet, label);
      const sdk = createBowSdk();
      const singleContext = createBowWithdrawalContext({
        entrypoint: bowEntrypoint,
        recipient: TESTNET_ZK_ROUTER_ADDRESS,
        feeRecipient: connectedAddress,
        scope,
      });
      const accountService = new AccountService(null as never, {
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
        context: singleContext.context,
        newNullifier: secretPair.nullifier,
        newSecret: secretPair.secret,
      });
      const isValid = await sdk.verifyWithdrawal(withdrawalProof);
      if (!isValid) throw new Error("Local verification of Groth16 withdrawal proof failed.");

      setProverSteps((prev) => [
        { ...prev[0], status: "completed" },
        { ...prev[1], status: "running" },
        prev[2],
        prev[3],
        prev[4],
      ]);

      const pc = withdrawalProof.proof;
      const proofStruct = {
        pA: [BigInt(pc.pi_a[0]), BigInt(pc.pi_a[1])] as [bigint, bigint],
        pB: [
          [BigInt(pc.pi_b[0][1]), BigInt(pc.pi_b[0][0])],
          [BigInt(pc.pi_b[1][1]), BigInt(pc.pi_b[1][0])],
        ] as [[bigint, bigint], [bigint, bigint]],
        pubSignals: withdrawalProof.publicSignals.map(BigInt),
        pC: [BigInt(pc.pi_c[0]), BigInt(pc.pi_c[1])] as [bigint, bigint],
      };
      if (proofStruct.pubSignals.length !== 8) {
        throw new Error("Withdrawal proof has an unexpected shape. No transaction was sent.");
      }
      const proof = {
        ...proofStruct,
        pubSignals: proofStruct.pubSignals as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
      };

      const newSecrets = createBowDepositSecrets(destScope);
      const slip = parseSlippagePercent(slippage);
      const singleBase = {
        withdrawal: {
          processooor: singleContext.withdrawal.processooor as Address,
          data: singleContext.withdrawal.data as `0x${string}`,
        },
        proof,
        scope,
        withdrawAsset,
        depositAsset,
        depositValue,
        precommitment: newSecrets.precommitment,
        zeroForOne,
      };
      // Quote FIRST via free exact-calldata simulations (no tx). The single
      // flow is tried first; only InsufficientOutputForDenomination falls
      // through to the batched multi-note flow.
      try {
        const quoted = await quoteAndBuildFullZkFlow(testnetClient, {
          account: connectedAddress,
          base: singleBase,
          slippagePercent: slip,
        });
        const spentNullifier = BigInt(withdrawalProof.publicSignals[1]);
        setZkBundle({
          ...singleBase,
          destPool,
          sourcePool,
          nullifier,
          secret,
          label,
          newNullifier: newSecrets.nullifier,
          newSecret: newSecrets.secret,
          spentNullifier,
          quotedSwapOut: quoted.quotedSwapOut,
          minSwapOut: quoted.minSwapOut,
        });
        setZkMultiBundle(null);
        setZkFlowKind("single");
        setZkQuoteOut(quoted.quotedSwapOut);
        setZkMinOut(quoted.minSwapOut);
        setZkQuoteNote(
          `Live quote locked after ${quoted.probes} free simulations: ${formatEther(quoted.quotedSwapOut)} ${zeroForOne ? "VEIL" : "ETH"} (min ${formatEther(quoted.minSwapOut)} at ${slip}% slippage, single note). Review and execute — execution re-simulates before sending.`
        );
        setIsProverOpen(true);
        return;
      } catch (singleErr: unknown) {
        const singleMsg = singleErr instanceof Error ? singleErr.message : String(singleErr);
        if (!/InsufficientOutputForDenomination/i.test(singleMsg)) throw singleErr;
        // One note cannot fund the destination note — fall through to the
        // batched multi-note flow below (same asset and scope, max 8).
      }

      // Batched multi-note path: same-asset, same-scope notes from the vault.
      const batchAsset = (bowNote.asset as string).toLowerCase() === TESTNET_BOW_V3_VEIL_TOKEN.toLowerCase() ? "VEIL" : "ETH";
      const batch = zkBowNotes
        .filter(
          (n) =>
            isBowNote(n) &&
            (n.asset as string).toLowerCase() === (bowNote.asset as string).toLowerCase() &&
            BigInt(n.scope) === scope
        )
        .slice(0, 8);
      if (batch.length < 2) {
        throw new Error(
          `One ${batchAsset} note's swap output is below the 0.001 deposit note, and you hold ${batch.length} ${batchAsset} note(s) — batching needs at least 2. Deposit ${2 - batch.length} more 0.001 ${batchAsset} note(s) (same asset, back each one up), then Refresh Quote: the batch flow combines up to 8 notes into one atomic swap. No transaction was sent.`
        );
      }
      const multiWithdrawals: { processooor: Address; data: `0x${string}` }[] = [];
      const multiProofs: {
        pA: [bigint, bigint];
        pB: [[bigint, bigint], [bigint, bigint]];
        pC: [bigint, bigint];
        pubSignals: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
      }[] = [];
      const multiScopes: bigint[] = [];
      const multiSpent: bigint[] = [];
      const multiNullifiers: bigint[] = [];
      // The batched proofs below reuse the single-path tree built above, but
      // only after the single-flow quote simulations ran — re-gate freshness
      // (F-02) so a stale tree fails fast instead of burning batch proving.
      const liveBatchStateRoot = await testnetClient.readContract({
        address: sourcePool,
        abi: BOW_POOL_STATE_ABI,
        functionName: "currentRoot",
      });
      if (stateTree.root !== BigInt(liveBatchStateRoot)) {
        throw new Error(
          "Onchain state changed while preparing (new deposit landed). Retry — no transaction was sent."
        );
      }
      for (let batchIdx = 0; batchIdx < batch.length; batchIdx += 1) {
        const batchNote = batch[batchIdx];
        // User cancel lands here: closing the prover modal stops the batch
        // between notes instead of grinding to the end in the background.
        if (zkCancelRef.current) {
          throw new Error("Shielded Swap quote cancelled by user. No transaction was sent.");
        }
        // Visible progress: N sequential browser proofs with no wallet popup
        // by design looked exactly like a hang (30+ min silent).
        setProverSteps((prev) =>
          prev.map((s, i) =>
            i === 1
              ? {
                  ...s,
                  detail: `Batch proving note ${batchIdx + 1} of ${batch.length} (Groth16 in browser, minutes per note — leave this tab open)`,
                }
              : s
          )
        );
        console.log(`[zk-batch] proving note ${batchIdx + 1}/${batch.length}...`);
        const batchT0 = Date.now();
        if (!isBowNote(batchNote)) continue;
        // Fail fast on corrupted vault notes before minutes of proving (F-03).
        await assertBowNoteIntegrity(testnetClient, sourcePool, batchNote);
        const bCommitment = BigInt(batchNote.commitmentHash);
        if (!orderedCommitments.includes(bCommitment)) continue;
        const bStateProof = stateTree.proof(bCommitment);
        const bLabel = BigInt(batchNote.label);
        const bAspProof = buildBowAssociationProof(aspSet, bLabel);
        const bScope = BigInt(batchNote.scope);
        const bDenom = BigInt(batchNote.denomination);
        const bNull = BigInt(batchNote.nullifier);
        const bSec = BigInt(batchNote.secret);
        const bService = new AccountService(null as never, {
          mnemonic: generateMnemonic(english, 256),
        });
        bService.addPoolAccount(
          bScope as never,
          bDenom,
          bNull as never,
          bSec as never,
          bLabel as never,
          BigInt(batchNote.blockNumber),
          batchNote.txHash as `0x${string}`
        );
        const bObj: AccountCommitment = {
          hash: bCommitment as never,
          label: bLabel as never,
          nullifier: bNull as never,
          secret: bSec as never,
          value: bDenom,
          blockNumber: BigInt(batchNote.blockNumber),
          txHash: batchNote.txHash as `0x${string}`,
        };
        const bSecrets = bService.createWithdrawalSecrets(bObj);
        const bCtx = createBowWithdrawalContext({
          entrypoint: bowEntrypoint,
          recipient: TESTNET_ZK_ROUTER_MULTI_ADDRESS,
          feeRecipient: connectedAddress,
          scope: bScope,
        });
        const bProof = await sdk.proveWithdrawal(bObj, {
          withdrawalAmount: bDenom,
          stateMerkleProof: bStateProof,
          aspMerkleProof: bAspProof,
          stateRoot: stateTree.root as never,
          stateTreeDepth: 32n,
          aspRoot: aspSet.root as never,
          aspTreeDepth: 32n,
          context: bCtx.context,
          newNullifier: bSecrets.nullifier,
          newSecret: bSecrets.secret,
        });
        const bValid = await sdk.verifyWithdrawal(bProof);
        if (!bValid) throw new Error("Local verification of Groth16 withdrawal proof failed.");
        const bPc = bProof.proof;
        multiWithdrawals.push({
          processooor: bCtx.withdrawal.processooor as Address,
          data: bCtx.withdrawal.data as `0x${string}`,
        });
        multiProofs.push({
          pA: [BigInt(bPc.pi_a[0]), BigInt(bPc.pi_a[1])],
          pB: [
            [BigInt(bPc.pi_b[0][1]), BigInt(bPc.pi_b[0][0])],
            [BigInt(bPc.pi_b[1][1]), BigInt(bPc.pi_b[1][0])],
          ],
          pC: [BigInt(bPc.pi_c[0]), BigInt(bPc.pi_c[1])],
          pubSignals: bProof.publicSignals.map(BigInt) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        });
        multiScopes.push(bScope);
        multiSpent.push(BigInt(bProof.publicSignals[1]));
        multiNullifiers.push(bNull);
        console.log(`[zk-batch] note ${batchIdx + 1}/${batch.length} proven in ${Math.round((Date.now() - batchT0) / 1000)}s`);
      }
      if (multiWithdrawals.length < 2) {
        throw new Error(
          "Full-ZK flow reverted: the live swap output is below the deposit amount (InsufficientOutputForDenomination). The batch could not be proven. No transaction was sent."
        );
      }
      const multiBase = {
        withdrawals: multiWithdrawals,
        proofs: multiProofs,
        scopes: multiScopes,
        withdrawAsset,
        depositAsset,
        depositValue,
        precommitment: newSecrets.precommitment,
        zeroForOne,
      };
      const multiQuoted = await quoteAndBuildMultiFullZkFlow(testnetClient, {
        account: connectedAddress,
        base: multiBase,
        slippagePercent: slip,
      });
      setZkMultiBundle({
        ...multiBase,
        destPool,
        sourcePool,
        spentNullifiers: multiSpent,
        nullifiers: multiNullifiers,
        newNullifier: newSecrets.nullifier,
        newSecret: newSecrets.secret,
        quotedSwapOut: multiQuoted.quotedSwapOut,
        minSwapOut: multiQuoted.minSwapOut,
      });
      setZkBundle(null);
      setZkFlowKind("multi");
      setZkQuoteOut(multiQuoted.quotedSwapOut);
      setZkMinOut(multiQuoted.minSwapOut);
      setZkQuoteNote(
        `Live batched quote locked after ${multiQuoted.probes} free simulations (${multiWithdrawals.length} notes): ${formatEther(multiQuoted.quotedSwapOut)} ${zeroForOne ? "VEIL" : "ETH"} (min ${formatEther(multiQuoted.minSwapOut)} at ${slip}% slippage). Review and execute — execution re-simulates before sending.`
      );
      setIsProverOpen(true);
    } catch (e: unknown) {
      console.error("Shielded Swap quote error:", e);
      setIsProverOpen(false);
      setZkBundle(null);
      setZkMultiBundle(null);
      setZkFlowKind(null);
      setZkQuoteOut(null);
      setZkMinOut(null);
      setFlowError(mapZkRouterError(e));
    } finally {
      setIsZkQuoting(false);
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  async function handleZkShieldedSwapExecute() {
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
    if (connectedChainId !== TESTNET_ZK_ROUTER_CHAIN_ID) {
      setFlowError(
        "Shielded Swap lives on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }
    if (!zkBundle && !zkMultiBundle) {
      setFlowError("Refresh the live quote first. No transaction was sent.");
      return;
    }
    let slip: number;
    try {
      slip = parseSlippagePercent(slippage);
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Invalid slippage setting.");
      return;
    }
    // Deposit drift re-check: both legs deposit fixed 0.001 notes. The quoted
    // bundle must carry the fixed denomination or the pool reverts.
    const activeDepositValue = zkMultiBundle?.depositValue ?? zkBundle?.depositValue;
    const fixedDepositValue = zkIsEthIn ? TESTNET_BOW_V3_VEIL_DENOMINATION : TESTNET_BOW_V3_ETH_DENOMINATION;
    if (activeDepositValue !== fixedDepositValue) {
      setFlowError(
        "The quoted deposit no longer matches the pool fixed denomination. Refresh the live quote and try again. No transaction was sent."
      );
      return;
    }

    if (txInFlight.current > 0) return;
    setIsExecuting(true);
    setProverTitle("Shielded Swap Execute (Testnet)");
    setProverSteps([
      { ...zkProverSteps()[0], status: "completed" },
      { ...zkProverSteps()[1], status: "running" },
      zkProverSteps()[2],
      zkProverSteps()[3],
      zkProverSteps()[4],
    ]);
    setIsProverOpen(true);

    try {
      txInFlight.current += 1;
      const testnetClient = createTestnetBowPublicClient();
      const walletClient = createWalletClient({
        account: connectedAddress,
        chain: appChain,
        transport: custom(activeProvider),
      });

      if (zkFlowKind === "multi" && zkMultiBundle) {
        // Batched path: pre-send simulation of the exact multi calldata,
        // then executeMultiFullZkFlow in one atomic transaction.
        // Ordering (revalidate -> simulate -> write) lives in the shipped
        // runShieldedSwapPreSendSequence helper so the ordering test pins
        // runtime call order via mocks, not source comments.
        const rebuilt = buildMultiFullZkFlowArgs({
          withdrawals: zkMultiBundle.withdrawals,
          proofs: zkMultiBundle.proofs,
          scopes: zkMultiBundle.scopes,
          withdrawAsset: zkMultiBundle.withdrawAsset,
          depositAsset: zkMultiBundle.depositAsset,
          depositValue: zkMultiBundle.depositValue,
          precommitment: zkMultiBundle.precommitment,
          zeroForOne: zkMultiBundle.zeroForOne,
          quotedSwapOut: zkMultiBundle.quotedSwapOut,
          slippagePercent: slip,
        });
        let multiHash: `0x${string}`;
        try {
          multiHash = await runShieldedSwapPreSendSequence({
            flowKind: "multi",
            account: connectedAddress,
            publicClient: testnetClient as never,
            walletClient: walletClient as never,
            revalidate: () =>
              revalidateWallet(activeProvider, connectedAddress as string, connectedChainId),
            multiArgs: rebuilt,
          });
        } catch (e: unknown) {
          throw new Error(mapZkRouterError(e, slip));
        }
        setProverTxHash(multiHash);
        setZkTxHash(multiHash);
        const receipt = await waitForTransactionReceipt(testnetClient, { hash: multiHash });
        if (receipt.status !== "success") throw new Error("Shielded Swap transaction reverted onchain.");

        setProverSteps((prev) => [
          prev[0],
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "completed" },
          { ...prev[3], status: "completed" },
          { ...prev[4], status: "running" },
        ]);

        const poolLogs = await testnetClient.getContractEvents({
          address: zkMultiBundle.destPool,
          abi: parseAbi([
            "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)",
          ]),
          eventName: "Deposited",
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });
        const ownLog = poolLogs.find(
          (l) => l.transactionHash.toLowerCase() === multiHash.toLowerCase()
        );
        if (!ownLog)
          throw new Error(
            "Flow confirmed but our Deposited event was not found in the receipt block. No note was saved. Check the transaction on the explorer."
          );
        const destLabel = BigInt(ownLog.args._label ?? 0n);
        const onchainValue = BigInt(ownLog.args._value ?? 0n);
        if (onchainValue !== zkMultiBundle.depositValue) {
          throw new Error("Deposited value mismatch: onchain event does not match the quoted deposit value.");
        }
        const destScope = BigInt(
          await testnetClient.readContract({
            address: zkMultiBundle.destPool,
            abi: BOW_POOL_SCOPE_ABI,
            functionName: "SCOPE",
          })
        );
        const newNote = createBowNote({
          scope: destScope,
          denomination: zkMultiBundle.depositValue,
          label: destLabel,
          nullifier: zkMultiBundle.newNullifier,
          secret: zkMultiBundle.newSecret,
          precommitment: zkMultiBundle.precommitment,
          txHash: multiHash,
          blockNumber: receipt.blockNumber,
          asset: zkMultiBundle.depositAsset,
          chainId: TESTNET_CHAIN_ID,
        });
        if (BigInt(newNote.commitmentHash) !== BigInt(ownLog.args._commitment ?? 0n)) {
          throw new Error("Commitment derivation mismatch between local note and onchain event.");
        }
        // Relay + swap + deposit receipt asserts: the atomic
        // FullZkFlowExecuted event plus the spent nullifiers.
        const flowEvent = findFullZkFlowExecuted(
          receipt.logs.map((l) => ({ data: l.data as `0x${string}`, topics: [...l.topics] as `0x${string}`[] })),
          BigInt(newNote.commitmentHash),
          connectedAddress
        );
        if (!flowEvent) {
          throw new Error(
            "Flow confirmed but no matching FullZkFlowExecuted event for this commitment was found. The note was NOT saved — verify on the explorer before retrying."
          );
        }
        for (const spent of zkMultiBundle.spentNullifiers) {
          const spentOnchain = await testnetClient.readContract({
            address: zkMultiBundle.sourcePool,
            abi: parseAbi(["function nullifierHashes(uint256) view returns (bool)"]),
            functionName: "nullifierHashes",
            args: [spent],
          });
          if (!spentOnchain) {
            throw new Error(
              "Flow confirmed but a nullifier does not read as spent onchain. Notes were NOT removed — verify on the explorer before retrying."
            );
          }
        }
        const spentSet = new Set(zkMultiBundle.nullifiers.map((n) => n.toString()));
        const remaining = notes.filter((n) => (isBowNote(n) ? !spentSet.has(BigInt(n.nullifier).toString()) : true));
        setNotes(remaining);
        setSelectedNote(newNote);
        setProverCommitment(newNote.commitmentHash);
        savePendingNote(newNote, multiHash, zkMultiBundle.destPool);
        saveNoteLocally(newNote);
        clearPendingNoteByTx(multiHash);
        setProverCommitted(true);
        setZkBundle(null);
        setZkMultiBundle(null);
        setZkFlowKind(null);
        setZkQuoteOut(null);
        setZkMinOut(null);
        setZkQuoteNote("Shielded Swap confirmed onchain. Refresh the live quote for the next flow.");
        setProverSteps((prev) => [
          prev[0],
          prev[1],
          prev[2],
          prev[3],
          { ...prev[4], status: "completed" },
        ]);
        setIsProverOpen(true);
        return;
      }

      if (!zkBundle) {
        setFlowError("Refresh the live quote first. No transaction was sent.");
        return;
      }
      // Single-note path: rebuild with the live slippage, pre-send simulate,
      // then executeFullZkFlow atomically (relay -> swap -> deposit).
      // Ordering lives in runShieldedSwapPreSendSequence (see multi branch).
      const rebuilt = buildFullZkFlowArgs({
        withdrawal: zkBundle.withdrawal,
        proof: zkBundle.proof,
        scope: zkBundle.scope,
        withdrawAsset: zkBundle.withdrawAsset,
        depositAsset: zkBundle.depositAsset,
        depositValue: zkBundle.depositValue,
        precommitment: zkBundle.precommitment,
        zeroForOne: zkBundle.zeroForOne,
        quotedSwapOut: zkBundle.quotedSwapOut,
        slippagePercent: slip,
      });
      let fullHash: `0x${string}`;
      try {
        console.log("[trace-exec] pre-send sequence start");
        fullHash = await runShieldedSwapPreSendSequence({
          flowKind: "single",
          account: connectedAddress,
          publicClient: testnetClient as never,
          walletClient: walletClient as never,
          revalidate: () =>
            revalidateWallet(activeProvider, connectedAddress as string, connectedChainId),
          singleArgs: rebuilt,
        });
        console.log("[trace-exec] pre-send sequence done, submitting tx");
      } catch (e: unknown) {
        throw new Error(mapZkRouterError(e, slip));
      }
      setProverTxHash(fullHash);
      setZkTxHash(fullHash);
      const receipt = await waitForTransactionReceipt(testnetClient, { hash: fullHash });
      if (receipt.status !== "success") throw new Error("Shielded Swap transaction reverted onchain.");

      setProverSteps((prev) => [
        prev[0],
        { ...prev[1], status: "completed" },
        { ...prev[2], status: "completed" },
        { ...prev[3], status: "completed" },
        { ...prev[4], status: "running" },
      ]);

      const poolLogs = await testnetClient.getContractEvents({
        address: zkBundle.destPool,
        abi: parseAbi([
          "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)",
        ]),
        eventName: "Deposited",
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      const ownLog = poolLogs.find(
        (l) => l.transactionHash.toLowerCase() === fullHash.toLowerCase()
      );
      if (!ownLog)
        throw new Error(
          "Flow confirmed but our Deposited event was not found in the receipt block. No note was saved. Check the transaction on the explorer."
        );
      const destLabel = BigInt(ownLog.args._label ?? 0n);
      const onchainValue = BigInt(ownLog.args._value ?? 0n);
      if (onchainValue !== zkBundle.depositValue) {
        throw new Error("Deposited value mismatch: onchain event does not match the quoted deposit value.");
      }
      const destScope = BigInt(
        await testnetClient.readContract({
          address: zkBundle.destPool,
          abi: BOW_POOL_SCOPE_ABI,
          functionName: "SCOPE",
        })
      );
      const newNote = createBowNote({
        scope: destScope,
        denomination: zkBundle.depositValue,
        label: destLabel,
        nullifier: zkBundle.newNullifier,
        secret: zkBundle.newSecret,
        precommitment: zkBundle.precommitment,
        txHash: fullHash,
        blockNumber: receipt.blockNumber,
        asset: zkBundle.depositAsset,
        chainId: TESTNET_CHAIN_ID,
      });
      if (BigInt(newNote.commitmentHash) !== BigInt(ownLog.args._commitment ?? 0n)) {
        throw new Error("Commitment derivation mismatch between local note and onchain event.");
      }
      const flowEvent = findFullZkFlowExecuted(
        receipt.logs.map((l) => ({ data: l.data as `0x${string}`, topics: [...l.topics] as `0x${string}`[] })),
        BigInt(newNote.commitmentHash),
        connectedAddress
      );
      if (!flowEvent) {
        throw new Error(
          "Flow confirmed but no matching FullZkFlowExecuted event for this commitment was found. The note was NOT saved — verify on the explorer before retrying."
        );
      }
      const spentOnchain = await testnetClient.readContract({
        address: zkBundle.sourcePool,
        abi: parseAbi(["function nullifierHashes(uint256) view returns (bool)"]),
        functionName: "nullifierHashes",
        args: [zkBundle.spentNullifier],
      });
      if (!spentOnchain) {
        throw new Error(
          "Flow confirmed but the nullifier does not read as spent onchain. The note was NOT removed — verify on the explorer before retrying."
        );
      }
      const remaining = notes.filter((n) => (isBowNote(n) ? BigInt(n.nullifier) !== zkBundle.nullifier : true));
      setNotes(remaining);
      setSelectedNote(newNote);
      setProverCommitment(newNote.commitmentHash);
      savePendingNote(newNote, fullHash, zkBundle.destPool);
      saveNoteLocally(newNote);
      clearPendingNoteByTx(fullHash);
      setProverCommitted(true);
      setZkBundle(null);
      setZkMultiBundle(null);
      setZkFlowKind(null);
      setZkQuoteOut(null);
      setZkMinOut(null);
      setZkQuoteNote("Shielded Swap confirmed onchain. Refresh the live quote for the next flow.");
      setProverSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        prev[3],
        { ...prev[4], status: "completed" },
      ]);
      setIsProverOpen(true);
    } catch (e: unknown) {
      console.error("Shielded Swap execute error:", e);
      setIsProverOpen(false);
      let slipForMap: number | undefined;
      try {
        slipForMap = parseSlippagePercent(slippage);
      } catch {
        slipForMap = undefined;
      }
      setFlowError(mapZkRouterError(e, slipForMap));
    } finally {
      setIsExecuting(false);
      txInFlight.current = Math.max(0, txInFlight.current - 1);
    }
  }

  // Full-ZK cutover: 0xbow v3 deposits ONLY (native ETH + ERC20 VEIL via
  // Entrypoint.deposit on Robinhood Testnet 46630). No legacy pool is ever
  // touched: legacy pools pause deposits onchain, so any such path would
  // only ever revert and burn gas.
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
    if (connectedChainId !== null && connectedChainId !== TESTNET_CHAIN_ID) {
      setFlowError(
        "0xbow shielded deposits live on Robinhood Testnet (46630). Switch your wallet to testnet and try again. No transaction was sent."
      );
      return;
    }
    if (!isTestnetBowV3Configured()) {
      setFlowError(
        "The 0xbow deposit suite is not configured. No transaction was sent."
      );
      return;
    }
    if (parsedBowDeposit === null) {
      setFlowError(`Enter a valid ${bowDepositAsset} amount greater than zero.`);
      return;
    }
    if (!bowDepositMatchesDenomination) {
      setFlowError(
        isBowEthDeposit
          ? `Enter the exact 0xbow note denomination (${formatEther(TESTNET_BOW_V3_ETH_DENOMINATION)} ETH). No transaction was sent.`
          : `Enter the exact 0xbow note denomination (${formatEther(TESTNET_BOW_V3_VEIL_DENOMINATION)} VEIL). No transaction was sent.`
      );
      return;
    }
    const depositValue = parsedBowDeposit;

    setIsExecuting(true);
    setProverTitle(
      isBowEthDeposit
        ? "Executing 0xbow Shielded Deposit (ETH, Testnet)"
        : "Executing 0xbow Shielded Deposit (VEIL, Testnet)"
    );
    setProverTxHash(null);
    setProverCommitment(null);
    setProverCommitted(false);

    const initialSteps: ZkProverStep[] = [
      {
        title: "1. Client-Side 0xbow Key Derivation",
        detail: "Deriving nullifier, secret & precommitment using BIP-39 entropy & Poseidon hash",
        status: "running",
      },
      {
        title: "2. Privacy Pools Precommitment Preparation",
        detail: isBowEthDeposit
          ? "Binding commitment preimage to the v3 ETH pool scope"
          : "Binding commitment preimage to the v3 VEIL pool scope",
        status: "pending",
      },
      {
        title: "3. On-Chain Deposit Execution",
        detail: isBowEthDeposit
          ? "Calling entrypoint.deposit() with 0.001 ETH on Robinhood Testnet"
          : "Approving VEIL when needed, then calling entrypoint.deposit(asset, value, precommitment)",
        status: "pending",
      },
      {
        title: "4. Settlement, ASP Sync & Local Vault Storage",
        detail: "Confirming block receipt, syncing Association Set & persisting note",
        status: "pending",
      },
    ];

    setProverSteps(initialSteps);
    setIsProverOpen(true);

    try {
      if (txInFlight.current > 0) return;
      txInFlight.current += 1;
      const testnetClient = createTestnetBowPublicClient();
      const depositPool = isBowEthDeposit ? TESTNET_BOW_V3_ETH_POOL : TESTNET_BOW_V3_VEIL_POOL;
      const scope = await testnetClient.readContract({
        address: depositPool,
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

      let depositHash: `0x${string}`;
      if (isBowEthDeposit) {
        const ethBal = await testnetClient.getBalance({ address: connectedAddress });
        if (ethBal < depositValue) {
          throw new Error(
            "Insufficient testnet ETH balance to fund this shield and pay gas. Fund testnet ETH at the faucet and try again. No transaction was sent."
          );
        }
        await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
        depositHash = await walletClient.writeContract({
          address: TESTNET_BOW_V3_ENTRYPOINT,
          abi: BOW_V3_NATIVE_DEPOSIT_ABI,
          functionName: "deposit",
          args: [secrets.precommitment],
          value: depositValue,
        });
      } else {
        const [bal, allow, liveConfig] = await Promise.all([
          testnetClient.readContract({
            address: TESTNET_BOW_V3_VEIL_TOKEN,
            abi: BOW_V3_VEIL_APPROVE_ABI,
            functionName: "balanceOf",
            args: [connectedAddress],
          }),
          testnetClient.readContract({
            address: TESTNET_BOW_V3_VEIL_TOKEN,
            abi: BOW_V3_VEIL_APPROVE_ABI,
            functionName: "allowance",
            args: [connectedAddress, TESTNET_BOW_V3_ENTRYPOINT],
          }),
          testnetClient.readContract({
            address: TESTNET_BOW_V3_ENTRYPOINT,
            abi: BOW_V3_VEIL_APPROVE_ABI,
            functionName: "assetConfig",
            args: [TESTNET_BOW_V3_VEIL_TOKEN],
          }),
        ]);
        if (bal < depositValue) {
          throw new Error(
            `Insufficient test VEIL balance. Shielding needs ${formatEther(depositValue)} test VEIL (${TESTNET_BOW_V3_VEIL_TOKEN}) already in your wallet — there is no onchain faucet. Fund test VEIL and try again. No transaction was sent.`
          );
        }
        // Floor re-check inside the send window: the fixed 0.001 deposit must
        // still clear the live entrypoint minimum (anti-dust floor).
        const liveMinimum = liveConfig[1] as bigint;
        if (depositValue < liveMinimum) {
          throw new Error(
            "The live VEIL minimum rose above the fixed 0.001 note. Reload and try again. No transaction was sent."
          );
        }
        if (allow < depositValue) {
          await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
          const approveHash = await walletClient.writeContract({
            address: TESTNET_BOW_V3_VEIL_TOKEN,
            abi: BOW_V3_VEIL_APPROVE_ABI,
            functionName: "approve",
            args: [TESTNET_BOW_V3_ENTRYPOINT, depositValue],
          });
          const approveReceipt = await waitForTransactionReceipt(testnetClient, {
            hash: approveHash,
          });
          if (approveReceipt.status !== "success") {
            throw new Error("VEIL approval reverted onchain. No deposit was sent.");
          }
          const allowAfter = await testnetClient.readContract({
            address: TESTNET_BOW_V3_VEIL_TOKEN,
            abi: BOW_V3_VEIL_APPROVE_ABI,
            functionName: "allowance",
            args: [connectedAddress, TESTNET_BOW_V3_ENTRYPOINT],
          });
          assertVeilAllowanceForBowDeposit(allowAfter, depositValue);
        } else {
          assertVeilAllowanceForBowDeposit(allow, depositValue);
        }
        await revalidateWallet(activeProvider, connectedAddress as string, connectedChainId);
        depositHash = await walletClient.writeContract({
          address: TESTNET_BOW_V3_ENTRYPOINT,
          abi: BOW_V3_ERC20_DEPOSIT_ABI,
          functionName: "deposit",
          args: [TESTNET_BOW_V3_VEIL_TOKEN, depositValue, secrets.precommitment],
        });
      }

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
        address: depositPool,
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
      if (onchainValue !== depositValue) {
        throw new Error(
          `Deposited value mismatch: onchain event does not match the ${formatEther(depositValue)} ${bowDepositAsset} denomination.`
        );
      }
      const bowNote = createBowNote({
        scope,
        denomination: depositValue,
        label,
        nullifier: secrets.nullifier,
        secret: secrets.secret,
        precommitment: secrets.precommitment,
        txHash: depositHash,
        blockNumber: receipt.blockNumber,
        asset: (isBowEthDeposit ? ETH_ZERO_ADDRESS : TESTNET_BOW_V3_VEIL_TOKEN) as Address,
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
      savePendingNote(bowNote, depositHash, depositPool);
      saveNoteLocally(bowNote);
      clearPendingNoteByTx(depositHash);
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
    } catch (e: unknown) {
      console.error("0xbow shielded deposit error:", e);
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


  // Full-ZK cutover: the Shielded Swap tab is paused. The legacy router
  // route only settles into legacy pools whose deposits are paused onchain,
  // so any swap execution would only ever revert and burn gas. 0xbow notes
  // move via Withdraw (relay to a fresh address) plus a fresh Shield deposit
  // instead. This handler stays wired to the tab CTA so the UI fails closed
  // with directions and never sends a transaction.
  async function handleShieldedSwap() {
    setFlowError(null);
    if (!connectedAddress) {
      setIsWalletModalOpen(true);
      return;
    }
    setFlowError(
      "Shielded Swap is paused after the full-ZK cutover: legacy pools no longer accept new deposits. To move funds, withdraw the note to a fresh address and re-shield via Shield. No transaction was sent."
    );
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
      setFlowError("No shielded notes available in local storage. Create one via Shield first.");
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
      withdrawPath === "0xbow" &&
      connectedChainId === TESTNET_CHAIN_ID &&
      (isTestnetBowConfigured() || isTestnetBowV3Configured());

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
            "The selected note is a legacy note. Please select a 0xbow shielded note (ETH or VEIL) created on testnet."
          );
        }

        const bowNote = noteToWithdraw;
        setProverCommitment(bowNote.commitmentHash);

        const testnetClient = createTestnetBowPublicClient();
        // Pool resolution: VEIL notes relay through the v3 VEIL pool; ETH
        // notes match by live scope (v3 ETH pool for new notes, the
        // original suite pool for notes created before the cutover).
        // Fail closed when no live pool matches the note.
        const isVeilBowNote =
          typeof bowNote.asset === "string" &&
          bowNote.asset.toLowerCase() === TESTNET_BOW_V3_VEIL_TOKEN.toLowerCase();
        let bowPool: Address;
        let bowEntrypoint: Address;
        if (isVeilBowNote) {
          if (!isTestnetBowV3Configured()) {
            throw new Error(
              "The v3 0xbow suite is not configured, so this VEIL note cannot be relayed. No transaction was sent."
            );
          }
          bowPool = TESTNET_BOW_V3_VEIL_POOL;
          bowEntrypoint = TESTNET_BOW_V3_ENTRYPOINT;
        } else {
          const noteScope = BigInt(bowNote.scope);
          const [v3Scope, oldScope] = await Promise.all([
            testnetClient
              .readContract({
                address: TESTNET_BOW_V3_ETH_POOL,
                abi: BOW_POOL_SCOPE_ABI,
                functionName: "SCOPE",
              })
              .catch(() => null),
            testnetClient
              .readContract({
                address: TESTNET_0XBOW.pool,
                abi: BOW_POOL_SCOPE_ABI,
                functionName: "SCOPE",
              })
              .catch(() => null),
          ]);
          if (v3Scope !== null && BigInt(v3Scope) === noteScope) {
            bowPool = TESTNET_BOW_V3_ETH_POOL;
            bowEntrypoint = TESTNET_BOW_V3_ENTRYPOINT;
          } else if (oldScope !== null && BigInt(oldScope) === noteScope) {
            bowPool = TESTNET_0XBOW.pool;
            bowEntrypoint = TESTNET_0XBOW.entrypointProxy;
          } else {
            throw new Error(
              "No live 0xbow pool matches this note's scope. Withdraw is unavailable for this note. No transaction was sent."
            );
          }
        }

        // Explicit relay context: pool, asset and recipient bound up front.
        // The asset is derived from the note itself, never hardcoded, so
        // VEIL notes carry the VEIL token into the relay call.
        const bowRelayContext = buildBowRelayContext({
          pool: bowPool,
          asset: (isVeilBowNote ? TESTNET_BOW_V3_VEIL_TOKEN : bowNote.asset) as Address,
          recipient: cleanRecipient as Address,
        });

        const scope = BigInt(bowNote.scope);
        const denomination = BigInt(bowNote.denomination);
        const label = BigInt(bowNote.label);
        const nullifier = BigInt(bowNote.nullifier);
        const secret = BigInt(bowNote.secret);
        const commitmentHash = BigInt(bowNote.commitmentHash);

        // Note integrity check (fail fast, before minutes of proving):
        // the saved secrets must reproduce the onchain deposit
        // precommitment. A mismatch means the vault note is corrupted
        // (mixed-up backup/restore) and no proof can ever verify — funds
        // stay locked, but no time/gas is wasted discovering it.
        const depositLogs = await testnetClient.getContractEvents({
          address: bowRelayContext.pool,
          abi: parseAbi([
            "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)",
          ]),
          eventName: "Deposited",
          fromBlock: BigInt(bowNote.blockNumber),
          toBlock: BigInt(bowNote.blockNumber),
        });
        const ownDeposit = depositLogs.find(
          (l) => l.transactionHash.toLowerCase() === (bowNote.txHash as string).toLowerCase()
        );
        if (!ownDeposit) {
          throw new Error(
            "Deposit event not found for this note's transaction. The note may belong to a different pool. No transaction was sent."
          );
        }
        const localPrecommitment = BigInt(
          bowHashPrecommitment(nullifier as never, secret as never) as bigint | number | string
        );
        if (localPrecommitment !== BigInt((ownDeposit.args as { _precommitmentHash: bigint })._precommitmentHash)) {
          throw new Error(
            "Saved note secrets do not match the onchain deposit (precommitment mismatch). This note is corrupted and can never produce a valid proof — do not retry proving. Deposit fresh and back it up. No transaction was sent."
          );
        }

        // Commitment recompute check (withdraw-verify incident): the saved
        // secrets + label + denomination must reproduce the stored
        // commitmentHash. Precommitment match alone does not prove this, and
        // a mismatched commitment yields a witness that fails local
        // verification after minutes of proving.
        const recomputed = bowGetCommitment(denomination, label, nullifier as never, secret as never) as
          | { hash?: unknown }
          | bigint;
        const recomputedHash = BigInt(
          (typeof recomputed === "object" && recomputed !== null && "hash" in recomputed
            ? (recomputed as { hash?: unknown }).hash
            : recomputed) as bigint | number | string
        );
        if (recomputedHash !== commitmentHash) {
          throw new Error(
            "Saved note does not reproduce its own commitment (commitment mismatch). The vault entry mixes data from different deposits and can never produce a valid proof — do not retry proving. Restore the correct backup for this note, or deposit fresh. No transaction was sent."
          );
        }

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
          body: JSON.stringify({ chainId: TESTNET_CHAIN_ID, label: BigInt(bowNote.label).toString() }),
          // Bounded: never hang the quote on a stalled sync call (failure
          // falls through to the same path as a network error below).
          signal: AbortSignal.timeout(30000),
        });
      } catch {}

        setProverSteps((prev) => [
          prev[0],
          { ...prev[1], status: "completed" },
          { ...prev[2], status: "running" },
          prev[3],
        ]);

        // Fetch pool events to build State Tree and Association Set.
        // State stays per-pool; ASP is entrypoint-global (union both pools).
        let { orderedCommitments } = await fetchBowPoolEvents(
          testnetClient,
          bowRelayContext.pool
        );
        let labels = await fetchBowAspLabelsAllPools(testnetClient, [TESTNET_BOW_V3_ETH_POOL, TESTNET_BOW_V3_VEIL_POOL]);

        if (!orderedCommitments.includes(commitmentHash)) {
          throw new Error(
            "Deposit commitment not found in onchain state tree. Please ensure your deposit transaction was confirmed."
          );
        }

        let stateTree = buildBowStateTree(orderedCommitments);
        let aspSet = buildBowAssociationSet(labels);
        // State-root freshness gate: our rebuilt tree must equal the pool's
        // live currentRoot, or the proof targets a stale root and the relay
        // dies with UnknownStateRoot after minutes of proving. Never prove
        // against a stale tree.
        const liveSwapStateRoot = await testnetClient.readContract({
          address: bowRelayContext.pool,
          abi: BOW_POOL_STATE_ABI,
          functionName: "currentRoot",
        });
        if (stateTree.root !== BigInt(liveSwapStateRoot)) {
          throw new Error(
            "Onchain state changed while preparing (new deposit landed). Retry — no transaction was sent."
          );
        }

        if (!aspSet.labels.includes(label)) {
          throw new Error("Deposit label not found in Association Set. Try syncing ASP.");
        }

        let onchainAspRoot = await testnetClient.readContract({
          address: bowEntrypoint,
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
          labels = await fetchBowAspLabelsAllPools(testnetClient, [TESTNET_BOW_V3_ETH_POOL, TESTNET_BOW_V3_VEIL_POOL]);
          if (!orderedCommitments.includes(commitmentHash)) {
            throw new Error(
              "Deposit commitment not found in onchain state tree after ASP re-sync."
            );
          }
          stateTree = buildBowStateTree(orderedCommitments);
          aspSet = buildBowAssociationSet(labels);
          onchainAspRoot = await testnetClient.readContract({
            address: bowEntrypoint,
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
          entrypoint: bowEntrypoint,
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

        // TEMP-DIAG (remove after withdraw-verify incident): non-sensitive
        // witness summary only — never secrets, keys, or mnemonics.
        console.log(
          "[diag-withdraw]",
          JSON.stringify({
            stateRoot: stateTree.root.toString(),
            aspRoot: aspSet.root.toString(),
            onchainAspRoot: BigInt(onchainAspRoot).toString(),
            context: context.toString(),
            leaves: orderedCommitments.length,
            labels: aspSet.labels.length,
            denomination: denomination.toString(),
            scope: scope.toString(),
            commitment: commitmentHash.toString(),
            label: label.toString(),
            pool: bowRelayContext.pool,
            entrypoint: bowEntrypoint,
          })
        );

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
          address: bowEntrypoint,
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
        detail: "Submitting to ShieldedVerifier contract; the withdraw call carries no depositor address. Provisional verifier for old notes only — Groth16 on 0xbow paths",
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
      // Exit-only candidate list: fresh pools first (new notes), retired
      // pools for old notes (ETH 0x1b1d…, VEIL 0xd739…/0x172e…). Old notes
      // live in the retired pools and exits stay open by promise. Withdraw
      // pool follows the NOTE's asset (R3): ETH notes -> ETH pool, VEIL
      // notes -> the live-matching VEIL pool. Verified live (denomination +
      // asset) inside the resolver; a paused pool still serves exits (pause
      // gates deposits only); fail closed when nothing matches.
      const withdrawPool = await resolveLegacyPoolForNote(
        publicClient,
        legacyNote,
        [
          { pool: SHIELDED_POOL_ETH, asset: ETH_ZERO_ADDRESS },
          { pool: TESTNET_VEIL_POOL_05, asset: TESTNET_BOW_V3_VEIL_TOKEN },
          { pool: TESTNET_VEIL_POOL_2, asset: TESTNET_BOW_V3_VEIL_TOKEN },
          { pool: LEGACY_EXIT_ETH_POOL, asset: ETH_ZERO_ADDRESS },
          { pool: LEGACY_EXIT_VEIL_POOL_05, asset: TESTNET_BOW_V3_VEIL_TOKEN },
          { pool: LEGACY_EXIT_VEIL_POOL_2, asset: TESTNET_BOW_V3_VEIL_TOKEN },
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
            Shield Terminal
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
              ? "Shielded deposits into audited 0xbow privacy pools with client-side Groth16 ZK-SNARK proofs and verifiable Association Sets (ASP). Legacy pools no longer accept new deposits; old notes can still exit via Withdraw."
              : "Shielded deposits into audited 0xbow privacy pools with client-side Groth16 ZK-SNARK proofs and verifiable Association Sets. Old notes exit via the legacy path only."}
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
          <span>Groth16 ZK-SNARK</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>0xbow v1.2.1</span>
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
                <span>Shield</span>
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

          {/* TAB 1: SHIELD (0xbow only) */}
          {activeTab === "buy_and_shield" && (
            <BuyAndShieldPanel
              depositAsset={bowDepositAsset}
              onSelectDepositAsset={(asset) => {
                setBowDepositAsset(asset);
                setFlowError(null);
              }}
              depositAmount={inputAmount}
              onDepositAmount={setInputAmount}
              ethDenomination={TESTNET_BOW_V3_ETH_DENOMINATION}
              veilMinimum={veilMinimum}
              veilBalance={veilBalance}
              ethBalance={inputToken.balance}
              connectedAddress={connectedAddress}
              isExecuting={isExecuting}
              amountValid={parsedBowDeposit !== null}
              executeDisabled={buyCtaDisabled}
              onExecute={handleBuyAndShield}
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

          {/* TAB 2: SHIELDED SWAP — full-ZK router on testnet, paused elsewhere.
              The paused swap route only settles into pools that no longer
              accept new deposits. */}
          {activeTab === "shielded_swap" &&
            (isTestnetBuild ? (
              <ZkShieldedSwapPanel
                connectedAddress={connectedAddress}
                notes={zkShieldedSwapOptions}
                selectedNullifier={selectedNoteNullifier}
                onSelectNote={(nullifier) => {
                  setSelectedNoteNullifier(nullifier);
                  setFlowError(null);
                  setZkBundle(null);
                  setZkMultiBundle(null);
                  setZkFlowKind(null);
                  setZkQuoteOut(null);
                  setZkMinOut(null);
                  setZkQuoteNote(null);
                }}
                sourceLabel={zkShieldedSwapSourceLabel}
                destinationLabel={zkShieldedSwapDestinationLabel}
                routeLabel={
                  zkIsEthIn ? "ETH -> VEIL via shared v4 pool" : "VEIL -> ETH via shared v4 pool"
                }
                routerAddress={TESTNET_ZK_ROUTER_ADDRESS}
                multiRouterAddress={TESTNET_ZK_ROUTER_MULTI_ADDRESS}
                quotedOut={zkQuoteOut !== null ? formatEther(zkQuoteOut) : null}
                minSwapOut={zkMinOut !== null ? formatEther(zkMinOut) : null}
                flowKind={zkFlowKind}
                isQuoting={isZkQuoting}
                isExecuting={isExecuting}
                quoteDisabled={zkQuoteDisabled}
                executeDisabled={zkShieldedSwapExecuteDisabled}
                quoteNote={zkQuoteNote}
                txHash={zkTxHash}
                onQuote={() => {
                  void handleZkShieldedSwapQuote();
                }}
                onExecute={() => {
                  void handleZkShieldedSwapExecute();
                }}
              />
            ) : (
              <div
                role="status"
                style={{
                  padding: "var(--space-5)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "var(--color-text)", fontWeight: 600, fontSize: "var(--text-body-sm)" }}>
                  Shielded Swap Is Paused
                </div>
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-caption)", lineHeight: 1.6, maxWidth: "420px" }}>
                  The legacy swap route only settles into pools that no longer accept new deposits, so execution stays
                  disabled. Full-ZK Swap-to-Shield lives on Robinhood Testnet (46630). No transaction
                  was sent.
                </p>
                <button
                  type="button"
                  onClick={() => switchTab("buy_and_shield")}
                  style={{
                    marginTop: "var(--space-2)",
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(255, 140, 0, 0.15)",
                    border: "1px solid rgba(255, 140, 0, 0.35)",
                    color: "var(--color-accent-ink)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: "24px",
                  }}
                >
                  Go to Shield
                </button>
              </div>
            ))}

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
                  <strong style={{ color: "var(--color-text)", display: "block" }}>Onchain Groth16 Settlement</strong>
                  Every new note is minted by the audited 0xbow entrypoint and every 0xbow exit settles through entrypoint.relay, which verifies the Groth16 proof onchain before releasing funds.
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
        onClose={() => {
          // Signal long ZK runs (batch proving) to stop between notes.
          zkCancelRef.current = true;
          setIsProverOpen(false);
        }}
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
