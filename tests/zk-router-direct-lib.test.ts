import { describe, it, expect } from "vitest";
import {
  buildDirectFullZkFlowArgs,
  findDirectPayoutExecuted,
} from "../lib/zk-router";

const W = {
  processooor: "0xb68c3d25e5e9902363e8e10d5c0a471e65be8152",
  data: "0x1234",
} as never;
const P = {
  pA: ["1", "2"],
  pB: [
    ["3", "4"],
    ["5", "6"],
  ],
  pC: ["7", "8"],
  pubSignals: ["1", "2", "3", "4", "5", "6", "7", "8"],
} as never;
const ZERO = "0x0000000000000000000000000000000000000000";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const USER = "0x000000000000000000000000000000000000dEaD";

describe("direct flow builders (dust payout)", () => {
  it("builds args with router-chained recipient and payout destination", () => {
    const args = buildDirectFullZkFlowArgs({
      withdrawal: W,
      proof: P,
      scope: 1n,
      withdrawAsset: ZERO as never,
      outputRecipient: USER as never,
      zeroForOne: true,
      quotedSwapOut: 100n,
      slippagePercent: 0.5,
    });
    expect(args.recipient).toBe("0x9ccf3800cb6aa5754ec9ec5815e06f432df10635");
    expect(args.outputRecipient).toBe(USER);
    expect(args.minSwapOut).toBeGreaterThan(0n);
    expect(args.minSwapOut).toBeLessThanOrEqual(100n);
    expect(args.outputAsset.toLowerCase()).toBe(VEIL.toLowerCase());
  });

  it("rejects zero payout recipient and empty quotes", () => {
    const base = {
      withdrawal: W,
      proof: P,
      scope: 1n,
      withdrawAsset: ZERO as never,
      zeroForOne: true,
      quotedSwapOut: 100n,
      slippagePercent: 0.5,
    };
    expect(() => buildDirectFullZkFlowArgs({ ...base, outputRecipient: ZERO as never })).toThrow(
      /non-zero recipient/
    );
    expect(() =>
      buildDirectFullZkFlowArgs({ ...base, outputRecipient: USER as never, quotedSwapOut: 0n })
    ).toThrow(/greater than zero/);
  });

  it("finds the direct payout event only for our recipient", () => {
    expect(findDirectPayoutExecuted([], USER as never)).toBeNull();
    expect(
      findDirectPayoutExecuted(
        [{ data: "0x" as never, topics: ["0xdead" as never] }],
        USER as never
      )
    ).toBeNull();
  });
});

