// 0xbow Privacy Pools SDK wrapper (Robinhood TESTNET 46630 ONLY — read-only + local proving).
// Ported from kentir lib/shielded-client.ts — copy, do not reinvent; adapted to veil
// import paths (@/lib/... or relative) and veil chain objects (lib/chains.ts).
// No transactions are sent from this module. Mainnet defaults are never touched.
import {
  AccountService,
  calculateContext,
  CircuitName,
  PrivacyPoolSDK,
  DataService,
  generateMerkleProof,
  type CircuitsInterface,
  type AccountCommitment,
  type ChainConfig,
  type DepositEvent,
  type RagequitEvent,
  type WithdrawalEvent,
  type WithdrawalProof,
  type PoolInfo,
  type Withdrawal,
} from "@0xbow/privacy-pools-core-sdk";
import { createPublicClient, encodeAbiParameters, http, parseAbiItem, type Address, type PublicClient } from "viem";
import { fetchPinnedBowArtifact, type BowArtifactName } from "./0xbow-artifacts";
import { buildBowAssociationProof, buildBowAssociationSet, type BowAssociationSet } from "./0xbow-association";
import { TESTNET_0XBOW, TESTNET_0XBOW_META, TESTNET_CHAIN_ID } from "./privacy-pools";
import { robinhoodTestnet } from "./chains";

export interface BowStateTree {
  leaves: bigint[];
  root: bigint;
  proof(commitment: bigint): ReturnType<typeof generateMerkleProof>;
}

export function buildBowStateTree(
  depositCommitments: bigint[],
  withdrawalNewCommitments: bigint[] = []
): BowStateTree {
  const leaves = [...depositCommitments, ...withdrawalNewCommitments];
  if (leaves.length === 0) {
    throw new Error("bow_state_tree_empty");
  }
  const sampleProof = generateMerkleProof(leaves, leaves[0]);
  const root = BigInt(sampleProof.root);
  return {
    leaves,
    root,
    proof(commitment: bigint) {
      const p = generateMerkleProof(leaves, commitment);
      if (BigInt(p.root) !== root) {
        throw new Error("bow_state_root_mismatch");
      }
      return p;
    },
  };
}

export class PinnedBowCircuits implements CircuitsInterface {
  private readonly loaded = new Map<BowArtifactName, Promise<Uint8Array>>();

  private load(name: BowArtifactName): Promise<Uint8Array> {
    let pending = this.loaded.get(name);
    if (!pending) {
      pending = fetchPinnedBowArtifact(name);
      this.loaded.set(name, pending);
    }
    return pending;
  }

  getWasm(name: CircuitName): Promise<Uint8Array> {
    return this.load(`${name}.wasm` as BowArtifactName);
  }

  getProvingKey(name: CircuitName): Promise<Uint8Array> {
    return this.load(`${name}.zkey` as BowArtifactName);
  }

  getVerificationKey(name: CircuitName): Promise<Uint8Array> {
    return this.load(`${name}.vkey` as BowArtifactName);
  }
}

export function createBowSdk(): PrivacyPoolSDK {
  return new PrivacyPoolSDK(new PinnedBowCircuits());
}

/** Testnet read client (veil RPC pattern from lib/balances.ts, testnet chain object). */
export function createTestnetBowPublicClient(rpcUrl?: string): PublicClient {
  const endpoint =
    rpcUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/rpc?chainId=${TESTNET_CHAIN_ID}`
      : process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com");
  return createPublicClient({
    chain: robinhoodTestnet,
    transport: http(endpoint, {
      fetchOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    }),
  }) as unknown as PublicClient;
}

export function getTestnetPoolInfo(scope: bigint): PoolInfo {
  return {
    chainId: TESTNET_CHAIN_ID,
    address: TESTNET_0XBOW.pool as `0x${string}`,
    scope: scope as never,
    deploymentBlock: TESTNET_0XBOW_META.poolDeploymentBlock,
  };
}

export function getTestnetChainConfig(rpcUrl: string): ChainConfig {
  return {
    chainId: TESTNET_CHAIN_ID,
    privacyPoolAddress: TESTNET_0XBOW.pool as `0x${string}`,
    startBlock: TESTNET_0XBOW_META.poolDeploymentBlock,
    rpcUrl,
  };
}

export function createBowWithdrawalContext(input: {
  entrypoint: Address;
  recipient: Address;
  feeRecipient: Address;
  scope: bigint;
}): { withdrawal: Withdrawal; context: bigint } {
  const data = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "feeRecipient", type: "address" },
          { name: "relayFeeBPS", type: "uint256" },
        ],
      },
    ],
    [{ recipient: input.recipient, feeRecipient: input.feeRecipient, relayFeeBPS: 0n }]
  );
  const withdrawal: Withdrawal = { processooor: input.entrypoint, data };
  const context = BigInt(calculateContext(withdrawal, input.scope as never));
  return { withdrawal, context };
}

export async function proveBowWithdrawal(input: {
  sdk: PrivacyPoolSDK;
  accountService: AccountService;
  commitment: AccountCommitment;
  stateTree: BowStateTree;
  associationSet: BowAssociationSet;
  entrypoint: Address;
  recipient: Address;
  feeRecipient: Address;
  scope: bigint;
  withdrawalAmount: bigint;
}): Promise<{ withdrawalProof: WithdrawalProof; withdrawal: Withdrawal }> {
  if (!input.stateTree.leaves.includes(input.commitment.hash)) throw new Error("bow_state_commitment_missing");
  const stateMerkleProof = input.stateTree.proof(input.commitment.hash);
  const aspMerkleProof = buildBowAssociationProof(input.associationSet, input.commitment.label);
  const secretPair = input.accountService.createWithdrawalSecrets(input.commitment);
  const { withdrawal, context } = createBowWithdrawalContext(input);
  const withdrawalProof = await input.sdk.proveWithdrawal(input.commitment, {
    withdrawalAmount: input.withdrawalAmount,
    stateMerkleProof,
    aspMerkleProof,
    stateRoot: input.stateTree.root as never,
    stateTreeDepth: 32n,
    aspRoot: input.associationSet.root as never,
    aspTreeDepth: 32n,
    context,
    newNullifier: secretPair.nullifier,
    newSecret: secretPair.secret,
  });
  if (!(await input.sdk.verifyWithdrawal(withdrawalProof))) throw new Error("bow_withdrawal_proof_invalid");
  return { withdrawalProof, withdrawal };
}

export class BowTestnetDataService extends DataService {
  private readonly bowClients = new Map<number, PublicClient>();
  private readonly bowConfigs = new Map<number, ChainConfig>();

  constructor(configs: ChainConfig[]) {
    super(
      configs,
      new Map(
        configs.map((config) => [
          config.chainId,
          {
            blockChunkSize: 1800,
            concurrency: 1,
            chunkDelayMs: 100,
            retryOnFailure: true,
            maxRetries: 5,
            retryBaseDelayMs: 1000,
          },
        ])
      )
    );
    for (const config of configs) {
      this.bowConfigs.set(config.chainId, config);
      this.bowClients.set(config.chainId, createPublicClient({ transport: http(config.rpcUrl) }));
    }
  }

  override async getDeposits(_pool: PoolInfo): Promise<DepositEvent[]> {
    throw new Error("bow_testnet_data_service_not_wired");
  }

  override async getWithdrawals(_pool: PoolInfo, _fromBlock?: bigint): Promise<WithdrawalEvent[]> {
    throw new Error("bow_testnet_data_service_not_wired");
  }

  override async getRagequits(_pool: PoolInfo, _fromBlock?: bigint): Promise<RagequitEvent[]> {
    throw new Error("bow_testnet_data_service_not_wired");
  }
}

export function isTestnetChainId(chainId: number | undefined): boolean {
  return chainId === TESTNET_CHAIN_ID;
}

export interface BowRelayContextArgs {
  pool: Address;
  asset: Address;
  recipient: Address;
}

export function buildBowRelayContext(args: BowRelayContextArgs) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.pool)) throw new Error("Relay pool must be a valid address.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.asset)) throw new Error("Relay asset must be a valid address.");
  return { pool: args.pool, asset: args.asset, recipient: args.recipient };
}

/**
 * Fail-closed VEIL approve gate for 0xbow ERC20 deposits
 * (Entrypoint.deposit(asset, value, precommitment)). The entrypoint pulls
 * VEIL via transferFrom, so a deposit with allowance < value always reverts
 * and burns gas. Callers must approve first, re-read allowance, then call
 * this gate before sending the deposit. Throws an honest Error when the
 * allowance does not cover the deposit value; nothing is sent.
 */
export function assertVeilAllowanceForBowDeposit(allowance: bigint, required: bigint): void {
  if (allowance < required) {
    throw new Error(
      "VEIL allowance too low for the 0xbow entrypoint: approve VEIL first, then deposit. No transaction was sent."
    );
  }
}

// v3 suite deposit ABIs (Entrypoint: native payable + ERC20 pull).
// No new cryptography: verbatim 0xbow v1.2.1 interface shapes, already
// proven by scripts/swap-and-shield-veil.mjs on testnet.
export const BOW_V3_NATIVE_DEPOSIT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [{ name: "_precommitment", type: "uint256" }],
    outputs: [{ name: "_commitment", type: "uint256" }],
  },
] as const;

export const BOW_V3_ERC20_DEPOSIT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_asset", type: "address" },
      { name: "_value", type: "uint256" },
      { name: "_precommitment", type: "uint256" },
    ],
    outputs: [{ name: "_commitment", type: "uint256" }],
  },
] as const;

export const BOW_V3_VEIL_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "assetConfig",
    stateMutability: "view",
    inputs: [{ name: "_asset", type: "address" }],
    outputs: [
      { name: "pool", type: "address" },
      { name: "minimumDepositAmount", type: "uint256" },
      { name: "vettingFeeBPS", type: "uint256" },
      { name: "maxRelayFeeBPS", type: "uint256" },
    ],
  },
] as const;

export const BOW_DEPOSITED_EVENT = parseAbiItem(
  "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)"
);

export const BOW_WITHDRAWN_EVENT = parseAbiItem(
  "event Withdrawn(address indexed _processooor, uint256 _value, uint256 _spentNullifier, uint256 _newCommitment)"
);

export async function fetchBowPoolEvents(
  client: PublicClient,
  poolAddress: Address = TESTNET_0XBOW.pool,
  fromBlock: bigint = TESTNET_0XBOW_META.poolDeploymentBlock
) {
  const currentBlock = await client.getBlockNumber();
  const depositLogs = [];
  const withdrawLogs = [];
  const CHUNK_SIZE = 40000n;

  for (let start = fromBlock; start <= currentBlock; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE - 1n < currentBlock ? start + CHUNK_SIZE - 1n : currentBlock;
    const [deps, withs] = await Promise.all([
      client.getLogs({
        address: poolAddress,
        event: BOW_DEPOSITED_EVENT,
        fromBlock: start,
        toBlock: end,
      }),
      client.getLogs({
        address: poolAddress,
        event: BOW_WITHDRAWN_EVENT,
        fromBlock: start,
        toBlock: end,
      }),
    ]);
    depositLogs.push(...deps);
    withdrawLogs.push(...withs);
  }

  const orderedCommitments: bigint[] = [
    ...depositLogs.map((l) => ({
      commitment: BigInt(l.args._commitment ?? 0n),
      blockNumber: l.blockNumber ?? 0n,
      txIndex: l.transactionIndex ?? 0,
      logIndex: l.logIndex ?? 0,
    })),
    ...withdrawLogs
      .filter((l) => BigInt(l.args._newCommitment ?? 0n) !== 0n)
      .map((l) => ({
        commitment: BigInt(l.args._newCommitment ?? 0n),
        blockNumber: l.blockNumber ?? 0n,
        txIndex: l.transactionIndex ?? 0,
        logIndex: l.logIndex ?? 0,
      })),
  ]
    .sort((a, b) =>
      a.blockNumber !== b.blockNumber
        ? a.blockNumber < b.blockNumber
          ? -1
          : 1
        : a.txIndex !== b.txIndex
        ? a.txIndex - b.txIndex
        : a.logIndex - b.logIndex
    )
    .map((item) => item.commitment);

  const labels = [
    ...new Set(
      depositLogs
        .map((l) => BigInt(l.args._label ?? 0n))
        .filter((lbl) => lbl !== 0n)
        .map(String)
    ),
  ].map(BigInt);

  return {
    depositLogs,
    withdrawLogs,
    orderedCommitments,
    labels,
  };
}

/**
 * Union of deposit labels across ALL 0xbow pools. The entrypoint keeps ONE
 * global association set (latestRoot covers every pool), so an ASP set built
 * from a single pool permanently mismatches once a second pool holds
 * deposits. State trees stay per-pool; only the ASP label set is global.
 */
export async function fetchBowAspLabelsAllPools(
  client: PublicClient,
  poolAddresses: readonly Address[],
  fromBlock?: bigint
): Promise<bigint[]> {
  const seen = new Set<string>();
  for (const pool of poolAddresses) {
    const { labels } = await fetchBowPoolEvents(client, pool, fromBlock);
    for (const lbl of labels) seen.add(lbl.toString());
  }
  return [...seen].map(BigInt);
}

export async function fetchBowAspSet(
  client: PublicClient,
  entrypointAddress: Address = TESTNET_0XBOW.entrypointProxy,
  poolAddress: Address = TESTNET_0XBOW.pool,
  fromBlock: bigint = TESTNET_0XBOW_META.poolDeploymentBlock
) {
  const { labels } = await fetchBowPoolEvents(client, poolAddress, fromBlock);
  const aspSet = buildBowAssociationSet(labels);
  const onchainRoot = await client.readContract({
    address: entrypointAddress,
    abi: [
      {
        type: "function",
        name: "latestRoot",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "latestRoot",
  });
  return {
    aspSet,
    onchainRoot: BigInt(onchainRoot as bigint),
    isConsistent: aspSet.root === BigInt(onchainRoot as bigint),
  };
}
