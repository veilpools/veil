import { describe, it, expect } from "vitest";
import { parseEther, encodeEventTopics, encodeAbiParameters, parseAbiParameters, toHex } from "viem";
import {
  buildShieldedSwapParams,
  generateNewShieldedNoteSecrets,
  findShieldedSwapExecuted,
  mapShieldedSwapError,
} from "../lib/shielded-swap";
import {
  TESTNET_LEGACY_ETH_POOL,
  TESTNET_ROUTER_POOL_KEY,
  UINT128_MAX,
} from "../lib/router-swap";
import { VEIL_SHIELD_ROUTER_ABI } from "../lib/veil-artifact";
import type { ShieldedNote } from "../lib/note";

const DUMMY_NOTE: ShieldedNote = {
  nullifier: "0x1111111111111111111111111111111111111111111111111111111111111111",
  secret: "0x2222222222222222222222222222222222222222222222222222222222222222",
  nullifierHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
  commitment: "0x4444444444444444444444444444444444444444444444444444444444444444",
  denomination: 1000000000000000n, // 0.001 ETH
  asset: "0x0000000000000000000000000000000000000000",
  timestamp: 1728300000000,
};

describe("Shielded Swap builders & helpers (Task 4: §7 #5 #6)", () => {
  it("builds shielded swap params with slippage bound and default self-relay", () => {
    const quoted = parseEther("0.0012");
    const newCommitment = "0x5555555555555555555555555555555555555555555555555555555555555555" as const;
    const proof = "0x6666" as const;
    const root = "0x7777777777777777777777777777777777777777777777777777777777777777" as const;

    const params = buildShieldedSwapParams({
      note: DUMMY_NOTE,
      proof,
      root,
      quotedAmountOut: quoted,
      slippagePercent: 0.5,
      newCommitment,
    });

    expect(params.poolSource).toBe(TESTNET_LEGACY_ETH_POOL);
    expect(params.poolDestination).toBe(TESTNET_LEGACY_ETH_POOL);
    expect(params.proof).toBe(proof);
    expect(params.root).toBe(root);
    expect(params.nullifierHash).toBe(DUMMY_NOTE.nullifierHash);
    expect(params.relayerFee).toBe(0n); // Self-relay fallback
    expect(params.minAmountOut).toBe(parseEther("0.001194")); // 0.5% slippage floor
    expect(params.newCommitment).toBe(newCommitment);
    expect(params.hookData).toBe("0x");
  });

  it("rejects relayerFee greater than or equal to note denomination", () => {
    expect(() =>
      buildShieldedSwapParams({
        note: DUMMY_NOTE,
        proof: "0x",
        root: "0x00",
        quotedAmountOut: parseEther("0.001"),
        slippagePercent: 1.0,
        relayerFee: DUMMY_NOTE.denomination,
        newCommitment: "0x00",
      })
    ).toThrow(/relayerFee cannot exceed or equal/);
  });

  it("generates cryptographic note secrets for destination note", () => {
    const denom = 1000000000000000n;
    const secrets = generateNewShieldedNoteSecrets(denom);

    expect(secrets.nullifier).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(secrets.secret).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(secrets.nullifierHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(secrets.commitment).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(secrets.newNote.denomination).toBe(denom);
  });

  it("maps router error types honestly per DevBrief §7 #2", () => {
    expect(mapShieldedSwapError(new Error("reverted: SlippageExceeded"), 0.5)).toContain(
      "SlippageExceeded"
    );
    expect(
      mapShieldedSwapError(new Error("reverted: NonZeroBalanceInvariantFailed"))
    ).toContain("NonZeroBalanceInvariantFailed");
    expect(
      mapShieldedSwapError(new Error("reverted: InsufficientOutputForDenomination"))
    ).toContain("InsufficientOutputForDenomination");
    expect(mapShieldedSwapError(new Error("reverted: InvalidShieldedPool"))).toContain(
      "InvalidShieldedPool"
    );
    expect(mapShieldedSwapError(new Error("User denied transaction signature"))).toContain(
      "Transaction signature rejected"
    );
  });
});
