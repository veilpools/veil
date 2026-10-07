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
import { createPublicClient, encodeAbiParameters, http, type Address, type PublicClient } from "viem";
import { fetchPinnedBowArtifact, type BowArtifactName } from "./0xbow-artifacts";
import { buildBowAssociationProof, type BowAssociationSet } from "./0xbow-association";
import { TESTNET_0XBOW, TESTNET_0XBOW_META, TESTNET_CHAIN_ID } from "./privacy-pools";
import { robinhoodTestnet } from "./chains";

export interface BowStateTree {
  leaves: bigint[];
  root: bigint;
  proof(commitment: bigint): ReturnType<typeof import("@0xbow/privacy-pools-core-sdk").generateMerkleProof>;
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
