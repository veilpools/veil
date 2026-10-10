import { describe, it, expect } from "vitest";
import { existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BOW_ARTIFACT_HASHES, BOW_ARTIFACT_BASE_URL } from "../lib/0xbow-artifacts";
import {
  BOW_SNARK_FIELD,
  TESTNET_SENTINEL_ROOT,
  buildTestnetSentinelAssociationSet,
} from "../lib/0xbow-association";
import { TESTNET_0XBOW, TESTNET_CHAIN_ID } from "../lib/privacy-pools";

const EXPECTED_SENTINEL_ROOT =
  "21888242871839275222246405745257275088548364400416034343698204186575808495616";

const VEIL_BOW_POOL = "0x23e9008294ab74875aa3f9cdcd42511bb43c7ed6";

describe("0xbow artifact pins (v1.2.1)", () => {
  it("pins all six circuit artifacts with valid sha256 hex format", () => {
    const names = Object.keys(BOW_ARTIFACT_HASHES).sort();
    expect(names).toEqual(
      [
        "commitment.vkey",
        "commitment.wasm",
        "commitment.zkey",
        "withdraw.vkey",
        "withdraw.wasm",
        "withdraw.zkey",
      ].sort()
    );
    for (const hash of Object.values(BOW_ARTIFACT_HASHES)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(BOW_ARTIFACT_BASE_URL).toBe("/shield-artifacts/v1.2.1");
  });

  it("has every pinned artifact file on disk with non-zero size", () => {
    for (const name of Object.keys(BOW_ARTIFACT_HASHES)) {
      const filePath = join(process.cwd(), "public/shield-artifacts/v1.2.1", name);
      expect(existsSync(filePath), `missing artifact file: ${name}`).toBe(true);
      const size = statSync(filePath).size;
      expect(size).toBeGreaterThan(0);
    }
  });
});

describe("0xbow testnet sentinel association set", () => {
  it("returns the sentinel root matching the deployment manifests", () => {
    const set = buildTestnetSentinelAssociationSet();
    expect(set.root.toString()).toBe(EXPECTED_SENTINEL_ROOT);
    expect(set.root.toString()).toBe(TESTNET_SENTINEL_ROOT.toString());
    expect(BOW_SNARK_FIELD - 1n).toBe(TESTNET_SENTINEL_ROOT);

    const sentinelManifest = JSON.parse(
      readFileSync(join(process.cwd(), "deployments/testnet-sentinel-asp-46630.json"), "utf8")
    );
    expect(sentinelManifest.root).toBe(EXPECTED_SENTINEL_ROOT);

    const poolManifest = JSON.parse(
      readFileSync(join(process.cwd(), "deployments/privacy-pools-testnet-latest.json"), "utf8")
    );
    expect(poolManifest.associationSet.root).toBe(EXPECTED_SENTINEL_ROOT);
  });
});

describe("0xbow testnet address book", () => {
  it("exposes all 7 testnet addresses as valid hex", () => {
    expect(TESTNET_CHAIN_ID).toBe(46630);
    const expected: Record<string, string> = {
      withdrawalVerifier: "0xeea9d0f7ee0958c6d59f25162be4e69ba60a0f71",
      commitmentVerifier: "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008",
      entrypointImplementation: "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda",
      entrypointProxy: "0xb68c3d25e5e9902363e8e10d5c0a471e65be8152",
      pool: "0xea48e6a7ae296ebbd7d58792091b8087032d3aa4",
      poseidonT3: "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34",
      poseidonT4: "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855",
    };
    for (const [key, addr] of Object.entries(expected)) {
      const actual = (TESTNET_0XBOW as Record<string, string>)[key];
      expect(actual, `missing address book entry: ${key}`).toBeDefined();
      expect(actual).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(actual.toLowerCase()).toBe(addr.toLowerCase());
    }
  });
});

describe("bow VEIL relay params", () => {
  it("builds relay context for the ERC20 pool, not the ETH pool", async () => {
    const { buildBowRelayContext } = await import("../lib/0xbow-client");
    const ctx = buildBowRelayContext({
      pool: VEIL_BOW_POOL,
      asset: "0x019086f63407fadf0ccb89516e465baef5031aa9",
      recipient: "0x000000000000000000000000000000000000dEaD",
    });
    expect(ctx.pool.toLowerCase()).toBe(VEIL_BOW_POOL.toLowerCase());
  });
});

describe("bow ASP labels span all pools (entrypoint-global set)", () => {
  it("unions + dedups labels across pools so multi-pool state never mismatches", async () => {
    const { encodeAbiParameters, keccak256, toHex } = await import("viem");
    const { fetchBowAspLabelsAllPools } = await import("../lib/0xbow-client");
    const { buildBowAssociationSet } = await import("../lib/0xbow-association");
    const sig = keccak256(toHex("Deposited(address,uint256,uint256,uint256,uint256)"));
    const padAddr = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
    // Decoded-log shape (viem auto-decodes when `event` is passed to getLogs).
    const mkLog = (pool: string, label: bigint, i: number) => ({
      address: pool,
      args: { _commitment: 1000n + label, _label: label },
      blockNumber: 100n,
      transactionIndex: 0,
      logIndex: i,
    });
    const poolA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const poolB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const logsByPool: Record<string, object[]> = {
      [poolA.toLowerCase()]: [mkLog(poolA, 7n, 0)],
      [poolB.toLowerCase()]: [mkLog(poolB, 7n, 0), mkLog(poolB, 9n, 1)],
    };
    const mockClient = {
      // Must exceed fetchBowPoolEvents' default fromBlock (deployment block).
      getBlockNumber: async () => 200000000n,
      getLogs: async (args: { address: string }) =>
        logsByPool[(args.address as string).toLowerCase()] ?? [],
    };
    const labels = await fetchBowAspLabelsAllPools(mockClient as never, [poolA as `0x${string}`, poolB as `0x${string}`]);
    expect(labels.map(String).sort()).toEqual(["7", "9"]);
    // single-pool subset must NOT equal the union root (the exact bug this prevents)
    const subset = buildBowAssociationSet([7n]);
    const full = buildBowAssociationSet(labels);
    expect(full.root).not.toBe(subset.root);
  });
});
